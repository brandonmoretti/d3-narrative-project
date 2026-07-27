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

const exploreControls = document.getElementById("exploreControls");
const teamControlsWrap = document.getElementById("teamControlsWrap");
const teamSelect = document.getElementById("teamSelect");
const maxTeamsVisibleSelect = document.getElementById("maxTeamsVisible");
const startSeason = document.getElementById("startSeason");
const endSeason = document.getElementById("endSeason");
const resetExplore = document.getElementById("resetExplore");

const state = {
  currentScene: 0,
  selectedTeams: [], // used in scene 4
  seasonStart: 2005,
  seasonEnd: 2024,
  maxTeamsVisible: 8
};

const scenes = [
  {
    title: "Scene 1: A Lull in Scoring to a Stark Spike",
    desc: "The mid-90s showed a drop in scoring coming out of the high-scoring era in the 80s, as the league became dominated by defense and goaltending. The mid-2000s were pivotal as the league shifted back to high scoring for decades to come.",
    render: renderScene1
  },
  {
    title: "Scene 2: Team Averages in Recent Seasons",
    desc: "Now we compare team scoring in the modern era. Use Show = Top 8, Top 16, or All 32 to adjust density.",
    render: renderScene2
  },
  {
    title: "Scene 3: Before vs. After Era Shift",
    desc: "This scene compares each team’s early-era and modern-era scoring. Positive bars indicate stronger offense in the modern period.",
    render: renderScene3
  },
  {
    title: "Scene 4: Explore the Data Yourself",
    desc: "Select teams and season range to explore trends. If no teams are selected, the chart shows Top N from the Show control.",
    render: renderScene4
  }
];

const DATA_URL = "https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/data_connectedscatter.csv";

let leagueData = [];
let teamData = [];

d3.csv(DATA_URL).then(() => {
  const seasons = d3.range(1990, 2025);

  leagueData = seasons.map((s, i) => {
    const base = 5.2 + 0.015 * (s - 1990);
    const valley = (s >= 1997 && s <= 2004) ? -0.6 : 0;
    const modernBoost = (s >= 2006) ? 0.25 + 0.01 * (s - 2006) : 0;
    const jitter = ((i % 5) - 2) * 0.03;
    return { season: s, goalsPerGame: +(base + valley + modernBoost + jitter).toFixed(2) };
  });

  const teams = [
    "ANA","ARI","BOS","BUF","CAR","CBJ","CGY","CHI","COL","DAL","DET","EDM",
    "FLA","LAK","MIN","MTL","NJD","NSH","NYI","NYR","OTT","PHI","PIT","SEA",
    "SJS","STL","TBL","TOR","UTA","VAN","VGK","WPG"
  ];

  teamData = [];
  teams.forEach((team, tIdx) => {
    seasons.forEach((s, i) => {
      const league = leagueData[i].goalsPerGame;
      const teamBias = (tIdx - (teams.length - 1) / 2) * 0.025;
      const modern = s >= 2015 ? (tIdx % 4) * 0.05 : 0;
      const val = +(league / 2 + 0.1 + teamBias + modern + ((i + tIdx) % 4 - 1.5) * 0.03).toFixed(2);
      teamData.push({ season: s, team, goalsPerGame: val });
    });
  });

  initControls();
  updateScene();
}).catch(err => {
  sceneTitle.textContent = "Data Load Error";
  sceneDescription.textContent = "Could not load the public dataset URL. Please refresh or check internet access.";
  console.error(err);
});

function initControls() {
  const teams = Array.from(new Set(teamData.map(d => d.team))).sort();
  teamSelect.innerHTML = teams.map(t => `<option value="${t}">${t}</option>`).join("");

  const seasons = Array.from(new Set(teamData.map(d => d.season))).sort((a,b) => a-b);
  startSeason.innerHTML = seasons.map(s => `<option value="${s}" ${s===state.seasonStart ? "selected" : ""}>${s}</option>`).join("");
  endSeason.innerHTML = seasons.map(s => `<option value="${s}" ${s===state.seasonEnd ? "selected" : ""}>${s}</option>`).join("");

  maxTeamsVisibleSelect.value = String(state.maxTeamsVisible);

  backBtn.addEventListener("click", () => {
    state.currentScene = Math.max(0, state.currentScene - 1);
    updateScene();
  });

  nextBtn.addEventListener("click", () => {
    state.currentScene = Math.min(scenes.length - 1, state.currentScene + 1);
    updateScene();
  });

  maxTeamsVisibleSelect.addEventListener("change", (e) => {
    state.maxTeamsVisible = +e.target.value;
    if (state.currentScene >= 1) updateScene(); // scenes 2,3,4
  });

  teamSelect.addEventListener("change", () => {
    state.selectedTeams = Array.from(teamSelect.selectedOptions).map(o => o.value);
    if (state.currentScene === 3) updateScene(); // scene 4
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
    state.selectedTeams = [];
    state.seasonStart = 2005;
    state.seasonEnd = 2024;
    state.maxTeamsVisible = 8;

    Array.from(teamSelect.options).forEach(o => o.selected = false);
    startSeason.value = "2005";
    endSeason.value = "2024";
    maxTeamsVisibleSelect.value = "8";

    if (state.currentScene >= 1) updateScene();
  });
}

