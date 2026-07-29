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
    desc: "League scoring was incredibly high in the 1980s as skater skill grew unproportionally to goalies, thank Wayne Gretzky and company. However, goaltending entered a new era due to the likes of Patrick Roy and Martin Brodeur, as well as higher physicality defenders like Scott Stevens, and scoring plummented until the mid 2000s. A trend of stars like Crosby, Ovechkin, and Kane recovered offensive numbers to the present day.",
    render: renderScene1
  },
  {
    title: "Scene 2: Team Averages in Recent Seasons",
    desc: "Tampa has had the most fiery offense since 2018, and have won 2 cups, appearing in 3 total finals in the timespan, due to offensive juggernauts like Kucherov and Stamkos. Every other team in the top 8 has won a cup or made a deep playoff run in the timespan. No team outside of the top 9 has won a cup between 2018-2024.",
    render: renderScene2
  },
  {
    title: "Scene 3: Before vs. After Era Shift",
    desc: "Each bar shows how much a team’s modern-era scoring differs from the pre-lockout era. Detroit sits with the worst differential, who were arguably the most dominant franchise between 1990-2004.",
    render: renderScene3
  },
  {
    title: "Scene 4: Explore the Data Yourself",
    desc: "Choose Top 8 / Top 16 or Specific Teams. In Specific Teams mode, pick teams and adjust the season range.",
    render: renderScene4
  }
];

const CSV_FILE = "nhl_gfg_pivot_1990_2024.csv";

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
  UTA: ["Utah Hockey Club", "Utah Hockey Club*"],
  VAN: ["Vancouver Canucks", "Vancouver Canucks*"],
  VGK: ["Vegas Golden Knights", "Vegas Golden Knights*"],
  WPG: ["Winnipeg Jets", "Winnipeg Jets*", "Atlanta Thrashers", "Atlanta Thrashers*"],
  WSH: ["Washington Capitals", "Washington Capitals*"]
};

let leagueData = [];
let teamData = [];
let annotationBoxes = []; // per-scene collision map

/* -------------------- data loading -------------------- */

function candidateCsvPaths(filename) {
  const path = window.location.pathname;
  const segs = path.split("/").filter(Boolean);
  const repo = segs.length ? segs[0] : "";

  const candidates = [
    `./${filename}`,
    filename,
    `/${filename}`
  ];

  if (repo) candidates.push(`/${repo}/${filename}`);
  candidates.push(`https://raw.githubusercontent.com/brandonmoretti/d3-narrative-project/main/${filename}`);

  return [...new Set(candidates)];
}

async function loadCsvWithFallback(filename) {
  const tries = candidateCsvPaths(filename);
  let lastErr = null;

  for (const p of tries) {
    try {
      const data = await d3.csv(p);
      if (Array.isArray(data) && data.length > 0) {
        console.log("Loaded CSV from:", p);
        return data;
      }
      lastErr = new Error(`Empty CSV: ${p}`);
    } catch (e) {
      lastErr = e;
      console.warn("Failed:", p, e?.message || e);
    }
  }
  throw lastErr || new Error("All CSV path attempts failed.");
}

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
      let cols = TEAM_COLUMN_MAP[team] || [];

      if (team === "UTA" && (!r["Utah Hockey Club"] && !r["Utah Hockey Club*"])) {
        cols = ["Arizona Coyotes", "Arizona Coyotes*", "Phoenix Coyotes", "Phoenix Coyotes*"];
      }

      const val = firstNumber(...cols.map(c => r[c]));
      if (val !== null) outTeam.push({ season, team, goalsPerGame: +val });
    });
  });

  const league = d3.rollups(
    outTeam,
    v => d3.mean(v, d => d.goalsPerGame),
    d => d.season
  ).map(([season, goalsPerGame]) => ({ season: +season, goalsPerGame: +goalsPerGame }))
   .sort((a, b) => a.season - b.season);

  return { teamData: outTeam, leagueData: league };
}

