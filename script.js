const svg = d3.select("#chart");
const width = +svg.attr("width");
const height = +svg.attr("height");
const margin = { top: 50, right: 40, bottom: 90, left: 85 };
const innerW = width - margin.left - margin.right;
const innerH = height - margin.top - margin.bottom;

const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
const tooltip = d3.select("#tooltip");

const sceneTitle = document.getElementById("sceneTitle");
const sceneDescription = document.getElementById("sceneDescription");
const sceneLabel = document.getElementById("sceneLabel");
const backBtn = document.getElementById("backBtn");
const nextBtn = document.getElementById("nextBtn");

const sceneControls = document.getElementById("sceneControls");
const rankModeWrap = document.getElementById("rankModeWrap");
const rankModeSelect = document.getElementById("rankModeSelect");

const scene4ModeWrap = document.getElementById("scene4ModeWrap");
const scene4ModeSelect = document.getElementById("scene4ModeSelect");

const teamControlsWrap = document.getElementById("teamControlsWrap");
const teamSelect = document.getElementById("teamSelect");

const yearControlsWrap = document.getElementById("yearControlsWrap");
const startSeason = document.getElementById("startSeason");
const endSeason = document.getElementById("endSeason");

const resetExplore = document.getElementById("resetExplore");

const state = {
  currentScene: 0,
  maxTeamsVisible: 8,
  scene4Mode: "8",
  selectedTeams: [],
  seasonStart: 2005,
  seasonEnd: 2024
};

const scenes = [
  {
    title: "Scene 1: NHL Scoring Trend Since 1990",
    desc: "League scoring dipped through the late 1990s and early 2000s, then climbed in the modern era.",
    render: renderScene1
  },
  {
    title: "Scene 2: Team Averages in Recent Seasons",
    desc: "Compare team scoring in recent years. Use Top 8 / Top 16 / All 32 to adjust chart density.",
    render: renderScene2
  },
  {
    title: "Scene 3: Before vs. After Era Shift",
    desc: "Each bar shows how much a team’s modern-era scoring differs from the pre-lockout era.",
    render: renderScene3
  },
  {
    title: "Scene 4: Explore the Data Yourself",
    desc: "Choose Top 8 / Top 16 or Specific Teams. In Specific Teams mode, pick teams and adjust the season range.",
    render: renderScene4
  }
];

const CSV_FILE = "nhl_gfg_pivot_1990_2024.csv";

// Build likely paths for local + GitHub Pages
function candidateCsvPaths(filename) {
  const path = window.location.pathname; // e.g. /d3-narrative-project/
  const segs = path.split("/").filter(Boolean);
  const repo = segs.length ? segs[0] : "";

  const candidates = [
    `./${filename}`,
    filename,
    `/${filename}`
  ];

  if (repo) {
    candidates.push(`/${repo}/${filename}`);
  }

  // Absolute raw github as fallback (works after push)
  candidates.push(`https://raw.githubusercontent.com/brandonmoretti/d3-narrative-project/main/${filename}`);

  // de-dupe
  return [...new Set(candidates)];
}

async function loadCsvWithFallback(filename) {
  const paths = candidateCsvPaths(filename);
  let lastErr = null;

  for (const p of paths) {
    try {
      const data = await d3.csv(p);
      if (Array.isArray(data) && data.length > 0) {
        console.log("Loaded CSV from:", p);
        return data;
      }
      lastErr = new Error(`Empty CSV at ${p}`);
    } catch (e) {
      lastErr = e;
      console.warn("CSV load failed:", p, e?.message || e);
    }
  }
  throw lastErr || new Error("Unable to load CSV from any candidate path.");
}

const CANONICAL_TEAMS = [
  "ANA","ARI","BOS","BUF","CAR","CBJ","CGY","CHI","COL","DAL","DET","EDM",
  "FLA","LAK","MIN","MTL","NSH","NJD","NYI","NYR","OTT","PHI","PIT","SEA",
  "SJS","STL","TBL","TOR","UTA","VAN","VGK","WPG","WSH"
];