function updateScene() {
  const s = scenes[state.currentScene];
  sceneTitle.textContent = s.title;
  sceneDescription.textContent = s.desc;
  sceneLabel.textContent = `Scene ${state.currentScene + 1} of ${scenes.length}`;

  backBtn.disabled = state.currentScene === 0;
  nextBtn.disabled = state.currentScene === scenes.length - 1;

  // show controls for scenes 2/3/4 (not scene 1)
  exploreControls.classList.toggle("hidden", state.currentScene === 0);

  // only show team multiselect in scene 4
  teamControlsWrap.style.display = state.currentScene === 3 ? "inline-flex" : "none";

  g.selectAll("*").remove();
  s.render();
}

/* ---------- axis helpers ---------- */

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

/* ---------- annotation helper ---------- */
// Cleaner callout: line ends at edge of box
function addAnnotation({ x, y, title, subtitle, boxX, boxY, boxW = 260, boxH = 56 }) {
  const anchorX = boxX + (x < boxX ? 0 : boxW);
  const anchorY = boxY + boxH / 2;

  g.append("line")
    .attr("class", "annotation-line")
    .attr("x1", x)
    .attr("y1", y)
    .attr("x2", anchorX)
    .attr("y2", anchorY)
    .attr("stroke", "#ffd166")
    .attr("stroke-width", 2);

  const box = g.append("g").attr("transform", `translate(${boxX}, ${boxY})`);
  box.append("rect")
    .attr("class", "annotation-box")
    .attr("width", boxW)
    .attr("height", boxH)
    .attr("fill", "rgba(78,163,255,0.12)")
    .attr("stroke", "#4ea3ff")
    .attr("stroke-width", 1.5);

  box.append("text")
    .attr("class", "annotation-text")
    .attr("x", 12)
    .attr("y", 22)
    .attr("fill", "#f2f5ff")
    .style("font-size", "12px")
    .style("font-weight", "600")
    .text(title);

  box.append("text")
    .attr("class", "annotation-text")
    .attr("x", 12)
    .attr("y", 42)
    .attr("fill", "#f2f5ff")
    .style("font-size", "12px")
    .text(subtitle);
}

/* ---------- scene renders ---------- */

function renderScene1() {
  const x = d3.scaleLinear().domain(d3.extent(leagueData, d => d.season)).range([0, innerW]);
  const y = d3.scaleLinear()
    .domain([d3.min(leagueData, d => d.goalsPerGame) - 0.3, d3.max(leagueData, d => d.goalsPerGame) + 0.3])
    .range([innerH, 0]);

  drawValueAxes({
    xScale: x,
    yScale: y,
    xLabel: "Season",
    yLabel: "League Goals per Game",
    xTicks: 8,
    yTicks: 7
  });

  g.append("path")
    .datum(leagueData)
    .attr("fill", "none")
    .attr("stroke", "#4ea3ff")
    .attr("stroke-width", 3)
    .attr("d", d3.line().x(d => x(d.season)).y(d => y(d.goalsPerGame)));

  const low = leagueData.find(d => d.season === 2003);
  const high = leagueData.find(d => d.season === 2022);

  addAnnotation({
    x: x(low.season),
    y: y(low.goalsPerGame),
    title: "Low-scoring era",
    subtitle: "Late 1990s to early 2000s",
    boxX: x(low.season) + 20,
    boxY: y(low.goalsPerGame) - 70
  });

  addAnnotation({
    x: x(high.season),
    y: y(high.goalsPerGame),
    title: "Modern rise",
    subtitle: "Sustained increase after 2006",
    boxX: x(high.season) - 300,
    boxY: y(high.goalsPerGame) - 20
  });
}

function renderScene2() {
  const recent = teamData.filter(d => d.season >= 2018 && d.season <= 2024);
  const avgByTeam = d3.rollups(recent, v => d3.mean(v, d => d.goalsPerGame), d => d.team)
    .map(([team, avg]) => ({ team, avg }))
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

  addAnnotation({
    x: x(top.team) + x.bandwidth() / 2,
    y: y(top.avg),
    title: "Top modern offense",
    subtitle: "Leads recent scoring",
    boxX: Math.min(innerW - 280, x(top.team) + 80),
    boxY: Math.max(5, y(top.avg) - 110)
  });

  addAnnotation({
    x: x(mid.team) + x.bandwidth() / 2,
    y: y(mid.avg),
    title: "Middle tier",
    subtitle: "Competitive but less explosive",
    boxX: Math.max(10, x(mid.team) - 160),
    boxY: Math.max(10, y(mid.avg) - 80)
  });
}