loadCsvWithFallback(CSV_FILE)
  .then(raw => {
    const parsed = buildCanonicalTeamSeasonData(raw);
    teamData = parsed.teamData;
    leagueData = parsed.leagueData;
    initControls();
    updateScene();
  })
  .catch(err => {
    sceneTitle.textContent = "Data Load Error";
    sceneDescription.innerHTML = `Could not load <strong>${CSV_FILE}</strong>. Open console to inspect path attempts.`;
    console.error(err);
  });

/* -------------------- controls -------------------- */

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

  rankModeSelect.addEventListener("change", (e) => {
    state.maxTeamsVisible = +e.target.value;
    if (state.currentScene === 1 || state.currentScene === 2) updateScene();
  });

  scene4ModeSelect.addEventListener("change", (e) => {
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
  annotationBoxes = []; // reset collision memory per scene
  s.render();
}

/* -------------------- helpers -------------------- */

function drawValueAxes({ xScale, yScale, xLabel, yLabel, xTicks = 8, yTicks = 6 }) {
  g.append("g")
    .attr("class", "grid")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(xScale).ticks(xTicks).tickSize(-innerH).tickFormat(""))
    .selectAll("line").attr("opacity", 0.5);

  g.append("g")
    .attr("class", "grid")
    .call(d3.axisLeft(yScale).ticks(yTicks).tickSize(-innerW).tickFormat(""))
    .selectAll("line").attr("opacity", 0.5);

  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(xScale).ticks(xTicks).tickFormat(d3.format("d")));

  g.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(yScale).ticks(yTicks));

  g.append("text")
    .attr("x", innerW / 2)
    .attr("y", innerH + 58)
    .attr("text-anchor", "middle")
    .attr("fill", "#dce5ff")
    .style("font-size", "15px")
    .text(xLabel);

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerH / 2)
    .attr("y", -60)
    .attr("text-anchor", "middle")
    .attr("fill", "#dce5ff")
    .style("font-size", "15px")
    .text(yLabel);
}

function drawCategoryAxes({ xScale, yScale, xLabel, yLabel, rotateLabels = false }) {
  g.append("g")
    .attr("class", "grid")
    .call(d3.axisLeft(yScale).ticks(6).tickSize(-innerW).tickFormat(""))
    .selectAll("line").attr("opacity", 0.5);

  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(xScale).tickSizeOuter(0))
    .selectAll("text")
    .attr("text-anchor", rotateLabels ? "end" : "middle")
    .attr("transform", rotateLabels ? "rotate(-35)" : null)
    .attr("dx", rotateLabels ? "-0.55em" : "0")
    .attr("dy", rotateLabels ? "0.2em" : "1em");

  g.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(yScale).ticks(6));

  g.append("text")
    .attr("x", innerW / 2)
    .attr("y", innerH + (rotateLabels ? 78 : 58))
    .attr("text-anchor", "middle")
    .attr("fill", "#dce5ff")
    .style("font-size", "15px")
    .text(xLabel);

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerH / 2)
    .attr("y", -60)
    .attr("text-anchor", "middle")
    .attr("fill", "#dce5ff")
    .style("font-size", "15px")
    .text(yLabel);
}