const TEAM_COLUMN_MAP = {
  ANA: ["Anaheim Ducks", "Anaheim Ducks*", "Mighty Ducks of Anaheim", "Mighty Ducks of Anaheim*"],
  ARI: ["Arizona Coyotes", "Arizona Coyotes*", "Phoenix Coyotes", "Phoenix Coyotes*"],
  BOS: ["Boston Bruins", "Boston Bruins*"],
  BUF: ["Buffalo Sabres", "Buffalo Sabres*"],
  CAR: ["Carolina Hurricanes", "Carolina Hurricanes*", "Hartford Whalers", "Hartford Whalers*"],
  CBJ: ["Columbus Blue Jackets", "Columbus Blue Jackets*"],
  CGY: ["Calgary Flames", "Calgary Flames*"],
  CHI: ["Chicago Blackhawks", "Chicago Blackhawks*"],
  COL: ["Colorado Avalanche", "Colorado Avalanche*", "Quebec Nordiques", "Quebec Nordiques*"],
  DAL: ["Dallas Stars", "Dallas Stars*", "Minnesota North Stars", "Minnesota North Stars*"],
  DET: ["Detroit Red Wings", "Detroit Red Wings*"],
  EDM: ["Edmonton Oilers", "Edmonton Oilers*"],
  FLA: ["Florida Panthers", "Florida Panthers*"],
  LAK: ["Los Angeles Kings", "Los Angeles Kings*"],
  MIN: ["Minnesota Wild", "Minnesota Wild*"],
  MTL: ["Montreal Canadiens", "Montreal Canadiens*"],
  NSH: ["Nashville Predators", "Nashville Predators*"],
  NJD: ["New Jersey Devils", "New Jersey Devils*"],
  NYI: ["New York Islanders", "New York Islanders*"],
  NYR: ["New York Rangers", "New York Rangers*"],
  OTT: ["Ottawa Senators", "Ottawa Senators*"],
  PHI: ["Philadelphia Flyers", "Philadelphia Flyers*"],
  PIT: ["Pittsburgh Penguins", "Pittsburgh Penguins*"],
  SEA: ["Seattle Kraken", "Seattle Kraken*"],
  SJS: ["San Jose Sharks", "San Jose Sharks*"],
  STL: ["St. Louis Blues", "St. Louis Blues*"],
  TBL: ["Tampa Bay Lightning", "Tampa Bay Lightning*"],
  TOR: ["Toronto Maple Leafs", "Toronto Maple Leafs*"],
  UTA: ["Utah Hockey Club", "Utah Hockey Club*"], // if present in newer data
  VAN: ["Vancouver Canucks", "Vancouver Canucks*"],
  VGK: ["Vegas Golden Knights", "Vegas Golden Knights*"],
  WPG: ["Winnipeg Jets", "Winnipeg Jets*", "Atlanta Thrashers", "Atlanta Thrashers*"],
  WSH: ["Washington Capitals", "Washington Capitals*"]
};

let leagueData = [];
let teamData = [];

loadCsvWithFallback(CSV_FILE).then(raw => {
  const parsed = buildCanonicalTeamSeasonData(raw);

  teamData = parsed.teamData;
  leagueData = parsed.leagueData;

  // If UTA has no rows in this dataset, backfill UTA from ARI for 2024+ if desired
  // (optional; not required for charting)
  if (!teamData.some(d => d.team === "UTA")) {
    const ariLatest = teamData.filter(d => d.team === "ARI" && d.season >= 2024);
    ariLatest.forEach(d => teamData.push({ ...d, team: "UTA" }));
  }

  initControls();
  updateScene();
}).catch(err => {
  sceneTitle.textContent = "Data Load Error";
  sceneDescription.innerHTML = `
    Could not load <strong>${CSV_FILE}</strong>.<br/>
    Tried multiple paths. Open DevTools Console to see attempted URLs.<br/>
    Also verify filename case exactly matches.
  `;
  console.error(err);
});

function firstNumber(...vals) {
  for (const v of vals) {
    if (v === undefined || v === null || v === "") continue;
    const n = +v;
    if (!Number.isNaN(n)) return n;
  }
  return null;
}

function buildCanonicalTeamSeasonData(rows) {
  const outTeam = [];

  rows.forEach(r => {
    const season = +r.Year;
    if (Number.isNaN(season)) return;

    CANONICAL_TEAMS.forEach(team => {
      const cols = TEAM_COLUMN_MAP[team] || [];
      const n = firstNumber(...cols.map(c => r[c]));
      if (n !== null) {
        outTeam.push({ season, team, goalsPerGame: +n });
      }
    });
  });

  // manual merge for UTA from ARI/PHX if UTA column absent
  const hasUTA = outTeam.some(d => d.team === "UTA");
  if (!hasUTA) {
    const ariRows = outTeam.filter(d => d.team === "ARI");
    ariRows.forEach(d => {
      if (d.season >= 2024) outTeam.push({ season: d.season, team: "UTA", goalsPerGame: d.goalsPerGame });
    });
  }

  const league = d3.rollups(
    outTeam,
    v => d3.mean(v, d => d.goalsPerGame),
    d => d.season
  )
    .map(([season, goalsPerGame]) => ({ season: +season, goalsPerGame: +goalsPerGame }))
    .sort((a, b) => a.season - b.season);

  return { teamData: outTeam, leagueData: league };
}