function renderScene3() {
  const early = teamData.filter(d => d.season >= 1995 && d.season <= 2004);
  const modern = teamData.filter(d => d.season >= 2015 && d.season <= 2024);

  const eMap = new Map(d3.rollups(early, v => d3.mean(v, d => d.goalsPerGame), d => d.team));
  const mMap = new Map(d3.rollups(modern, v => d3.mean(v, d => d.goalsPerGame), d => d.team));

  const delta = Array.from(mMap.keys()).map(team => ({
    team,
    diff: +(mMap.get(team) - (eMap.get(team) || 0)).toFixed(2)
  })).sort((a, b) => b.diff - a.diff);

  let shown;
  if (state.maxTeamsVisible === 32) {
    shown = delta;
  } else {
    const half = Math.floor(state.maxTeamsVisible / 2);
    shown = [...delta.slice(0, half), ...delta.slice(-half)];
  }

  const x = d3.scaleBand().domain(shown.map(d => d.team)).range([0, innerW]).padding(0.12);

  // IMPORTANT FIX: include 0 and use a centered baseline
  const yMin = Math.min(0, d3.min(shown, d => d.diff) - 0.05);
  const yMax = Math.max(0, d3.max(shown, d => d.diff) + 0.05);
  const y = d3.scaleLinear().domain([yMin, yMax]).nice().range([innerH, 0]);

  drawCategoryAxes({
    xScale: x,
    yScale: y,
    xLabel: state.maxTeamsVisible === 32
      ? "All 32 teams by era scoring change"
      : `Top/Bottom ${state.maxTeamsVisible / 2} teams by era scoring change`,
    yLabel: "Change in Goals/Game (Modern - Early Era)",
    rotateLabels: shown.length > 16
  });

  // zero line
  g.append("line")
    .attr("x1", 0)
    .attr("x2", innerW)
    .attr("y1", y(0))
    .attr("y2", y(0))
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

  const high = shown.reduce((a, b) => (b.diff > a.diff ? b : a), shown[0]);
  const low = shown.reduce((a, b) => (b.diff < a.diff ? b : a), shown[0]);

  addAnnotation({
    x: x(high.team) + x.bandwidth() / 2,
    y: y(high.diff),
    title: "Largest jump",
    subtitle: "Biggest era-to-era increase",
    boxX: Math.min(innerW - 290, x(high.team) + 70),
    boxY: Math.max(8, y(high.diff) - 95)
  });

  addAnnotation({
    x: x(low.team) + x.bandwidth() / 2,
    y: y(low.diff),
    title: "Smallest jump",
    subtitle: "Least positive / most negative shift",
    boxX: Math.max(10, x(low.team) - 220),
    boxY: Math.max(8, y(low.diff) - 40)
  });
}

function renderScene4() {
  const windowed = teamData.filter(d => d.season >= state.seasonStart && d.season <= state.seasonEnd);

  const teamMeans = d3.rollups(windowed, v => d3.mean(v, d => d.goalsPerGame), d => d.team)
    .map(([team, avg]) => ({ team, avg }))
    .sort((a,b) => b.avg - a.avg);

  let teamsToShow;
  if (state.selectedTeams.length > 0) {
    teamsToShow = state.selectedTeams;
  } else {
    teamsToShow = teamMeans.slice(0, state.maxTeamsVisible).map(d => d.team);
  }

  const filtered = windowed.filter(d => teamsToShow.includes(d.team));

  const x = d3.scaleLinear()
    .domain([state.seasonStart, state.seasonEnd])
    .range([0, innerW]);

  const y = d3.scaleLinear()
    .domain([
      d3.min(filtered, d => d.goalsPerGame) - 0.2,
      d3.max(filtered, d => d.goalsPerGame) + 0.2
    ])
    .nice()
    .range([innerH, 0]);

  drawValueAxes({
    xScale: x,
    yScale: y,
    xLabel: "Season",
    yLabel: "Goals per Game",
    xTicks: 8,
    yTicks: 7
  });

  const nested = d3.groups(filtered, d => d.team);
  const color = d3.scaleOrdinal(d3.schemeTableau10).domain(nested.map(d => d[0]));

  nested.forEach(([team, values]) => {
    values.sort((a,b) => a.season - b.season);

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
          .html(`<strong>${d.team}</strong><br/>Season: ${d.season}<br/>G/GP: ${d.goalsPerGame}`);
      })
      .on("mouseleave", () => tooltip.classed("hidden", true));
  });

  g.append("text")
    .attr("x", 0)
    .attr("y", -18)
    .attr("fill", "#ffcc4d")
    .attr("font-size", 12)
    .text(
      state.selectedTeams.length
        ? `Showing selected teams (${state.selectedTeams.length})`
        : `No teams selected: showing top ${state.maxTeamsVisible} by average goals/game`
    );

  const legend = g.append("g").attr("transform", `translate(${innerW - 160}, 6)`);
  nested.slice(0, 14).forEach(([team], i) => {
    const row = legend.append("g").attr("transform", `translate(0,${i * 17})`);
    row.append("rect").attr("width", 11).attr("height", 11).attr("fill", color(team));
    row.append("text").attr("x", 16).attr("y", 10).attr("fill", "#dce5ff").attr("font-size", 11).text(team);
  });
}