function boxesOverlap(a, b, pad = 8) {
  return !(
    a.x + a.w + pad < b.x ||
    b.x + b.w + pad < a.x ||
    a.y + a.h + pad < b.y ||
    b.y + b.h + pad < a.y
  );
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/**
 * Smart annotation placement:
 * - tries several candidate positions around anchor
 * - clamps to plot bounds
 * - avoids overlap with previous annotations
 */
function placeAnnotationBox(anchorX, anchorY, boxW, boxH) {
  const candidates = [
    { dx: 26, dy: -boxH - 18 },   // top-right
    { dx: -boxW - 26, dy: -boxH - 18 }, // top-left
    { dx: 26, dy: 18 },           // bottom-right
    { dx: -boxW - 26, dy: 18 },   // bottom-left
    { dx: 26, dy: -boxH / 2 },    // right-mid
    { dx: -boxW - 26, dy: -boxH / 2 }   // left-mid
  ];

  for (const c of candidates) {
    const x = clamp(anchorX + c.dx, 6, innerW - boxW - 6);
    const y = clamp(anchorY + c.dy, 6, innerH - boxH - 6);
    const rect = { x, y, w: boxW, h: boxH };

    const collides = annotationBoxes.some(b => boxesOverlap(rect, b, 10));
    if (!collides) {
      annotationBoxes.push(rect);
      return rect;
    }
  }

  // fallback: stack downward from top-left safe zone
  const fallback = { x: 10, y: 10 + annotationBoxes.length * (boxH + 8), w: boxW, h: boxH };
  fallback.y = clamp(fallback.y, 6, innerH - boxH - 6);
  annotationBoxes.push(fallback);
  return fallback;
}

function addAnnotationSmart({ x, y, title, subtitle, boxW = 290, boxH = 64 }) {
  const rect = placeAnnotationBox(x, y, boxW, boxH);

  const anchorX = x < rect.x ? rect.x : rect.x + rect.w;
  const anchorY = clamp(y, rect.y + 10, rect.y + rect.h - 10);

  g.append("line")
    .attr("class", "annotation-line")
    .attr("x1", x).attr("y1", y)
    .attr("x2", anchorX).attr("y2", anchorY);

  const box = g.append("g").attr("transform", `translate(${rect.x}, ${rect.y})`);
  box.append("rect")
    .attr("class", "annotation-box")
    .attr("width", rect.w)
    .attr("height", rect.h);

  box.append("text")
    .attr("class", "annotation-text")
    .attr("x", 12).attr("y", 24)
    .style("font-weight", "700")
    .text(title);

  box.append("text")
    .attr("class", "annotation-text")
    .attr("x", 12).attr("y", 46)
    .text(subtitle);
}

/* -------------------- scenes -------------------- */

function renderScene1() {
  const x = d3.scaleLinear().domain(d3.extent(leagueData, d => d.season)).range([0, innerW]);
  const y = d3.scaleLinear()
    .domain([d3.min(leagueData, d => d.goalsPerGame) - 0.2, d3.max(leagueData, d => d.goalsPerGame) + 0.2])
    .nice()
    .range([innerH, 0]);

  drawValueAxes({ xScale: x, yScale: y, xLabel: "Season", yLabel: "League Goals per Game", xTicks: 8, yTicks: 7 });

  g.append("path")
    .datum(leagueData)
    .attr("fill", "none")
    .attr("stroke", "#4ea3ff")
    .attr("stroke-width", 3)
    .attr("d", d3.line().x(d => x(d.season)).y(d => y(d.goalsPerGame)));

  const low = leagueData.reduce((a, b) => (b.goalsPerGame < a.goalsPerGame ? b : a), leagueData[0]);
  const high = leagueData.reduce((a, b) => (b.goalsPerGame > a.goalsPerGame ? b : a), leagueData[0]);

  addAnnotationSmart({
    x: x(high.season),
    y: y(high.goalsPerGame),
    title: `High point (${high.season})`,
    subtitle: `${high.goalsPerGame.toFixed(2)} goals/game`
  });

  addAnnotationSmart({
    x: x(low.season),
    y: y(low.goalsPerGame),
    title: `Low point (${low.season})`,
    subtitle: `${low.goalsPerGame.toFixed(2)} goals/game`
  });
}

function renderScene2() {
  const recent = teamData.filter(d => d.season >= 2018 && d.season <= 2024);
  const avgByTeam = d3.rollups(recent, v => d3.mean(v, d => d.goalsPerGame), d => d.team)
    .map(([team, avg]) => ({ team, avg: +avg.toFixed(3) }))
    .sort((a, b) => b.avg - a.avg);

  const shown = avgByTeam.slice(0, state.maxTeamsVisible);

  const x = d3.scaleBand().domain(shown.map(d => d.team)).range([0, innerW]).padding(0.12);
  const y = d3.scaleLinear().domain([0, d3.max(shown, d => d.avg) + 0.4]).nice().range([innerH, 0]);

  drawCategoryAxes({
    xScale: x,
    yScale: y,
    xLabel: state.maxTeamsVisible === 32 ? "All 32 teams (ordered by scoring)" : `Top ${state.maxTeamsVisible} teams (ordered by scoring)`,
    yLabel: "Avg Goals per Game (2018–2024)",
    rotateLabels: shown.length > 16
  });

  g.selectAll(".bar")
    .data(shown)
    .enter()
    .append("rect")
    .attr("x", d => x(d.team))
    .attr("y", d => y(d.avg))
    .attr("width", x.bandwidth())
    .attr("height", d => Math.max(0, innerH - y(d.avg)))
    .attr("fill", "#7fd1b9");

  const top = shown[0];
  const mid = shown[Math.floor(shown.length / 2)];

  addAnnotationSmart({
    x: x(top.team) + x.bandwidth() / 2,
    y: y(top.avg),
    title: `Top team: ${top.team}`,
    subtitle: `${top.avg.toFixed(2)} goals/game`
  });

  addAnnotationSmart({
    x: x(mid.team) + x.bandwidth() / 2,
    y: y(mid.avg),
    title: `Middle of shown set: ${mid.team}`,
    subtitle: `${mid.avg.toFixed(2)} goals/game`
  });
}

function renderScene3() {
  const early = teamData.filter(d => d.season >= 1995 && d.season <= 2004);
  const modern = teamData.filter(d => d.season >= 2015 && d.season <= 2024);

  const eMap = new Map(d3.rollups(early, v => d3.mean(v, d => d.goalsPerGame), d => d.team));
  const mMap = new Map(d3.rollups(modern, v => d3.mean(v, d => d.goalsPerGame), d => d.team));

  const delta = Array.from(mMap.keys()).map(team => {
    const e = eMap.get(team);
    const m = mMap.get(team);
    if (e == null || m == null) return null;
    return { team, diff: +(m - e).toFixed(3) };
  }).filter(Boolean).sort((a, b) => b.diff - a.diff);

  let shown;
  if (state.maxTeamsVisible === 32) {
    shown = delta;
  } else {
    const half = Math.floor(state.maxTeamsVisible / 2);
    shown = [...delta.slice(0, half), ...delta.slice(-half)];
  }

  const x = d3.scaleBand().domain(shown.map(d => d.team)).range([0, innerW]).padding(0.12);
  const yMin = Math.min(0, d3.min(shown, d => d.diff) - 0.05);
  const yMax = Math.max(0, d3.max(shown, d => d.diff) + 0.05);
  const y = d3.scaleLinear().domain([yMin, yMax]).nice().range([innerH, 0]);

  drawCategoryAxes({
    xScale: x,
    yScale: y,
    xLabel: state.maxTeamsVisible === 32 ? "All teams by era scoring change" : `Top/Bottom ${state.maxTeamsVisible / 2} teams by era scoring change`,
    yLabel: "Change in Goals/Game (Modern - Early Era)",
    rotateLabels: shown.length > 16
  });

  g.append("line")
    .attr("x1", 0).attr("x2", innerW)
    .attr("y1", y(0)).attr("y2", y(0))
    .attr("stroke", "#d4dcf8")
    .attr("stroke-dasharray", "4 4")
    .attr("stroke-width", 1.5);

  g.selectAll(".deltaBar")
    .data(shown)
    .enter()
    .append("rect")
    .attr("x", d => x(d.team))
    .attr("y", d => Math.min(y(d.diff), y(0)))
    .attr("width", x.bandwidth())
    .attr("height", d => Math.abs(y(d.diff) - y(0)))
    .attr("fill", d => d.diff >= 0 ? "#4ea3ff" : "#ff6b6b");

  const high = shown[0];
  const low = shown[shown.length - 1];

  addAnnotationSmart({
    x: x(high.team) + x.bandwidth() / 2,
    y: y(high.diff),
    title: `Largest increase: ${high.team}`,
    subtitle: `${high.diff.toFixed(2)} goals/game`
  });

  addAnnotationSmart({
    x: x(low.team) + x.bandwidth() / 2,
    y: y(low.diff),
    title: `Smallest change: ${low.team}`,
    subtitle: `${low.diff.toFixed(2)} goals/game`
  });
}

function renderScene4() {
  const windowed = teamData.filter(d => d.season >= state.seasonStart && d.season <= state.seasonEnd);

  const teamMeans = d3.rollups(windowed, v => d3.mean(v, d => d.goalsPerGame), d => d.team)
    .map(([team, avg]) => ({ team, avg: +avg.toFixed(3) }))
    .sort((a, b) => b.avg - a.avg);

  let teamsToShow;
  if (state.scene4Mode === "specific") {
    teamsToShow = state.selectedTeams;
    if (!teamsToShow.length) {
      g.append("text")
        .attr("x", innerW / 2).attr("y", innerH / 2)
        .attr("text-anchor", "middle")
        .attr("fill", "#ffcc4d")
        .style("font-size", "16px")
        .text("Choose one or more teams in Specific Teams mode.");
      return;
    }
  } else {
    const n = +state.scene4Mode;
    teamsToShow = teamMeans.slice(0, n).map(d => d.team);
  }

  const filtered = windowed.filter(d => teamsToShow.includes(d.team));
  if (!filtered.length) return;

  const x = d3.scaleLinear().domain([state.seasonStart, state.seasonEnd]).range([0, innerW]);
  const y = d3.scaleLinear()
    .domain([d3.min(filtered, d => d.goalsPerGame) - 0.2, d3.max(filtered, d => d.goalsPerGame) + 0.2])
    .nice()
    .range([innerH, 0]);

  drawValueAxes({ xScale: x, yScale: y, xLabel: "Season", yLabel: "Goals per Game", xTicks: 8, yTicks: 7 });

  const nested = d3.groups(filtered, d => d.team);
  const color = d3.scaleOrdinal(d3.schemeTableau10).domain(nested.map(d => d[0]));

  nested.forEach(([team, values]) => {
    values.sort((a, b) => a.season - b.season);

    g.append("path")
      .datum(values)
      .attr("fill", "none")
      .attr("stroke", color(team))
      .attr("stroke-width", 2.2)
      .attr("d", d3.line().x(d => x(d.season)).y(d => y(d.goalsPerGame)));

    g.selectAll(`.dot-${team}`)
      .data(values)
      .enter()
      .append("circle")
      .attr("cx", d => x(d.season))
      .attr("cy", d => y(d.goalsPerGame))
      .attr("r", 3.2)
      .attr("fill", color(team))
      .on("mousemove", (event, d) => {
        tooltip.classed("hidden", false)
          .style("left", `${event.pageX + 12}px`)
          .style("top", `${event.pageY - 28}px`)
          .html(`<strong>${d.team}</strong><br/>Season: ${d.season}<br/>G/GP: ${d.goalsPerGame.toFixed(2)}`);
      })
      .on("mouseleave", () => tooltip.classed("hidden", true));
  });

  g.append("text")
    .attr("x", 0).attr("y", -18)
    .attr("fill", "#ffcc4d")
    .attr("font-size", 12)
    .text(
      state.scene4Mode === "specific"
        ? `Specific Teams mode: ${state.selectedTeams.length} selected`
        : `Showing Top ${state.scene4Mode} teams by average goals/game`
    );

  // Legend
  const legendItems = nested.map(([team]) => team);
  const legendX = innerW - 165;
  const legendY = 8;
  const rowH = 17;
  const maxRows = Math.min(14, legendItems.length);

  g.append("rect")
    .attr("x", legendX - 10)
    .attr("y", legendY - 8)
    .attr("width", 160)
    .attr("height", maxRows * rowH + 18)
    .attr("fill", "rgba(19,26,46,0.75)")
    .attr("stroke", "#33416e")
    .attr("rx", 8);

  const legend = g.append("g").attr("transform", `translate(${legendX}, ${legendY})`);
  legendItems.slice(0, maxRows).forEach((team, i) => {
    const row = legend.append("g").attr("transform", `translate(0, ${i * rowH})`);
    row.append("rect").attr("width", 11).attr("height", 11).attr("fill", color(team));
    row.append("text").attr("x", 16).attr("y", 10).attr("fill", "#dce5ff").attr("font-size", 11).text(team);
  });
}