function initControls() {
  const teams = Array.from(new Set(teamData.map(d => d.team))).sort();
  teamSelect.innerHTML = teams.map(t => `<option value="${t}">${t}</option>`).join("");

  const seasons = Array.from(new Set(teamData.map(d => d.season))).sort((a, b) => a - b);
  startSeason.innerHTML = seasons.map(s => `<option value="${s}" ${s === state.seasonStart ? "selected" : ""}>${s}</option>`).join("");
  endSeason.innerHTML = seasons.map(s => `<option value="${s}" ${s === state.seasonEnd ? "selected" : ""}>${s}</option>`).join("");

  rankModeSelect.value = String(state.maxTeamsVisible);
  scene4ModeSelect.value = state.scene4Mode;

  backBtn.addEventListener("click", () => {
    state.currentScene = Math.max(0, state.currentScene - 1);
    updateScene();
  });

  nextBtn.addEventListener("click", () => {
    state.currentScene = Math.min(scenes.length - 1, state.currentScene + 1);
    updateScene();
  });

  rankModeSelect.addEventListener("change", e => {
    state.maxTeamsVisible = +e.target.value;
    if (state.currentScene === 1 || state.currentScene === 2) updateScene();
  });

  scene4ModeSelect.addEventListener("change", e => {
    state.scene4Mode = e.target.value;
    if (state.scene4Mode !== "specific") {
      state.selectedTeams = [];
      Array.from(teamSelect.options).forEach(o => (o.selected = false));
    }
    if (state.currentScene === 3) updateScene();
  });

  teamSelect.addEventListener("change", () => {
    state.selectedTeams = Array.from(teamSelect.selectedOptions).map(o => o.value);
    if (state.currentScene === 3 && state.scene4Mode === "specific") updateScene();
  });

  startSeason.addEventListener("change", () => {
    state.seasonStart = +startSeason.value;
    if (state.seasonStart > state.seasonEnd) {
      state.seasonEnd = state.seasonStart;
      endSeason.value = String(state.seasonEnd);
    }
    if (state.currentScene === 3) updateScene();
  });

  endSeason.addEventListener("change", () => {
    state.seasonEnd = +endSeason.value;
    if (state.seasonEnd < state.seasonStart) {
      state.seasonStart = state.seasonEnd;
      startSeason.value = String(state.seasonStart);
    }
    if (state.currentScene === 3) updateScene();
  });

  resetExplore.addEventListener("click", () => {
    state.scene4Mode = "8";
    state.selectedTeams = [];
    state.seasonStart = 2005;
    state.seasonEnd = 2024;

    scene4ModeSelect.value = "8";
    startSeason.value = "2005";
    endSeason.value = "2024";
    Array.from(teamSelect.options).forEach(o => (o.selected = false));

    if (state.currentScene === 3) updateScene();
  });
}

function setControlVisibility() {
  sceneControls.classList.add("hidden");
  rankModeWrap.classList.add("hidden");
  scene4ModeWrap.classList.add("hidden");
  teamControlsWrap.classList.add("hidden");
  yearControlsWrap.classList.add("hidden");
  resetExplore.classList.add("hidden");

  if (state.currentScene === 0) return;

  if (state.currentScene === 1 || state.currentScene === 2) {
    sceneControls.classList.remove("hidden");
    rankModeWrap.classList.remove("hidden");
    return;
  }

  if (state.currentScene === 3) {
    sceneControls.classList.remove("hidden");
    scene4ModeWrap.classList.remove("hidden");
    yearControlsWrap.classList.remove("hidden");
    resetExplore.classList.remove("hidden");
    if (state.scene4Mode === "specific") teamControlsWrap.classList.remove("hidden");
  }
}

function updateScene() {
  const s = scenes[state.currentScene];
  sceneTitle.textContent = s.title;
  sceneDescription.textContent = s.desc;
  sceneLabel.textContent = `Scene ${state.currentScene + 1} of ${scenes.length}`;
  backBtn.disabled = state.currentScene === 0;
  nextBtn.disabled = state.currentScene === scenes.length - 1;
  setControlVisibility();
  g.selectAll("*").remove();
  s.render();
}

// --- keep your existing render helpers + scene renderers here unchanged ---
function drawValueAxes() {}
function drawCategoryAxes() {}
function addAnnotation() {}
function renderScene1() {}
function renderScene2() {}
function renderScene3() {}
function renderScene4() {}