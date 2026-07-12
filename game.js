'use strict';
/* ============================================================
   APEX RUSH GP — top-down racer, iRacing-style presentation
   Single-file canvas game. No dependencies.
   ============================================================ */

// ---------- Canvas / DPI ----------
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let DPR = 1, VW = 0, VH = 0;

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  VW = window.innerWidth;
  VH = window.innerHeight;
  canvas.width = Math.round(VW * DPR);
  canvas.height = Math.round(VH * DPR);
}
window.addEventListener('resize', resize);
resize();

// ---------- Math helpers ----------
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
function angleWrap(a) {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}
function rand(a, b) { return a + Math.random() * (b - a); }

// ---------- World / track definition ----------
const WORLD_W = 4200, WORLD_H = 3000;
const ROAD_W = 132;

// 13 circuits, all inside the same world. The first 3 start unlocked;
// each further one unlocks by mastering a track (3 race wins on it).
// All layouts validated for self-overlap / corner tightness (trackcheck).
const TRACKS = [
  {
    id: 'gp', name: 'APEX GP',
    ctrl: [
      [620, 520], [1800, 430], [2900, 490], [3620, 720],
      [3760, 1300], [3420, 1760], [2820, 1620], [2420, 2020],
      [2820, 2520], [2180, 2660], [1400, 2500], [900, 2620],
      [500, 2300], [660, 1720], [420, 1100]
    ]
  },
  {
    id: 'oval', name: 'THUNDER OVAL',
    ctrl: [
      [800, 700], [2100, 520], [3400, 700], [3850, 1500],
      [3400, 2300], [2100, 2480], [800, 2300], [350, 1500]
    ]
  },
  {
    id: 'hairpin', name: 'HAIRPIN HILLS',
    ctrl: [
      [500, 500], [1600, 650], [2600, 450], [3600, 600],
      [3800, 1200], [3000, 1450], [3650, 1850], [2900, 2150],
      [2100, 2550], [1100, 2400], [600, 2650], [420, 1900],
      [820, 1450], [430, 950]
    ]
  },
  {
    id: 'sunset', name: 'SUNSET SPRINT',
    ctrl: [
      [700, 600], [2000, 450], [3300, 600], [3800, 1400],
      [3300, 2200], [2600, 1900], [1800, 2400], [900, 2400],
      [400, 1500]
    ]
  },
  {
    id: 'horseshoe', name: 'GRAND HORSESHOE',
    ctrl: [
      [600, 500], [2100, 400], [3600, 500], [3800, 1300],
      [3300, 1500], [2100, 1400], [1500, 1420], [1050, 1680],
      [1700, 1900], [2400, 1890], [3200, 1900], [3700, 2100],
      [3300, 2650], [1800, 2600], [600, 2400], [380, 1400]
    ]
  },
  {
    id: 'canyon', name: 'CANYON RUN',
    ctrl: [
      [500, 450], [2200, 420], [3700, 550], [3750, 1150],
      [2500, 1300], [1200, 1200], [900, 1650], [2000, 1750],
      [3400, 1700], [3700, 2150], [3000, 2650], [1500, 2550],
      [500, 2450], [380, 1300]
    ]
  },
  {
    id: 'seaside', name: 'SEASIDE LOOP',
    ctrl: [
      [700, 550], [2100, 480], [3500, 550], [3800, 1500],
      [3450, 2450], [2700, 2350], [2300, 2550], [1700, 2350],
      [1100, 2550], [500, 2300], [400, 1400]
    ]
  },
  {
    id: 'vale', name: 'VELOCITY VALE',
    ctrl: [
      [800, 650], [2200, 500], [3600, 650], [3850, 1500],
      [3550, 2350], [2300, 2500], [1000, 2350], [550, 1900],
      [1500, 1500], [550, 1100]
    ]
  },
  {
    id: 'lakes', name: 'TWIN LAKES',
    ctrl: [
      [700, 500], [1900, 650], [3100, 450], [3700, 900],
      [3250, 1350], [2650, 1500], [3250, 1950], [3700, 2400],
      [2900, 2650], [1700, 2400], [700, 2600], [420, 2000],
      [1450, 1500], [420, 1000]
    ]
  },
  {
    id: 'rush', name: 'RUSH HOUR',
    ctrl: [
      [600, 600], [1600, 450], [2600, 700], [3600, 500],
      [3800, 1200], [3200, 1600], [3750, 2000], [3300, 2600],
      [2200, 2300], [1300, 2650], [600, 2350], [900, 1800],
      [420, 1300]
    ]
  },
  {
    id: 'trident', name: 'TRIDENT PEAK',
    ctrl: [
      [2100, 420], [3400, 900], [3750, 2100], [3100, 2650],
      [2100, 2300], [1100, 2650], [450, 2100], [800, 900]
    ]
  },
  {
    id: 'spiral', name: 'SPIRAL SPRINGS',
    ctrl: [
      [700, 500], [2400, 430], [3500, 700], [3300, 1200],
      [3750, 1700], [3350, 2300], [2400, 2600], [1900, 2100],
      [1300, 2550], [600, 2300], [420, 1350], [900, 900]
    ]
  },
  {
    id: 'midnight', name: 'MIDNIGHT GP',
    ctrl: [
      [500, 450], [1600, 550], [2700, 400], [3700, 600],
      [3800, 1350], [3350, 1200], [2900, 1500], [3500, 1800],
      [3750, 2350], [3000, 2700], [2200, 2350], [1500, 2650],
      [800, 2450], [1100, 1900], [420, 1600], [850, 1200],
      [400, 800]
    ]
  }
];
const STARTER_TRACKS = 3;
const WINS_TO_MASTER = 3;

// per-track scenery theme: buildings, ponds, trees — each circuit
// gets its own character (city, forest, lakeside...)
const SCENERY = [
  { b: 6,  p: 1, t: 70 },   // APEX GP — classic circuit
  { b: 10, p: 0, t: 40 },   // THUNDER OVAL — speedway complex
  { b: 3,  p: 2, t: 90 },   // HAIRPIN HILLS — forest
  { b: 4,  p: 2, t: 60 },   // SUNSET SPRINT
  { b: 12, p: 0, t: 30 },   // GRAND HORSESHOE — city
  { b: 2,  p: 3, t: 80 },   // CANYON RUN — wilderness
  { b: 5,  p: 4, t: 55 },   // SEASIDE LOOP — waterside
  { b: 8,  p: 1, t: 45 },   // VELOCITY VALE
  { b: 3,  p: 6, t: 65 },   // TWIN LAKES — lakes everywhere
  { b: 14, p: 0, t: 25 },   // RUSH HOUR — downtown
  { b: 4,  p: 2, t: 75 },   // TRIDENT PEAK
  { b: 6,  p: 3, t: 60 },   // SPIRAL SPRINGS
  { b: 10, p: 2, t: 50 }    // MIDNIGHT GP — night city
];

let curTrackIx = 0;
let SAMPLES = [];
let N_SAMPLES = 0;
let TRACK_DS = 1;   // average spacing between centerline samples (px)

// timing markers along the lap (for gaps + delta bar)
const MARKERS = 80;
let MARKER_LEN = 1;

function buildSamples(ctrl) {
  const out = [];
  const n = ctrl.length, PER_SEG = 44;
  for (let i = 0; i < n; i++) {
    const p0 = ctrl[(i - 1 + n) % n], p1 = ctrl[i];
    const p2 = ctrl[(i + 1) % n],     p3 = ctrl[(i + 2) % n];
    for (let j = 0; j < PER_SEG; j++) {
      const t = j / PER_SEG, t2 = t * t, t3 = t2 * t;
      const x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t +
        (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
        (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
      const y = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t +
        (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
        (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
      out.push({ x, y, dir: 0, nx: 0, ny: 0 });
    }
  }
  const N = out.length;
  for (let i = 0; i < N; i++) {
    const a = out[i], b = out[(i + 1) % N];
    a.dir = Math.atan2(b.y - a.y, b.x - a.x);
    a.nx = -Math.sin(a.dir);
    a.ny = Math.cos(a.dir);
  }
  return out;
}

function nearestSample(x, y, hint) {
  let best = hint, bestD = Infinity;
  for (let o = -40; o <= 40; o++) {
    const i = ((hint + o) % N_SAMPLES + N_SAMPLES) % N_SAMPLES;
    const s = SAMPLES[i];
    const d = (s.x - x) * (s.x - x) + (s.y - y) * (s.y - y);
    if (d < bestD) { bestD = d; best = i; }
  }
  return { idx: best, dist: Math.sqrt(bestD) };
}
function circDist(a, b) {
  const d = Math.abs(a - b) % N_SAMPLES;
  return Math.min(d, N_SAMPLES - d);
}

// ---------- Pre-rendered track canvas ----------
const trackCanvas = document.createElement('canvas');
trackCanvas.width = WORLD_W;
trackCanvas.height = WORLD_H;
function renderTrackCanvas() {
  const g = trackCanvas.getContext('2d');
  g.setLineDash([]);

  // seeded RNG so each track's scenery is unique but stable
  let seed = (curTrackIx + 1) * 1013904223 >>> 0;
  const srand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const sr = (a, b) => a + srand() * (b - a);

  // grass ground: the same endless tile as beyond the world carries the
  // whole design (dirt + mottling), so all four borders are invisible
  g.fillStyle = g.createPattern(grassTile, 'repeat');
  g.fillRect(0, 0, WORLD_W, WORLD_H);

  const path = new Path2D();
  path.moveTo(SAMPLES[0].x, SAMPLES[0].y);
  for (let i = 1; i < N_SAMPLES; i++) path.lineTo(SAMPLES[i].x, SAMPLES[i].y);
  path.closePath();

  g.lineJoin = 'round';
  g.lineCap = 'round';

  // worn brown shoulder hugging the road
  g.strokeStyle = 'rgba(124,92,52,0.40)';
  g.lineWidth = ROAD_W + 116;
  g.stroke(path);
  g.strokeStyle = 'rgba(105,76,40,0.35)';
  g.lineWidth = ROAD_W + 64;
  g.stroke(path);

  // thick ink outline, then comic yellow-and-black curbs
  g.strokeStyle = '#141216';
  g.lineWidth = ROAD_W + 36;
  g.stroke(path);
  g.strokeStyle = '#f5b93a';
  g.lineWidth = ROAD_W + 26;
  g.stroke(path);
  g.strokeStyle = '#141216';
  g.setLineDash([28, 28]);
  g.stroke(path);
  g.setLineDash([]);

  // asphalt — flat cartoon grey
  g.strokeStyle = '#8b8493';
  g.lineWidth = ROAD_W;
  g.stroke(path);

  // white edge lines
  g.strokeStyle = '#f2efe9';
  g.lineWidth = ROAD_W - 10;
  g.stroke(path);
  g.strokeStyle = '#8b8493';
  g.lineWidth = ROAD_W - 16;
  g.stroke(path);

  // rubbered-in racing groove
  g.strokeStyle = 'rgba(20,18,22,0.10)';
  g.lineWidth = 46;
  g.stroke(path);

  // start / finish checkered strip
  const s0 = SAMPLES[0];
  const cols = 3, rows = 10, sq = (ROAD_W - 16) / rows;
  g.save();
  g.translate(s0.x, s0.y);
  g.rotate(s0.dir);
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      g.fillStyle = (c + r) % 2 === 0 ? '#f2f2f2' : '#161616';
      g.fillRect(c * sq - (cols * sq) / 2, r * sq - (rows * sq) / 2, sq, sq);
    }
  }
  g.restore();

  // ---- per-track scenery (seeded, unique to each circuit) ----
  const roadDist = (x, y) => {
    let minD = Infinity;
    for (let s = 0; s < N_SAMPLES; s += 5) {
      const p = SAMPLES[s];
      const d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
      if (d < minD) minD = d;
    }
    return Math.sqrt(minD);
  };
  const theme = SCENERY[curTrackIx % SCENERY.length];

  // keep scenery pieces apart — ponds, buildings and trees never overlap
  const items = [];
  const clearOf = (x, y, rad) => {
    for (const it of items) {
      const d = Math.hypot(it.x - x, it.y - y);
      if (d < it.rad + rad + 24) return false;
    }
    return true;
  };

  // ponds
  let placed = 0;
  for (let tries = 0; tries < 120 && placed < theme.p; tries++) {
    const rx = sr(70, 150), ry = rx * sr(0.55, 0.8);
    const x = sr(rx + 40, WORLD_W - rx - 40), y = sr(ry + 40, WORLD_H - ry - 40);
    if (roadDist(x, y) < ROAD_W / 2 + rx + 44) continue;
    if (!clearOf(x, y, rx)) continue;
    items.push({ x, y, rad: rx });
    g.fillStyle = 'rgba(20,18,22,0.25)';
    g.beginPath(); g.ellipse(x + 5, y + 7, rx, ry, 0, 0, TAU); g.fill();
    g.fillStyle = '#3f7fb5';
    g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill();
    g.strokeStyle = '#141216';
    g.lineWidth = 3;
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.beginPath(); g.ellipse(x - rx * 0.25, y - ry * 0.3, rx * 0.4, ry * 0.28, 0, 0, TAU); g.fill();
    placed++;
  }

  // buildings
  const BUILD_COLS = ['#c9b8a0', '#b7643f', '#9aa3ab', '#d8cba8'];
  placed = 0;
  for (let tries = 0; tries < 320 && placed < theme.b; tries++) {
    const w = sr(70, 150), h = sr(60, 120);
    const x = sr(80, WORLD_W - 80 - w), y = sr(80, WORLD_H - 80 - h);
    if (roadDist(x + w / 2, y + h / 2) < ROAD_W / 2 + Math.max(w, h) * 0.72 + 50) continue;
    if (!clearOf(x + w / 2, y + h / 2, Math.max(w, h) * 0.72)) continue;
    items.push({ x: x + w / 2, y: y + h / 2, rad: Math.max(w, h) * 0.72 });
    g.fillStyle = 'rgba(20,18,22,0.30)';
    g.fillRect(x + 6, y + 8, w, h);
    g.fillStyle = BUILD_COLS[Math.floor(srand() * BUILD_COLS.length)];
    g.fillRect(x, y, w, h);
    g.strokeStyle = '#141216';
    g.lineWidth = 3;
    g.strokeRect(x, y, w, h);
    g.strokeStyle = 'rgba(20,18,22,0.35)';
    g.lineWidth = 2;
    g.strokeRect(x + 8, y + 8, w - 16, h - 16);
    // skylights
    g.fillStyle = 'rgba(20,18,22,0.55)';
    const wc = Math.max(1, Math.floor((w - 24) / 26));
    const hc = Math.max(1, Math.floor((h - 24) / 26));
    for (let wx = 0; wx < wc; wx++)
      for (let wy = 0; wy < hc; wy++)
        g.fillRect(x + 16 + wx * 26, y + 16 + wy * 26, 9, 9);
    placed++;
  }

  // trees / bushes
  placed = 0;
  for (let tries = 0; tries < theme.t * 5 && placed < theme.t; tries++) {
    const x = sr(100, WORLD_W - 100), y = sr(100, WORLD_H - 100);
    const r = sr(16, 34);
    if (roadDist(x, y) < ROAD_W / 2 + 90) continue;
    if (!clearOf(x, y, r)) continue;
    items.push({ x, y, rad: r });
    g.fillStyle = 'rgba(20,18,22,0.30)';
    g.beginPath(); g.ellipse(x + 6, y + 8, r, r * 0.8, 0, 0, TAU); g.fill();
    g.fillStyle = placed % 3 === 0 ? '#2e6b28' : '#3a8032';
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.strokeStyle = '#141216';
    g.lineWidth = 3;
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.20)';
    g.beginPath(); g.arc(x - r * 0.3, y - r * 0.3, r * 0.45, 0, TAU); g.fill();
    placed++;
  }

}

// ---------- Skid mark layer ----------
const skidCanvas = document.createElement('canvas');
skidCanvas.width = WORLD_W / 2;
skidCanvas.height = WORLD_H / 2;
const skidCtx = skidCanvas.getContext('2d');
skidCtx.scale(0.5, 0.5);
skidCtx.lineCap = 'round';

// ---------- Minimap ----------
const MINI_W = 240, MINI_H = 172;
const miniCanvas = document.createElement('canvas');
miniCanvas.width = MINI_W;
miniCanvas.height = MINI_H;
const MINI_SX = (MINI_W - 24) / WORLD_W;
const MINI_SY = (MINI_H - 24) / WORLD_H;
function renderMiniCanvas() {
  const g = miniCanvas.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, MINI_W, MINI_H);
  g.translate(12, 12);
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(SAMPLES[0].x * MINI_SX, SAMPLES[0].y * MINI_SY);
  for (let i = 1; i < N_SAMPLES; i += 4)
    g.lineTo(SAMPLES[i].x * MINI_SX, SAMPLES[i].y * MINI_SY);
  g.closePath();
  g.strokeStyle = '#141216';
  g.lineWidth = 9;
  g.stroke();
  g.strokeStyle = '#8b8493';
  g.lineWidth = 5;
  g.stroke();
}

// small layout thumbnails for the track-select screen (built once)
const PREV_W = 128, PREV_H = 90;
const PREVIEWS = TRACKS.map(t => {
  const s = buildSamples(t.ctrl);
  const c = document.createElement('canvas');
  c.width = PREV_W;
  c.height = PREV_H;
  const g = c.getContext('2d');
  const sx = (PREV_W - 16) / WORLD_W, sy = (PREV_H - 16) / WORLD_H;
  g.translate(8, 8);
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(s[0].x * sx, s[0].y * sy);
  for (let i = 1; i < s.length; i += 4) g.lineTo(s[i].x * sx, s[i].y * sy);
  g.closePath();
  g.strokeStyle = '#141216';
  g.lineWidth = 5;
  g.stroke();
  g.strokeStyle = '#8b8493';
  g.lineWidth = 2.5;
  g.stroke();
  return c;
});

// ---------- Progression: race wins unlock new tracks ----------
let memWins = {};
function getWins() {
  try {
    const w = JSON.parse(localStorage.getItem('apexgp_wins'));
    if (w) return w;
  } catch (e) {}
  return memWins;
}
function addWin(id) {
  const w = getWins();
  w[id] = (w[id] || 0) + 1;
  memWins = w;
  try { localStorage.setItem('apexgp_wins', JSON.stringify(w)); } catch (e) {}
  return w[id];
}
function unlockedCount() {
  const w = getWins();
  let mastered = 0;
  for (const t of TRACKS) if ((w[t.id] || 0) >= WINS_TO_MASTER) mastered++;
  return Math.min(STARTER_TRACKS + mastered, TRACKS.length);
}
function isUnlocked(ix) { return ix < unlockedCount(); }

// champion: at least one race win on every single track
function isChampion() {
  const w = getWins();
  return TRACKS.every(t => (w[t.id] || 0) >= 1);
}
let championNow = false;   // this very race completed the set

// swap the whole world over to another circuit
function loadTrack(ix) {
  curTrackIx = ix;
  SAMPLES = buildSamples(TRACKS[ix].ctrl);
  N_SAMPLES = SAMPLES.length;
  MARKER_LEN = N_SAMPLES / MARKERS;
  let per = 0;
  for (let i = 0; i < N_SAMPLES; i++) {
    const a = SAMPLES[i], b = SAMPLES[(i + 1) % N_SAMPLES];
    per += Math.hypot(b.x - a.x, b.y - a.y);
  }
  TRACK_DS = per / N_SAMPLES;
  renderTrackCanvas();
  renderMiniCanvas();
  skidCtx.clearRect(0, 0, WORLD_W, WORLD_H);
  try { localStorage.setItem('apexgp_lastTrack', String(ix)); } catch (e) {}
}

function cycleTrack(d) {
  let ix = curTrackIx;
  do { ix = (ix + d + TRACKS.length) % TRACKS.length; } while (!isUnlocked(ix));
  loadTrack(ix);
  startRace();
  state = 'menu';
  beep(520, 0.08, 0.15);
}

// ---------- AI difficulty ----------
// skills: pace multipliers for the three rivals
// corner: how much curvature slows them (lower = braver in corners)
// rubber: max rubber-band strength keeping the field close to the player
// Tuned via headless lap-time simulation on APEX GP so the fastest AI lap
// lands in: LEGEND 22-23s, PRO 24-25s, ROOKIE 26-28s.
// bravery: fraction of the physically possible corner speed they use
// steerMul: AI steering-authority bonus  ·  mistake: bobble chance per window
const DIFFS = [
  { id: 'rookie', name: 'ROOKIE', color: '#4e9b3f', skills: [0.94, 0.92, 0.90], bravery: 0.86, steerMul: 1.08, rubber: 0,     mistake: 0.35 },
  { id: 'pro',    name: 'PRO',    color: '#f5b93a', skills: [0.97, 0.96, 0.95], bravery: 0.93, steerMul: 1.20, rubber: 0.035, mistake: 0.15 },
  { id: 'legend', name: 'LEGEND', color: '#e8542f', skills: [1.00, 0.99, 0.98], bravery: 0.98, steerMul: 1.52, rubber: 0.055, mistake: 0.04 }
];
let curDiffIx = 1;
try {
  const d = parseInt(localStorage.getItem('apexgp_diff'), 10);
  if (d >= 0 && d < DIFFS.length) curDiffIx = d;
} catch (e) {}

function cycleDiff(d) {
  curDiffIx = (curDiffIx + d + DIFFS.length) % DIFFS.length;
  try { localStorage.setItem('apexgp_diff', String(curDiffIx)); } catch (e) {}
  beep(640, 0.08, 0.15);
}

// ---------- Kart colours ----------
const KART_COLORS = [
  ['#f5b93a', '#c78d16'], ['#22a7d9', '#146f94'], ['#e8542f', '#a83318'],
  ['#4e9b3f', '#2f6b26'], ['#6f2da8', '#4a1c73'], ['#e668b5', '#a83b7d'],
  ['#f2efe9', '#b8b2a6'], ['#33343c', '#141216']
];
let kartColorIx = 0;
try {
  const kc = parseInt(localStorage.getItem('apexgp_color'), 10);
  if (kc >= 0 && kc < KART_COLORS.length) kartColorIx = kc;
} catch (e) {}

function setKartColor(i) {
  kartColorIx = i;
  try { localStorage.setItem('apexgp_color', String(i)); } catch (e) {}
  beep(760, 0.07, 0.15);
  startRace();          // repaint the parked grid with the new colour
  state = 'menu';
}

// ---------- Endless grass tile ----------
// Carries the whole ground design (dirt smudges + mottling + noise),
// drawn wrap-around so it tiles seamlessly — the same design continues
// across all four world borders and beyond, forever.
const grassTile = document.createElement('canvas');
grassTile.width = 1024;
grassTile.height = 1024;
(function renderGrassTile() {
  const S = 1024;
  const g = grassTile.getContext('2d');
  g.fillStyle = '#57a04b';
  g.fillRect(0, 0, S, S);
  let seed = 77;
  const tr = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  // draw each blob 9 times so shapes crossing an edge wrap to the other side
  const wrap = (x, y, fn) => {
    for (const dx of [-S, 0, S])
      for (const dy of [-S, 0, S])
        fn(x + dx, y + dy);
  };
  // large brown dirt smudges
  for (let i = 0; i < 5; i++) {
    const x = tr() * S, y = tr() * S;
    const r = 90 + tr() * 130, ry = r * (0.4 + tr() * 0.3), a = tr() * TAU;
    g.fillStyle = tr() < 0.5 ? 'rgba(139,105,58,0.28)' : 'rgba(110,82,44,0.22)';
    wrap(x, y, (px, py) => {
      g.beginPath();
      g.ellipse(px, py, r, ry, a, 0, TAU);
      g.fill();
    });
  }
  // grass mottling
  for (let i = 0; i < 150; i++) {
    const x = tr() * S, y = tr() * S;
    const r = 18 + tr() * 62, a = tr() * TAU;
    g.fillStyle = tr() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(25,60,20,0.08)';
    wrap(x, y, (px, py) => {
      g.beginPath();
      g.ellipse(px, py, r, r * 0.6, a, 0, TAU);
      g.fill();
    });
  }
  // fine per-pixel noise (tiles by nature)
  const img = g.getImageData(0, 0, S, S);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 12;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
})();
let grassPattern = null;

// ---------- Print-grain overlay (static, like risograph paper) ----------
const grainCanvas = document.createElement('canvas');
grainCanvas.width = 160;
grainCanvas.height = 160;
(function renderGrain() {
  const g = grainCanvas.getContext('2d');
  const img = g.createImageData(160, 160);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() < 0.5 ? 0 : 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = Math.random() * 26;
  }
  g.putImageData(img, 0, 0);
})();
let grainPattern = null;

// ---------- Input ----------
const keys = {};
window.addEventListener('keydown', e => {
  if (saveOverlay || soundOverlay) return;   // a dialog owns the keyboard
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key))
    e.preventDefault();
  keys[e.key.toLowerCase()] = true;
  initAudio();
  if (state === 'welcome') return;
  if (e.key === 'Enter') onEnter();
  if (e.key.toLowerCase() === 'r') startRace();
  if (e.key.toLowerCase() === 'm') toggleMute();
  if (e.key.toLowerCase() === 'c' && state === 'menu') showSaveDialog();
  if (e.key.toLowerCase() === 'g' && state === 'menu') toggleMode();
  if (e.key.toLowerCase() === 'o' && state === 'menu') showSoundDialog();
  if (state === 'menu' && (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a')) cycleTrack(-1);
  if (state === 'menu' && (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd')) cycleTrack(1);
  if (state === 'menu' && (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w')) cycleDiff(1);
  if (state === 'menu' && (e.key === 'ArrowDown' || e.key.toLowerCase() === 's')) cycleDiff(-1);
  if (e.key.toLowerCase() === 't' && (state === 'menu' || state === 'tracks')) {
    trackSel = curTrackIx;
    state = state === 'menu' ? 'tracks' : 'menu';
  }
  if (state === 'tracks') {
    const k = e.key.toLowerCase();
    if (e.key === 'ArrowLeft' || k === 'a') trackSel = (trackSel + TRACKS.length - 1) % TRACKS.length;
    if (e.key === 'ArrowRight' || k === 'd') trackSel = (trackSel + 1) % TRACKS.length;
    if (e.key === 'ArrowUp' || k === 'w') trackSel = (trackSel - tracksCols + TRACKS.length) % TRACKS.length;
    if (e.key === 'ArrowDown' || k === 's') trackSel = (trackSel + tracksCols) % TRACKS.length;
  }
  if (e.key === 'Escape' && state !== 'menu') {
    if (state !== 'tracks') startRace();
    state = 'menu';
  }
});
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
window.addEventListener('pointerdown', e => {
  initAudio();
  if (e.pointerType === 'mouse') handleTap(e.clientX, e.clientY);
});

// ---------- Touch controls ----------
const IS_TOUCH = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
const touchCtl = { left: false, right: false, gas: false, brake: false, drift: false };
let touchButtons = [];
let menuBtn = null;

function updateTouchButtons(compact) {
  const r = Math.max(32, Math.min(46, VW * 0.055));
  const m = 12;
  // on wide touchscreens lift the buttons above the bottom HUD panels
  const by = compact ? VH - m - r : VH - 126 - m - r;
  touchButtons = [
    { id: 'left',  x: m + r,                  y: by, r },
    { id: 'right', x: m + r * 3 + 18,         y: by, r },
    { id: 'brake', x: VW - m - r * 3 - 18,    y: by, r },
    { id: 'gas',   x: VW - m - r,             y: by, r }
  ];
  // exit-to-menu button: on phones it sits beside the delta bar (top),
  // on big touchscreens above the left steering pair
  menuBtn = compact
    ? { x: 28, y: 84, r: 17, label: false }
    : { x: m + r, y: by - r * 1.9 - 12, r: Math.round(r * 0.6), label: true };
}

function readTouches(e) {
  for (const k in touchCtl) touchCtl[k] = false;
  for (const t of e.touches) {
    for (const b of touchButtons) {
      const dx = t.clientX - b.x, dy = t.clientY - b.y;
      if (dx * dx + dy * dy < (b.r + 16) * (b.r + 16)) touchCtl[b.id] = true;
    }
  }
}
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  initAudio();
  readTouches(e);
  const t = e.changedTouches[0];
  if (t) handleTap(t.clientX, t.clientY);
}, { passive: false });
canvas.addEventListener('touchmove', e => { e.preventDefault(); readTouches(e); }, { passive: false });
canvas.addEventListener('touchend', e => { e.preventDefault(); readTouches(e); }, { passive: false });
canvas.addEventListener('touchcancel', e => { readTouches(e); });

// taps drive the menus (mouse clicks and touches alike)
let menuGeo = null;
function handleTap(x, y) {
  if (saveOverlay || soundOverlay) return;   // a dialog owns the screen
  if (state === 'welcome') return;
  if (state === 'racing' || state === 'countdown') {
    // on-screen menu button (phones)
    if (menuBtn) {
      const dx = x - menuBtn.x, dy = y - menuBtn.y;
      if (dx * dx + dy * dy < (menuBtn.r + 12) * (menuBtn.r + 12)) {
        startRace();
        state = 'menu';
      }
    }
    return;
  }
  if (state === 'menu') {
    // pill row: save / sound / mode
    for (const p of menuPills) {
      if (x >= p.x - 4 && x <= p.x + p.w + 6 && y >= p.y - 6 && y <= p.y + p.h + 8) {
        if (p.id === 'save') showSaveDialog();
        else if (p.id === 'sound') showSoundDialog();
        else if (p.id === 'mode') toggleMode();
        return;
      }
    }
    const g = menuGeo;
    if (g && x > g.cx && x < g.cx + g.cw && y > g.cy && y < g.cy + g.ch) {
      if (y < g.cy + 34) {          // header row -> full track map
        trackSel = curTrackIx;
        state = 'tracks';
        return;
      }
      const trackRowY = y > g.cy + 34 && y < g.cy + (g.compact ? 68 : 76);
      const diffRowY = y > g.cy + (g.compact ? 68 : 76) && y < g.cy + (g.compact ? 100 : 112);
      if (trackRowY) {
        if (x < g.cx + g.cw * 0.4) return cycleTrack(-1);
        if (x > g.cx + g.cw * 0.6) return cycleTrack(1);
      }
      if (diffRowY) return cycleDiff(1);
      if (Math.abs(y - g.swY) < 17) {
        const i = Math.round((x - g.swX0) / g.swGap);
        if (i >= 0 && i < KART_COLORS.length) return setKartColor(i);
      }
      return;              // dead area of the card
    }
    onEnter();
  } else if (state === 'tracks') {
    // back zone (top-left)
    if (y < 52 && x < 170) { state = 'menu'; return; }
    const g = tracksGeo;
    if (!g) return;
    const col = Math.floor((x - g.x0) / (g.cardW + g.gap));
    const row = Math.floor((y - g.y0) / (g.cardH + g.gap));
    if (col < 0 || col >= g.cols || row < 0) return;
    const inCardX = x - g.x0 - col * (g.cardW + g.gap) <= g.cardW;
    const inCardY = y - g.y0 - row * (g.cardH + g.gap) <= g.cardH;
    const ix = row * g.cols + col;
    if (inCardX && inCardY && ix < TRACKS.length) {
      trackSel = ix;
      onEnter();
    }
  } else if (state === 'finished') {
    // small zone on the "choose another track" line goes back to the menu
    if (Math.abs(y - (VH * 0.78 + 24)) < 28) { startRace(); state = 'menu'; return; }
    onEnter();
  }
}

// ---------- Audio ----------
let AC = null, masterGain = null, muted = false;
let engineOsc = null, engineOsc2 = null, engineGain = null, engineFilter = null;
let skidGain = null, sfxGain = null;
let musicGain = null, musicDelay = null, noiseBuf = null;

// user volume settings (0..1), persisted
let musicVol = 1, sfxVol = 1;
try {
  const v = JSON.parse(localStorage.getItem('apexgp_vol'));
  if (v) {
    if (typeof v.m === 'number') musicVol = clamp(v.m, 0, 1);
    if (typeof v.s === 'number') sfxVol = clamp(v.s, 0, 1);
  }
} catch (e) {}
function saveVol() {
  try { localStorage.setItem('apexgp_vol', JSON.stringify({ m: musicVol, s: sfxVol })); } catch (e) {}
}
function applyVolumes() {
  if (musicGain) musicGain.gain.value = 0.24 * musicVol;
  if (sfxGain) sfxGain.gain.value = sfxVol;
  // in-race music sits well under the engine; menu music plays at full level
  if (musicAudio) {
    const duck = musicCtx === 'race' ? 0.2 : 1;
    musicAudio.volume = muted ? 0 : clamp(0.8 * musicVol * duck, 0, 1);
  }
}

// ---------- Streamed soundtrack ----------
// menu.m4a loops on the menus; the three race tracks cycle during races,
// each starting when the previous one ends. The procedural synth loop
// stays as automatic fallback anywhere the files can't load.
const MUSIC_TRACKS = [
  'music/advance-turbo.mp3',
  'music/pixel-redline.mp3',
  'music/handheld-grand-prix.mp3'
];
const MENU_TRACK = 'music/menu.m4a';
let musicAudio = null, musicTrackIx = 0, streamMusicOk = false, musicCtx = 'menu';

function musicCtxWanted() {
  return (state === 'countdown' || state === 'racing' || state === 'finished')
    ? 'race' : 'menu';
}

function startStreamMusic() {
  if (musicAudio) return;
  musicAudio = new Audio();
  musicAudio.preload = 'auto';
  musicAudio.onplaying = () => { streamMusicOk = true; };
  musicAudio.onended = () => {
    if (musicCtx !== 'race') return;
    musicTrackIx = (musicTrackIx + 1) % MUSIC_TRACKS.length;
    musicAudio.src = MUSIC_TRACKS[musicTrackIx];
    applyVolumes();
    musicAudio.play().catch(() => {});
  };
  musicAudio.onerror = () => { streamMusicOk = false; };
  musicCtx = musicCtxWanted();
  musicAudio.loop = musicCtx === 'menu';
  musicAudio.src = musicCtx === 'menu' ? MENU_TRACK : MUSIC_TRACKS[musicTrackIx];
  applyVolumes();
  musicAudio.play().catch(() => { streamMusicOk = false; });
}

// swap between the menu loop and the race playlist as the state changes;
// every new race start advances to the next song in the rotation
let musicPrevState = '';
function updateMusicContext() {
  if (!musicAudio) return;
  const enteringRace = state === 'countdown' && musicPrevState !== 'countdown';
  musicPrevState = state;
  const want = musicCtxWanted();
  if (enteringRace) {
    musicTrackIx = (musicTrackIx + 1) % MUSIC_TRACKS.length;
    musicCtx = 'race';
    musicAudio.loop = false;
    musicAudio.src = MUSIC_TRACKS[musicTrackIx];
    applyVolumes();
    musicAudio.play().catch(() => {});
    return;
  }
  if (want === musicCtx) return;
  musicCtx = want;
  musicAudio.loop = want === 'menu';
  musicAudio.src = want === 'menu' ? MENU_TRACK : MUSIC_TRACKS[musicTrackIx];
  applyVolumes();
  musicAudio.play().catch(() => {});
}

function initAudio() {
  // if the browser blocked music autoplay at load, first gesture unblocks it
  if (musicAudio && musicAudio.paused) musicAudio.play().catch(() => {});
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) { return; }
  masterGain = AC.createGain();
  masterGain.gain.value = 0.6;
  masterGain.connect(AC.destination);

  // all non-music sound routes through sfxGain so the slider scales it
  sfxGain = AC.createGain();
  sfxGain.connect(masterGain);

  engineFilter = AC.createBiquadFilter();
  engineFilter.type = 'lowpass';
  engineFilter.frequency.value = 420;
  engineGain = AC.createGain();
  engineGain.gain.value = 0.0;
  engineOsc = AC.createOscillator();
  engineOsc.type = 'sawtooth';
  engineOsc2 = AC.createOscillator();
  engineOsc2.type = 'square';
  engineOsc.connect(engineFilter);
  engineOsc2.connect(engineFilter);
  engineFilter.connect(engineGain);
  engineGain.connect(sfxGain);
  engineOsc.start();
  engineOsc2.start();

  const len = AC.sampleRate * 1;
  noiseBuf = AC.createBuffer(1, len, AC.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const noise = AC.createBufferSource();
  noise.buffer = noiseBuf;
  noise.loop = true;
  const bp = AC.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 900;
  bp.Q.value = 0.8;
  skidGain = AC.createGain();
  skidGain.gain.value = 0;
  noise.connect(bp);
  bp.connect(skidGain);
  skidGain.connect(sfxGain);
  noise.start();

  // music bus: everything routes through musicGain, with a synced echo
  // on the arp for that synthwave feel
  musicGain = AC.createGain();
  musicGain.gain.value = 0.24;
  musicGain.connect(masterGain);
  musicDelay = AC.createDelay(1);
  musicDelay.delayTime.value = (60 / MUSIC_BPM / 4) * 3;   // dotted-8th echo
  const fb = AC.createGain();
  fb.gain.value = 0.3;
  musicDelay.connect(fb);
  fb.connect(musicDelay);
  musicDelay.connect(musicGain);
  applyVolumes();
  startStreamMusic();
}

// ---------- Procedural background music (original, no samples) ----------
const MUSIC_BPM = 124;
let musicTime = 0, musicStep = 0;
const midi = m => 440 * Math.pow(2, (m - 69) / 12);
// Am - F - C - G, one bar each, 16 sixteenth-steps per bar
const BAR_ROOTS = [45, 41, 48, 43];
const ARP_PAT = [0, 7, 12, 15, 19, 15, 12, 7];
// melody slots (one per quarter beat across 4 bars), -1 = rest
const LEAD_PAT = [12, -1, 15, -1, 19, -1, 17, 15, 10, -1, 12, -1, 17, 15, 12, -1];

function mKick(t) {
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
  g.gain.setValueAtTime(0.6, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
  o.connect(g); g.connect(musicGain);
  o.start(t); o.stop(t + 0.18);
}
function mNoiseHit(t, filterType, freq, vol, dur) {
  const s = AC.createBufferSource();
  s.buffer = noiseBuf;
  const f = AC.createBiquadFilter();
  f.type = filterType;
  f.frequency.value = freq;
  const g = AC.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(musicGain);
  s.start(t); s.stop(t + dur + 0.02);
}
function mBass(t, m, dur) {
  const o = AC.createOscillator(), g = AC.createGain();
  const f = AC.createBiquadFilter();
  o.type = 'square';
  o.frequency.value = midi(m);
  f.type = 'lowpass';
  f.frequency.value = 420;
  g.gain.setValueAtTime(0.22, t);
  g.gain.setValueAtTime(0.22, t + dur * 0.6);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(f); f.connect(g); g.connect(musicGain);
  o.start(t); o.stop(t + dur + 0.02);
}
function mLead(t, m, dur) {
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = 'triangle';
  o.frequency.value = midi(m);
  g.gain.setValueAtTime(0.11, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g);
  g.connect(musicGain);
  g.connect(musicDelay);
  o.start(t); o.stop(t + dur + 0.02);
}
function mArp(t, m, dur) {
  const o = AC.createOscillator(), g = AC.createGain();
  const f = AC.createBiquadFilter();
  o.type = 'sawtooth';
  o.frequency.value = midi(m);
  f.type = 'lowpass';
  f.frequency.value = 2400;
  g.gain.setValueAtTime(0.07, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(f); f.connect(g);
  g.connect(musicGain);
  g.connect(musicDelay);
  o.start(t); o.stop(t + dur + 0.02);
}

function scheduleMusic() {
  if (streamMusicOk) return;   // real soundtrack is playing
  if (!AC || !musicGain || AC.state !== 'running') return;
  const stepDur = 60 / MUSIC_BPM / 4;
  if (musicTime < AC.currentTime) musicTime = AC.currentTime + 0.05;
  const racing = state === 'racing' || state === 'countdown';
  while (musicTime < AC.currentTime + 0.15) {
    const s = musicStep, t = musicTime;
    const root = BAR_ROOTS[Math.floor(s / 16) % 4];
    // drums only once the race is on
    if (racing) {
      if (s % 4 === 0) mKick(t);
      if (s % 8 === 4) mNoiseHit(t, 'bandpass', 1800, 0.25, 0.12);   // snare
      if (s % 2 === 1) mNoiseHit(t, 'highpass', 7000, 0.06, 0.04);   // hat
    }
    if (s % 2 === 0) mBass(t, root + (s % 16 === 14 ? 12 : 0), stepDur * 1.8);
    if (racing || s % 2 === 0) mArp(t, root + 12 + ARP_PAT[s % 8], stepDur * 0.9);
    // singable lead line on the quarter beats
    if (s % 4 === 0) {
      const n = LEAD_PAT[(s / 4) % LEAD_PAT.length];
      if (n >= 0) mLead(t, root + 12 + n, stepDur * 3.2);
    }
    musicTime += stepDur;
    musicStep = (musicStep + 1) % 64;
  }
}
function toggleMute() {
  muted = !muted;
  if (masterGain) masterGain.gain.value = muted ? 0 : 0.6;
  applyVolumes();
}
function beep(freq, dur, vol) {
  if (!AC || muted) return;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = 'triangle';
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol, AC.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + dur);
  o.connect(g); g.connect(sfxGain || masterGain);
  o.start();
  o.stop(AC.currentTime + dur);
}

// ---------- Gearbox ----------
// speed boundaries (px/s) for the 6-speed auto
// top speed: 500 px/s = 80 km/h on the speedo
const VMAX = 500;
const GEARS = [0, 60, 122, 186, 262, 350, 505];
function gearOf(spd) {
  for (let i = 1; i < GEARS.length; i++) {
    if (spd <= GEARS[i]) {
      const frac = (spd - GEARS[i - 1]) / (GEARS[i] - GEARS[i - 1]);
      return { gear: i, rpm: clamp(0.15 + 0.85 * frac, 0, 1) };
    }
  }
  return { gear: 6, rpm: 1 };
}

// ---------- High scores (per track, kept in localStorage) ----------
const memHS = {};   // fallback when storage is blocked (e.g. sandboxed iframe)
function getHSFor(id) {
  try {
    const v = JSON.parse(localStorage.getItem('apexgp_hs_' + id));
    if (v) return v;
  } catch (e) {}
  return memHS[id] || {};
}
function getHS() { return getHSFor(TRACKS[curTrackIx].id); }
function saveHS(hs) {
  const id = TRACKS[curTrackIx].id;
  memHS[id] = hs;
  try { localStorage.setItem('apexgp_hs_' + id, JSON.stringify(hs)); } catch (e) {}
}
let newLapRecord = false, newRaceRecord = false;

// ---------- Save codes: export/import all progress ----------
function collectProgress() {
  const h = {};
  for (const t of TRACKS) {
    const hs = getHSFor(t.id);
    if (hs.bestLap !== undefined || hs.bestRace !== undefined)
      h[t.id] = { l: hs.bestLap, r: hs.bestRace };
  }
  return { v: 1, w: getWins(), h, d: curDiffIx };
}

function exportCode() {
  return 'APEX1.' + btoa(JSON.stringify(collectProgress()));
}

// merge imported progress with local, always keeping the better value
function importCode(code) {
  try {
    code = (code || '').trim();
    if (!code.startsWith('APEX1.')) return false;
    const data = JSON.parse(atob(code.slice(6)));
    if (!data || data.v !== 1) return false;
    const wins = getWins();
    for (const id in (data.w || {}))
      wins[id] = Math.max(wins[id] || 0, data.w[id] | 0);
    memWins = wins;
    try { localStorage.setItem('apexgp_wins', JSON.stringify(wins)); } catch (e) {}
    for (const id in (data.h || {})) {
      const cur = getHSFor(id);
      const inc = data.h[id] || {};
      const merged = {};
      const lap = cur.bestLap === undefined ? inc.l
        : (inc.l === undefined ? cur.bestLap : Math.min(cur.bestLap, inc.l));
      const race = cur.bestRace === undefined ? inc.r
        : (inc.r === undefined ? cur.bestRace : Math.min(cur.bestRace, inc.r));
      if (lap !== undefined) merged.bestLap = lap;
      if (race !== undefined) merged.bestRace = race;
      memHS[id] = merged;
      try { localStorage.setItem('apexgp_hs_' + id, JSON.stringify(merged)); } catch (e) {}
    }
    if (typeof data.d === 'number' && data.d >= 0 && data.d < DIFFS.length) {
      curDiffIx = data.d;
      try { localStorage.setItem('apexgp_diff', String(curDiffIx)); } catch (e) {}
    }
    return true;
  } catch (e) {
    return false;
  }
}

// DOM dialog: shows your code, copies it, and accepts a pasted one
let saveOverlay = null;
function showSaveDialog() {
  if (saveOverlay) { saveOverlay.remove(); saveOverlay = null; }
  const div = document.createElement('div');
  div.style.cssText = 'position:fixed;inset:0;background:rgba(18,36,14,0.78);' +
    'display:flex;align-items:center;justify-content:center;z-index:10;' +
    "font-family:'Segoe UI',sans-serif;";
  div.innerHTML =
    '<div style="background:#f2efe9;border:3px solid #141216;border-radius:14px;' +
    'box-shadow:6px 7px 0 #141216;max-width:440px;width:92%;padding:18px;color:#141216;">' +
    '<div style="font-weight:900;font-size:20px;margin-bottom:8px;">💾 SAVE CODE</div>' +
    '<div style="font-size:13px;margin-bottom:6px;">Copy this code to back up your progress ' +
    '(wins, unlocks, records, difficulty) — or paste a code from another device and press LOAD.</div>' +
    '<textarea id="apexSaveTa" spellcheck="false" style="width:100%;height:96px;' +
    'font-family:monospace;font-size:11px;border:2px solid #141216;border-radius:8px;' +
    'padding:6px;box-sizing:border-box;background:#fff;color:#141216;' +
    'user-select:text;-webkit-user-select:text;"></textarea>' +
    '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">' +
    '<button id="apexCopyBtn" style="flex:1;min-width:96px;padding:10px;font-weight:800;' +
    'background:#4e9b3f;color:#fff;border:2px solid #141216;border-radius:8px;cursor:pointer;">COPY</button>' +
    '<button id="apexLoadBtn" style="flex:1;min-width:96px;padding:10px;font-weight:800;' +
    'background:#f5b93a;color:#141216;border:2px solid #141216;border-radius:8px;cursor:pointer;">LOAD</button>' +
    '<button id="apexCloseBtn" style="flex:1;min-width:80px;padding:10px;font-weight:800;' +
    'background:#e8542f;color:#fff;border:2px solid #141216;border-radius:8px;cursor:pointer;">CLOSE</button>' +
    '</div>' +
    '<div id="apexSaveMsg" style="font-size:13px;font-weight:700;margin-top:8px;min-height:17px;"></div>' +
    '</div>';
  document.body.appendChild(div);
  saveOverlay = div;
  const ta = div.querySelector('#apexSaveTa');
  const msg = div.querySelector('#apexSaveMsg');
  ta.value = exportCode();
  div.querySelector('#apexCopyBtn').onclick = () => {
    ta.value = exportCode();
    ta.select();
    ta.setSelectionRange(0, 999999);
    try { document.execCommand('copy'); } catch (e) {}
    if (navigator.clipboard) navigator.clipboard.writeText(ta.value).catch(() => {});
    msg.textContent = 'Copied! Paste it on your other device.';
    msg.style.color = '#2f6b26';
  };
  div.querySelector('#apexLoadBtn').onclick = () => {
    if (importCode(ta.value)) {
      msg.textContent = 'Progress loaded — wins, unlocks and records merged in.';
      msg.style.color = '#2f6b26';
      beep(880, 0.3, 0.2);
    } else {
      msg.textContent = 'That does not look like a valid save code.';
      msg.style.color = '#a83318';
    }
  };
  div.querySelector('#apexCloseBtn').onclick = () => {
    div.remove();
    saveOverlay = null;
  };
}

// DOM dialog: music / effects volume sliders
let soundOverlay = null;
function showSoundDialog() {
  initAudio();
  if (soundOverlay) { soundOverlay.remove(); soundOverlay = null; }
  const div = document.createElement('div');
  div.style.cssText = 'position:fixed;inset:0;background:rgba(18,36,14,0.78);' +
    'display:flex;align-items:center;justify-content:center;z-index:10;' +
    "font-family:'Segoe UI',sans-serif;";
  div.innerHTML =
    '<div style="background:#f2efe9;border:3px solid #141216;border-radius:14px;' +
    'box-shadow:6px 7px 0 #141216;max-width:380px;width:88%;padding:18px;color:#141216;">' +
    '<div style="font-weight:900;font-size:20px;margin-bottom:14px;">🔊 SOUND</div>' +
    '<label style="font-weight:700;font-size:14px;">🎵 Music &nbsp;<span id="apexMV"></span>%</label>' +
    '<input id="apexMusicR" type="range" min="0" max="100" style="width:100%;margin:8px 0 18px;">' +
    '<label style="font-weight:700;font-size:14px;">🏎️ Effects &nbsp;<span id="apexSV"></span>%</label>' +
    '<input id="apexSfxR" type="range" min="0" max="100" style="width:100%;margin:8px 0 18px;">' +
    '<button id="apexSndClose" style="width:100%;padding:10px;font-weight:800;' +
    'background:#4e9b3f;color:#fff;border:2px solid #141216;border-radius:8px;cursor:pointer;">DONE</button>' +
    '</div>';
  document.body.appendChild(div);
  soundOverlay = div;
  const mr = div.querySelector('#apexMusicR'), sr2 = div.querySelector('#apexSfxR');
  const mv = div.querySelector('#apexMV'), sv = div.querySelector('#apexSV');
  mr.value = Math.round(musicVol * 100);
  sr2.value = Math.round(sfxVol * 100);
  mv.textContent = mr.value;
  sv.textContent = sr2.value;
  mr.oninput = () => {
    musicVol = mr.value / 100;
    mv.textContent = mr.value;
    saveVol();
    applyVolumes();
  };
  sr2.oninput = () => {
    sfxVol = sr2.value / 100;
    sv.textContent = sr2.value;
    saveVol();
    applyVolumes();
    beep(660, 0.1, 0.2);
  };
  div.querySelector('#apexSndClose').onclick = () => {
    div.remove();
    soundOverlay = null;
  };
}

// ---------- Cars ----------
const TOTAL_LAPS = 3;
const ORDINAL = ['1st', '2nd', '3rd', '4th'];

function makeCar(name, color, accent, isPlayer, gridSlot, skill) {
  const back = 60 + gridSlot * 52;
  const side = (gridSlot % 2 === 0 ? -1 : 1) * ROAD_W * 0.22;
  const s0 = SAMPLES[0];
  const bx = s0.x - Math.cos(s0.dir) * back + s0.nx * side;
  const by = s0.y - Math.sin(s0.dir) * back + s0.ny * side;
  const idx = nearestSample(bx, by, 0).idx;
  return {
    name, color, accent, isPlayer, skill,
    steerMul: 1,
    x: bx, y: by, angle: s0.dir,
    vx: 0, vy: 0,
    steer: 0, throttleSm: 0,
    idx,
    prevAlong: -back,
    cpNext: 1, lap: 0,
    lapStart: 0, bestLap: null, lastLap: null, finishTime: null,
    offTrack: false, drifting: false, draft: false,
    laneOffset: isPlayer ? 0 : rand(-0.18, 0.18),
    mistakeT: 0, mistakeCd: rand(3, 8), mistakeSteer: 0,
    prevRL: null, prevRR: null,
    aiSpeedJitter: 1,
    // timing
    markerTimes: new Map(),
    lastAbsM: Math.floor(idx / MARKER_LEN),
    gear: 1, rpm: 0
  };
}

let cars = [];
let player = null;

// ---------- Game state ----------
let state = 'menu';            // welcome | menu | tracks | countdown | racing | finished
let welcomeT = 0;              // seconds spent on the welcome screen
let gameMode = 'race';         // race (3-lap GP) | trial (time trial vs ghost)
let menuPills = [];            // tappable pills on the menu (save/sound/mode)

// time-trial ghost: best-lap replay per track, sampled at 20 Hz
let ghost = null;              // { t: lapTime, d: [x, y, angle, ...] }
let ghostRec = [];
let ghostLastT = -1;

function toggleMode() {
  gameMode = gameMode === 'race' ? 'trial' : 'race';
  beep(700, 0.08, 0.15);
  startRace();
  state = 'menu';
}
let trackSel = 0;              // highlighted card on the track-select screen
let tracksCols = 4;
let tracksGeo = null;
let tracksMsg = 0;             // timestamp until which the "locked" hint shows
let unlockMsg = null;          // name of a track unlocked by the last win
let raceClock = 0;
let countT = 0;
let lastBeepAt = -1;
let camX = 0, camY = 0, camZoom = 1, shake = 0;
let particles = [];
let flashMsg = null;

// player timing extras
let bestTrace = null;          // Float32Array per marker, from best lap
let curTrace = new Float32Array(MARKERS);
let deltaDisplay = 0, deltaValid = false;
let prevSector = 0, sectorStartClock = 0;
let sectorLast = [null, null, null];
let sectorBest = [null, null, null];
let sectorFlash = [0, 0, 0];   // seconds remaining of green highlight

function startRace() {
  const sk = DIFFS[curDiffIx].skills;
  const pc = KART_COLORS[kartColorIx];
  if (gameMode === 'trial') {
    // time trial: just you and the ghost of your best lap
    cars = [makeCar('YOU', pc[0], pc[1], true, 0, 1)];
    ghost = null;
    try {
      const gs = JSON.parse(localStorage.getItem('apexgp_ghost_' + TRACKS[curTrackIx].id));
      if (gs && gs.t && Array.isArray(gs.d)) ghost = gs;
    } catch (e) {}
  } else {
    // rivals take distinct colours that avoid the player's pick
    const pool = [2, 3, 4, 0, 1, 5].filter(i => i !== kartColorIx);
    cars = [
      makeCar('YOU',   pc[0], pc[1], true, 0, 1),
      makeCar('VIPER', KART_COLORS[pool[0]][0], KART_COLORS[pool[0]][1], false, 1, sk[0]),
      makeCar('BOLT',  KART_COLORS[pool[1]][0], KART_COLORS[pool[1]][1], false, 2, sk[1]),
      makeCar('GHOST', KART_COLORS[pool[2]][0], KART_COLORS[pool[2]][1], false, 3, sk[2])
    ];
  }
  for (const c of cars) if (!c.isPlayer) c.steerMul = DIFFS[curDiffIx].steerMul;
  ghostRec = [];
  ghostLastT = -1;
  player = cars[0];
  skidCtx.clearRect(0, 0, WORLD_W, WORLD_H);
  particles = [];
  raceClock = 0;
  countT = 3.6;
  lastBeepAt = -1;
  state = 'countdown';
  flashMsg = null;
  camX = player.x; camY = player.y;
  bestTrace = null;
  curTrace = new Float32Array(MARKERS);
  deltaDisplay = 0; deltaValid = false;
  prevSector = 2; sectorStartClock = 0;
  sectorLast = [null, null, null];
  sectorBest = [null, null, null];
  sectorFlash = [0, 0, 0];
  newLapRecord = false;
  newRaceRecord = false;
  unlockMsg = null;
  championNow = false;
}

function nextUnlockedTrack() {
  let ix = curTrackIx;
  do { ix = (ix + 1) % TRACKS.length; } while (!isUnlocked(ix));
  return ix;
}

function onEnter() {
  if (state === 'tracks') {
    if (isUnlocked(trackSel)) {
      loadTrack(trackSel);
      startRace();
    } else {
      tracksMsg = performance.now() + 2200;
      beep(180, 0.15, 0.2);
    }
    return;
  }
  if (state === 'finished') {
    // move on to the next unlocked circuit for the next race
    loadTrack(nextUnlockedTrack());
    startRace();
    return;
  }
  if (state === 'menu') startRace();
}

// ---------- Physics ----------
function stepCar(car, dt, throttle, brake, steerInput, handbrake) {
  const cos = Math.cos(car.angle), sin = Math.sin(car.angle);
  let vF = car.vx * cos + car.vy * sin;
  let vL = -car.vx * sin + car.vy * cos;

  // keyboard assist: throttle ramps in, releases fast
  car.throttleSm = throttle > car.throttleSm
    ? damp(car.throttleSm, throttle, 5.5, dt)
    : damp(car.throttleSm, throttle, 14, dt);

  const offMul = car.offTrack ? 0.4 : 1;
  const draftMul = car.draft ? 1.16 : 1;
  vF += car.throttleSm * 330 * offMul * draftMul * dt;
  if (brake > 0) {
    if (vF > 20) vF -= brake * 750 * dt;
    else vF -= brake * 200 * dt;
  }
  vF = clamp(vF, -140, VMAX);

  vF *= Math.exp(-dt * (car.offTrack ? 2.3 : (car.draft ? 0.42 : 0.55)));
  vF -= Math.sign(vF) * Math.min(Math.abs(vF), 12 * dt);

  // lateral grip: planted by default, loose on handbrake / grass
  const grip = handbrake ? 2.3 : car.offTrack ? 3.2 : 11.5;
  vL *= Math.exp(-dt * grip);

  const spd = Math.abs(vF);
  const steerPower = 3.1 * (car.steerMul || 1) * (spd / (spd + 150)) * (1 - 0.32 * spd / (VMAX + 10));
  car.steer = damp(car.steer, steerInput, 11, dt);
  car.angle += car.steer * steerPower * dt * Math.sign(vF || 1);

  const c2 = Math.cos(car.angle), s2 = Math.sin(car.angle);
  car.vx = vF * c2 - vL * s2;
  car.vy = vF * s2 + vL * c2;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  car.x = clamp(car.x, 30, WORLD_W - 30);
  car.y = clamp(car.y, 30, WORLD_H - 30);

  const near = nearestSample(car.x, car.y, car.idx);
  car.idx = near.idx;
  car.offTrack = near.dist > ROAD_W / 2 + 6;
  car.drifting = Math.abs(vL) > 55 && spd > 90;

  const gr = gearOf(spd);
  car.gear = vF < -10 ? 0 : gr.gear;    // 0 = reverse
  car.rpm = gr.rpm;

  // checkpoints & laps
  // mid-track checkpoints are loose (anti-cheat only); the finish is a
  // real geometric plane through the checkered strip — the lap fires the
  // exact moment the car's position crosses it, immune to the nearest-
  // sample index skipping across the final corner's apex
  const s0 = SAMPLES[0];
  const relX = car.x - s0.x, relY = car.y - s0.y;
  const along = relX * Math.cos(s0.dir) + relY * Math.sin(s0.dir);
  const across = -relX * Math.sin(s0.dir) + relY * Math.cos(s0.dir);
  const crossedLine = car.prevAlong < 0 && along >= 0 &&
    Math.abs(across) < ROAD_W / 2 + 30 && circDist(car.idx, 0) < 80;
  car.prevAlong = along;

  const cpIdx = Math.floor(car.cpNext * N_SAMPLES / 4) % N_SAMPLES;
  const hitCp = car.cpNext === 0
    ? crossedLine
    : circDist(car.idx, cpIdx) < 30;
  if (hitCp) {
    car.cpNext++;
    if (car.cpNext === 4) car.cpNext = 0;
    if (car.cpNext === 1 && state === 'racing') {
      if (car.lap > 0 || raceClock > 5) {
        const lapTime = raceClock - car.lapStart;
        car.lastLap = lapTime;
        let newBest = false;
        if (car.bestLap === null || lapTime < car.bestLap) {
          car.bestLap = lapTime;
          newBest = true;
          if (car.isPlayer && car.lap > 0)
            flashMsg = { text: 'BEST LAP  ' + fmtTime(lapTime), t: 2.2 };
        }
        if (car.isPlayer && newBest) {
          bestTrace = Float32Array.from(curTrace);
          deltaValid = true;
        }
        if (car.isPlayer) {
          const hs = getHS();
          if (hs.bestLap === undefined || lapTime < hs.bestLap) {
            hs.bestLap = lapTime;
            saveHS(hs);
            newLapRecord = true;
            flashMsg = { text: 'TRACK RECORD  ' + fmtTime(lapTime), t: 2.4 };
          }
          // time trial: a best lap becomes the new ghost
          if (gameMode === 'trial') {
            if (!ghost || lapTime < ghost.t) {
              ghost = { t: lapTime, d: ghostRec.slice() };
              try {
                localStorage.setItem('apexgp_ghost_' + TRACKS[curTrackIx].id,
                  JSON.stringify({ t: lapTime, d: ghost.d.map(v => Math.round(v * 100) / 100) }));
              } catch (e) {}
              if (!flashMsg) flashMsg = { text: 'NEW GHOST  ' + fmtTime(lapTime), t: 2 };
            }
            ghostRec = [];
            ghostLastT = -1;
          }
        }
        car.lapStart = raceClock;
        car.lap++;
        if (car.isPlayer) {
          if (gameMode === 'race' && car.lap >= TOTAL_LAPS) {
            car.finishTime = raceClock;
            state = 'finished';
            beep(880, 0.5, 0.25);
            const rhs = getHS();
            if (rhs.bestRace === undefined || raceClock < rhs.bestRace) {
              rhs.bestRace = raceClock;
              saveHS(rhs);
              newRaceRecord = true;
            }
            // a race win counts toward mastering this track (3 wins
            // on one track unlock the next circuit)
            if (standings()[0] === car) {
              const before = unlockedCount();
              addWin(TRACKS[curTrackIx].id);
              if (unlockedCount() > before && before < TRACKS.length) {
                unlockMsg = TRACKS[before].name;
                beep(1040, 0.5, 0.25);
              }
              // won on every track for the first time -> champion!
              let champSeen = false;
              try { champSeen = localStorage.getItem('apexgp_champion') === '1'; } catch (e) {}
              if (!champSeen && isChampion()) {
                championNow = true;
                try { localStorage.setItem('apexgp_champion', '1'); } catch (e) {}
                beep(1240, 0.7, 0.3);
              }
            }
          } else if (gameMode === 'race' && car.lap === TOTAL_LAPS - 1) {
            beep(740, 0.25, 0.2);
            flashMsg = { text: 'FINAL LAP', t: 2 };
          } else {
            beep(660, 0.18, 0.18);
            flashMsg = flashMsg || {
              text: gameMode === 'trial'
                ? 'LAP ' + (car.lap + 1)
                : 'LAP ' + (car.lap + 1) + ' / ' + TOTAL_LAPS,
              t: 1.6
            };
          }
        } else if (car.lap >= TOTAL_LAPS && car.finishTime === null) {
          car.finishTime = raceClock;
        }
      }
    }
  }

  // skid marks + smoke
  const rlx = car.x - c2 * 12 - (-s2) * 10, rly = car.y - s2 * 12 - c2 * 10;
  const rrx = car.x - c2 * 12 + (-s2) * 10, rry = car.y - s2 * 12 + c2 * 10;
  if (car.drifting && !car.offTrack) {
    if (car.prevRL) {
      skidCtx.strokeStyle = 'rgba(25,25,28,0.28)';
      skidCtx.lineWidth = 4;
      skidCtx.beginPath();
      skidCtx.moveTo(car.prevRL.x, car.prevRL.y);
      skidCtx.lineTo(rlx, rly);
      skidCtx.moveTo(car.prevRR.x, car.prevRR.y);
      skidCtx.lineTo(rrx, rry);
      skidCtx.stroke();
    }
    if (Math.random() < 0.7) spawnSmoke((rlx + rrx) / 2, (rly + rry) / 2, 'rgba(230,230,230,');
  }
  if (car.offTrack && spd > 60 && Math.random() < 0.5) {
    spawnSmoke(car.x - c2 * 14, car.y - s2 * 14, 'rgba(160,125,80,');
  }
  car.prevRL = { x: rlx, y: rly };
  car.prevRR = { x: rrx, y: rry };
}

function spawnSmoke(x, y, colorPrefix) {
  if (particles.length > 260) return;
  particles.push({
    x, y,
    vx: rand(-30, 30), vy: rand(-30, 30),
    life: rand(0.5, 0.9), age: 0,
    size: rand(6, 11),
    color: colorPrefix
  });
}

function collideCars() {
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i], b = cars[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy), minD = 30;
      if (d < minD && d > 0.01) {
        const nx = dx / d, ny = dy / d;
        const push = (minD - d) / 2;
        a.x -= nx * push; a.y -= ny * push;
        b.x += nx * push; b.y += ny * push;
        const rvx = b.vx - a.vx, rvy = b.vy - a.vy;
        const rel = rvx * nx + rvy * ny;
        if (rel < 0) {
          const imp = rel * 0.55;
          a.vx += nx * imp; a.vy += ny * imp;
          b.vx -= nx * imp; b.vy -= ny * imp;
          if (a.isPlayer || b.isPlayer) {
            shake = Math.min(10, shake + Math.min(9, -rel * 0.05));
            if (-rel > 90) beep(140, 0.12, 0.2);
          }
        }
      }
    }
  }
}

// slipstream: tucked in behind another car -> less drag, more push
function updateDraft() {
  for (const car of cars) {
    car.draft = false;
    const spd = Math.hypot(car.vx, car.vy);
    if (spd < 140) continue;
    const hx = Math.cos(car.angle), hy = Math.sin(car.angle);
    for (const other of cars) {
      if (other === car) continue;
      const dx = other.x - car.x, dy = other.y - car.y;
      const d = Math.hypot(dx, dy);
      if (d < 45 || d > 190) continue;
      const dot = (dx * hx + dy * hy) / d;
      if (dot > 0.92) { car.draft = true; break; }
    }
  }
}

// ---------- AI ----------
// top speed the steering physics can hold around a corner of radius R
function cornerV(R, steerMul) {
  const k = 3.1 * steerMul;
  return clamp((k * R - 150) / (1 + 0.32 * k / (VMAX + 10) * R), 110, 520);
}

function driveAI(car, dt) {
  const diffCfg = DIFFS[curDiffIx];
  const vFwd = car.vx * Math.cos(car.angle) + car.vy * Math.sin(car.angle);
  const spdNow = Math.abs(vFwd);

  // local curvature -> fade from the side lane to the track center in corners
  const a1 = SAMPLES[(car.idx + 6) % N_SAMPLES].dir;
  const a2 = SAMPLES[(car.idx + 26) % N_SAMPLES].dir;
  const curvNear = Math.abs(angleWrap(a2 - a1));
  const sN = SAMPLES[car.idx];
  const latOff = (car.x - sN.x) * sN.nx + (car.y - sN.y) * sN.ny;
  const wide = Math.abs(latOff) > ROAD_W / 2 - 28;
  const laneScale = clamp(1 - curvNear * 2.5, 0, 1);
  const laneTarget = wide ? -Math.sign(latOff) * 0.15 : car.laneOffset * laneScale;

  // Stanley-style path tracking: curvature feedforward + heading error to
  // the path tangent + cross-track correction toward the desired lane
  const kA = clamp(Math.round(spdNow * 0.12 / TRACK_DS), 2, 8);
  const dirAhead = SAMPLES[(car.idx + kA) % N_SAMPLES].dir;
  const curvSigned = angleWrap(dirAhead - SAMPLES[car.idx].dir) / (kA * TRACK_DS);
  const sp = 3.1 * (car.steerMul || 1) * (spdNow / (spdNow + 150)) * (1 - 0.32 * spdNow / (VMAX + 10));
  const ff = sp > 0.05 ? clamp(vFwd * curvSigned / sp, -1, 1) : 0;
  const headingErr = angleWrap(dirAhead - car.angle);
  const e = latOff - laneTarget * ROAD_W;
  let steer = clamp(ff + 1.2 * headingErr - Math.atan(2.5 * e / Math.max(spdNow, 80)), -1, 1);
  const diff = headingErr;
  if (Math.random() < 0.005) car.aiSpeedJitter = rand(0.985, 1.015);
  let pace = car.skill * car.aiSpeedJitter;
  // rubber-band: trail the player -> push a little harder, lead -> ease off
  if (diffCfg.rubber > 0 && car !== player) {
    const gap = raceProgress(player) - raceProgress(car);
    pace *= clamp(1 + (gap / N_SAMPLES) * 0.15, 1 - diffCfg.rubber, 1 + diffCfg.rubber);
  }
  // scan the road ahead and brake early enough for every upcoming corner
  let targetSpd = VMAX * pace;
  for (let h = 0; h <= 120; h += 5) {
    const aA = SAMPLES[(car.idx + h) % N_SAMPLES].dir;
    const aB = SAMPLES[(car.idx + h + 8) % N_SAMPLES].dir;
    const c = Math.abs(angleWrap(aB - aA));
    if (c < 0.02) continue;
    const R = (8 * TRACK_DS) / c;
    const vc = cornerV(R, car.steerMul || 1) * diffCfg.bravery * pace;
    const dist = Math.max(0, (h - 6) * TRACK_DS);
    const allowed = Math.sqrt(vc * vc + 2 * 800 * dist);
    if (allowed < targetSpd) targetSpd = allowed;
  }
  // never trade tarmac for time: slow down when pointing badly or wide
  if (Math.abs(diff) > 0.5) targetSpd = Math.min(targetSpd, 230);
  if (wide) targetSpd = Math.min(targetSpd, 280);

  // scheduled human error: rookies bobble often, legends almost never
  car.mistakeCd -= dt;
  if (car.mistakeCd <= 0) {
    car.mistakeCd = rand(4, 9);
    if (Math.random() < diffCfg.mistake) {
      car.mistakeT = rand(0.35, 0.7);
      car.mistakeSteer = rand(-0.45, 0.45);
    }
  }

  let throttle = 0, brake = 0;
  if (vFwd < targetSpd - 8) throttle = 1;
  else if (vFwd > targetSpd + 10) brake = 1;
  if (car.mistakeT > 0) {
    car.mistakeT -= dt;
    steer = clamp(steer + car.mistakeSteer, -1, 1);
    throttle *= 0.45;
  }
  stepCar(car, dt, throttle, brake, steer, false);
}

// ---------- Timing: markers, gaps, delta, sectors ----------
function updateMarkers(car) {
  const mIdx = Math.floor(car.idx / MARKER_LEN);
  const absM = car.lap * MARKERS + mIdx;
  if (absM > car.lastAbsM && absM - car.lastAbsM < MARKERS) {
    for (let m = car.lastAbsM + 1; m <= absM; m++) car.markerTimes.set(m, raceClock);
    // player: record the current-lap trace for the delta bar
    if (car.isPlayer && mIdx >= 1) curTrace[mIdx] = raceClock - car.lapStart;
    car.lastAbsM = absM;
  }
}

// gap in seconds behind the leader ('' for the leader itself)
function gapToLeader(car, leader) {
  if (car === leader) return '';
  if (leader.lastAbsM - car.lastAbsM >= MARKERS) return '+1 LAP';
  const t = leader.markerTimes.get(car.lastAbsM);
  if (t === undefined) return '+0.0';
  const behindT = car.markerTimes.get(car.lastAbsM);
  const gap = (behindT === undefined ? raceClock : behindT) - t;
  return '+' + Math.max(0, gap).toFixed(1);
}

function updatePlayerTiming(dt) {
  // live delta vs best lap
  const mIdx = Math.floor(player.idx / MARKER_LEN);
  if (deltaValid && bestTrace && mIdx >= 2 && mIdx < MARKERS - 1 && state === 'racing') {
    const d = curTrace[mIdx] - bestTrace[mIdx];
    if (Math.abs(d) < 30) deltaDisplay = damp(deltaDisplay, d, 6, dt);
  }

  // sectors (thirds of the lap)
  const sector = Math.floor(player.idx / (N_SAMPLES / 3));
  if (sector !== prevSector && state === 'racing') {
    // only count forward transitions
    const forward = (prevSector + 1) % 3 === sector;
    if (forward) {
      const finished = prevSector;   // the sector just completed
      const t = raceClock - sectorStartClock;
      if (t > 1) {                    // ignore the pre-start fragment
        sectorLast[finished] = t;
        if (sectorBest[finished] === null || t < sectorBest[finished]) {
          sectorBest[finished] = t;
          sectorFlash[finished] = 2.4;
        }
      }
      sectorStartClock = raceClock;
    }
    prevSector = sector;
  }
  for (let i = 0; i < 3; i++) sectorFlash[i] = Math.max(0, sectorFlash[i] - dt);
}

// ---------- Ranking ----------
function raceProgress(c) { return c.lap * N_SAMPLES + c.idx; }
function standings() {
  return [...cars].sort((a, b) => {
    if (a.finishTime !== null && b.finishTime !== null) return a.finishTime - b.finishTime;
    if (a.finishTime !== null) return -1;
    if (b.finishTime !== null) return 1;
    return raceProgress(b) - raceProgress(a);
  });
}

// ---------- Formatting ----------
function fmtTime(t) {
  if (t == null) return '--:--.---';
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const ms = Math.floor((t % 1) * 1000);
  return m + ':' + String(s).padStart(2, '0') + '.' + String(ms).padStart(3, '0');
}
function fmtSector(t) {
  if (t == null) return '--.-';
  return t.toFixed(1);
}

// ---------- Update ----------
let dispThrottle = 0, dispBrake = 0;

function update(dt) {
  if (state === 'welcome') {
    welcomeT += dt;
    if (welcomeT >= 2) state = 'menu';
    return;
  }
  if (state === 'menu' || state === 'tracks') return;

  if (state === 'countdown') {
    countT -= dt;
    const whole = Math.ceil(countT);
    if (whole !== lastBeepAt && whole >= 1 && whole <= 3) {
      lastBeepAt = whole;
      beep(440, 0.15, 0.22);
    }
    if (countT <= 0) {
      state = 'racing';
      beep(880, 0.35, 0.25);
      for (const c of cars) c.lapStart = 0;
      sectorStartClock = 0;
    }
  }

  if (state === 'racing' || state === 'finished') raceClock += dt;
  const racing = state === 'racing' || state === 'finished';

  if (racing) updateDraft();

  let up = 0, down = 0;
  if (state === 'racing') {
    up = (keys['arrowup'] || keys['w'] || touchCtl.gas) ? 1 : 0;
    down = (keys['arrowdown'] || keys['s'] || touchCtl.brake) ? 1 : 0;
    const left = keys['arrowleft'] || keys['a'] || touchCtl.left;
    const right = keys['arrowright'] || keys['d'] || touchCtl.right;
    const hb = keys[' '] || touchCtl.drift;
    const steer = (right ? 1 : 0) - (left ? 1 : 0);
    stepCar(player, dt, up, down, steer, !!hb);
  } else if (state === 'finished') {
    driveAI(player, dt);
  }
  dispThrottle = damp(dispThrottle, state === 'racing' ? player.throttleSm : 0, 12, dt);
  dispBrake = damp(dispBrake, down, 14, dt);

  // time trial: sample the current lap for the ghost (20 Hz)
  if (gameMode === 'trial' && state === 'racing') {
    const lt = raceClock - player.lapStart;
    if (lt - ghostLastT >= 0.05) {
      ghostRec.push(player.x, player.y, player.angle);
      ghostLastT = lt;
    }
  }

  if (racing) {
    for (const c of cars) if (!c.isPlayer) driveAI(c, dt);
    collideCars();
    for (const c of cars) updateMarkers(c);
    updatePlayerTiming(dt);
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.age += dt;
    if (p.age >= p.life) { particles.splice(i, 1); continue; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.size += 26 * dt;
  }

  if (flashMsg) {
    flashMsg.t -= dt;
    if (flashMsg.t <= 0) flashMsg = null;
  }

  const spd = Math.hypot(player.vx, player.vy);
  const tx = player.x + player.vx * 0.45;
  const ty = player.y + player.vy * 0.45;
  camX = damp(camX, tx, 4.5, dt);
  camY = damp(camY, ty, 4.5, dt);
  camZoom = damp(camZoom, clamp(1.06 - spd * 0.0005, 0.84, 1.06), 2.5, dt);
  shake = Math.max(0, shake - 34 * dt);

  // engine audio driven by RPM through the gears
  if (AC && engineOsc) {
    const rpmF = state === 'racing' || state === 'finished' ? player.rpm : 0.15;
    const freq = 70 + rpmF * 150 + player.gear * 4;
    engineOsc.frequency.value = freq;
    engineOsc2.frequency.value = freq * 0.502;
    engineFilter.frequency.value = 280 + rpmF * 900;
    const tgtGain = state === 'racing' ? 0.048 + rpmF * 0.036 : 0.018;
    engineGain.gain.value = lerp(engineGain.gain.value, tgtGain, 0.15);
    const skidTgt = (player.drifting && state === 'racing') ? 0.09 : 0;
    skidGain.gain.value = lerp(skidGain.gain.value, skidTgt, 0.2);
  }
}

// ---------- Drawing ----------
function drawCar(c) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(c.angle);

  // hard offset comic shadow
  ctx.fillStyle = 'rgba(20,18,22,0.35)';
  ctx.beginPath();
  ctx.ellipse(3, 5, 18, 12, 0, 0, TAU);
  ctx.fill();

  // axles connecting the exposed wheels
  ctx.fillStyle = '#141216';
  ctx.fillRect(-12, -9, 4, 18);
  ctx.fillRect(9, -8, 3, 16);

  // wheels: chunky and exposed, kart-style (rear wider than front)
  ctx.fillStyle = '#141216';
  ctx.fillRect(-15, -12.5, 8, 5);
  ctx.fillRect(-15, 7.5, 8, 5);
  ctx.fillRect(8, -11.5, 6.5, 4);
  ctx.fillRect(8, 7.5, 6.5, 4);
  ctx.fillStyle = '#3a3d42';
  ctx.fillRect(-13.5, -11.5, 5, 3);
  ctx.fillRect(-13.5, 8.5, 5, 3);
  ctx.fillRect(9, -10.5, 4.5, 2);
  ctx.fillRect(9, 8.5, 4.5, 2);

  // narrow floor tray with side pods
  ctx.fillStyle = c.color;
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.lineTo(12, -5);
  ctx.lineTo(4, -6);
  ctx.lineTo(-4, -7.5);
  ctx.lineTo(-16, -6);
  ctx.lineTo(-16, 6);
  ctx.lineTo(-4, 7.5);
  ctx.lineTo(4, 6);
  ctx.lineTo(12, 5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#141216';
  ctx.lineWidth = 2.2;
  ctx.stroke();

  // front nose wing + rear bumper
  ctx.fillStyle = c.accent;
  ctx.fillRect(13, -7, 3, 14);
  ctx.fillRect(-18, -6, 3, 12);
  ctx.strokeStyle = '#141216';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(13, -7, 3, 14);
  ctx.strokeRect(-18, -6, 3, 12);

  // steering wheel
  ctx.fillStyle = '#141216';
  ctx.beginPath();
  ctx.arc(5, 0, 2.6, 0, TAU);
  ctx.fill();

  // driver helmet with team-color stripe and visor
  ctx.fillStyle = '#f2efe9';
  ctx.beginPath();
  ctx.arc(-2, 0, 4.6, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = c.accent;
  ctx.fillRect(-7, -1.4, 10, 2.8);
  ctx.fillStyle = '#141216';
  ctx.fillRect(1, -3.4, 2.2, 6.8);   // visor, facing forward
  ctx.restore();
  ctx.strokeStyle = '#141216';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(-2, 0, 4.6, 0, TAU);
  ctx.stroke();

  ctx.restore();
}

function draw() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#3c7a34';
  ctx.fillRect(0, 0, VW, VH);

  const shX = shake > 0 ? rand(-shake, shake) : 0;
  const shY = shake > 0 ? rand(-shake, shake) : 0;
  ctx.save();
  ctx.translate(VW / 2 + shX, VH / 2 + shY);
  ctx.scale(camZoom, camZoom);
  ctx.translate(-camX, -camY);

  const viewW = VW / camZoom, viewH = VH / camZoom;

  // endless grass beyond the world edges (fixed to world coordinates)
  if (!grassPattern) grassPattern = ctx.createPattern(grassTile, 'repeat');
  ctx.fillStyle = grassPattern;
  ctx.fillRect(camX - viewW / 2 - 8, camY - viewH / 2 - 8, viewW + 16, viewH + 16);

  let sx = camX - viewW / 2 - 4, sy = camY - viewH / 2 - 4;
  let sw = viewW + 8, sh = viewH + 8;
  sx = clamp(sx, 0, WORLD_W); sy = clamp(sy, 0, WORLD_H);
  sw = Math.min(sw, WORLD_W - sx); sh = Math.min(sh, WORLD_H - sy);
  if (sw > 0 && sh > 0) {
    ctx.drawImage(trackCanvas, sx, sy, sw, sh, sx, sy, sw, sh);
    ctx.drawImage(skidCanvas, sx / 2, sy / 2, sw / 2, sh / 2, sx, sy, sw, sh);
  }

  for (const p of particles) {
    const a = (1 - p.age / p.life) * 0.35;
    ctx.fillStyle = p.color + a.toFixed(3) + ')';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, TAU);
    ctx.fill();
  }

  // time trial: the ghost kart replays your best lap
  if (gameMode === 'trial' && ghost && state === 'racing') {
    const lt = raceClock - player.lapStart;
    const n = Math.floor(ghost.d.length / 3);
    if (n > 1) {
      const fi = clamp(lt / 0.05, 0, n - 1.001);
      const i0 = Math.floor(fi), fr = fi - i0;
      const gx = lerp(ghost.d[i0 * 3], ghost.d[i0 * 3 + 3], fr);
      const gy = lerp(ghost.d[i0 * 3 + 1], ghost.d[i0 * 3 + 4], fr);
      const ga = ghost.d[i0 * 3 + 2] +
        angleWrap(ghost.d[i0 * 3 + 5] - ghost.d[i0 * 3 + 2]) * fr;
      ctx.globalAlpha = 0.45;
      drawCar({ x: gx, y: gy, angle: ga, color: '#e8e6df', accent: '#9a958c' });
      ctx.globalAlpha = 1;
    }
  }

  for (const c of cars) if (!c.isPlayer) drawCar(c);
  drawCar(player);

  ctx.restore();

  drawHUD();

  // print-grain over everything
  if (!grainPattern) grainPattern = ctx.createPattern(grainCanvas, 'repeat');
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = grainPattern;
  ctx.fillRect(0, 0, VW, VH);
}

function panel(x, y, w, h, r) {
  const rad = r === undefined ? 10 : r;
  // hard offset shadow, comic-sticker style
  ctx.fillStyle = '#141216';
  ctx.beginPath();
  ctx.roundRect(x + 4, y + 5, w, h, rad);
  ctx.fill();
  ctx.fillStyle = '#f2efe9';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, rad);
  ctx.fill();
  ctx.strokeStyle = '#141216';
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawHUD() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  if (state === 'welcome') { drawWelcome(); return; }
  if (state === 'menu') { drawMenu(); return; }
  if (state === 'tracks') { drawTracks(); return; }

  const pad = 16;
  const COMPACT = VW < 760 || VH < 560;
  const order = standings();
  const rank = order.indexOf(player);
  const leader = order[0];

  // ===== top-center session bar =====
  const tbW = Math.min(380, VW - 16), tbH = 48;
  const tbX = VW / 2 - tbW / 2, tbY = pad;
  panel(tbX, tbY, tbW, tbH);
  ctx.textAlign = 'center';
  ctx.font = '900 24px Segoe UI, sans-serif';
  ctx.fillStyle = gameMode === 'trial' ? '#6f2da8' : (rank === 0 ? '#e8542f' : '#141216');
  ctx.fillText(gameMode === 'trial' ? 'TT' : 'P' + (rank + 1), tbX + 48, tbY + 32);
  ctx.font = '700 20px Segoe UI, sans-serif';
  ctx.fillStyle = '#141216';
  ctx.fillText(gameMode === 'trial'
    ? 'LAP ' + (player.lap + 1)
    : 'LAP ' + Math.min(player.lap + 1, TOTAL_LAPS) + '/' + TOTAL_LAPS, tbX + tbW / 2, tbY + 31);
  ctx.font = '600 16px Segoe UI, sans-serif';
  ctx.fillStyle = 'rgba(20,18,22,0.75)';
  ctx.fillText(fmtTime(state === 'countdown' ? 0 : raceClock - player.lapStart), tbX + tbW - 62, tbY + 30);
  // separators
  ctx.strokeStyle = 'rgba(20,18,22,0.18)';
  ctx.beginPath();
  ctx.moveTo(tbX + 96, tbY + 9); ctx.lineTo(tbX + 96, tbY + tbH - 9);
  ctx.moveTo(tbX + tbW - 118, tbY + 9); ctx.lineTo(tbX + tbW - 118, tbY + tbH - 9);
  ctx.stroke();

  // ===== delta bar (vs best lap) =====
  const dbW = 260, dbH = 24;
  const dbX = VW / 2 - dbW / 2, dbY = tbY + tbH + 8;
  panel(dbX, dbY, dbW, dbH, 6);
  if (deltaValid) {
    const d = clamp(deltaDisplay, -2, 2);
    const half = dbW / 2 - 4;
    const w = Math.abs(d) / 2 * half;
    if (d < 0) {  // faster than best -> green, grows left
      ctx.fillStyle = '#4e9b3f';
      ctx.fillRect(dbX + dbW / 2 - w, dbY + 4, w, dbH - 8);
    } else {
      ctx.fillStyle = '#e8542f';
      ctx.fillRect(dbX + dbW / 2, dbY + 4, w, dbH - 8);
    }
    ctx.font = '700 13px Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#141216';
    ctx.fillText((deltaDisplay >= 0 ? '+' : '') + deltaDisplay.toFixed(2), dbX + dbW / 2, dbY + 17);
  } else {
    ctx.font = '600 12px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(20,18,22,0.45)';
    ctx.fillText('DELTA  —  set a lap', dbX + dbW / 2, dbY + 16);
  }
  // center tick
  ctx.strokeStyle = 'rgba(20,18,22,0.5)';
  ctx.beginPath();
  ctx.moveTo(dbX + dbW / 2, dbY + 3);
  ctx.lineTo(dbX + dbW / 2, dbY + dbH - 3);
  ctx.stroke();

  // ===== left: position tower with gaps (GP races only) =====
  const twX = COMPACT ? 10 : pad;
  const twY = COMPACT ? tbY + tbH + 44 : pad;   // below the delta bar on phones
  if (gameMode === 'trial') {
    // no rivals in a time trial — show the ghost target instead
    const gw = COMPACT ? 150 : 190;
    panel(twX, twY, gw, 38);
    ctx.font = '700 ' + (COMPACT ? 12 : 14) + 'px Consolas, monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#6f2da8';
    ctx.fillText('GHOST ' + (ghost ? fmtTime(ghost.t) : 'none yet'), twX + 12, twY + 24);
    ctx.textAlign = 'center';
  } else if (COMPACT) {
    // mini tower: rank, chip, short name, gap — small so the road stays visible
    const twW = 118, rowH = 20;
    panel(twX, twY, twW, 10 + cars.length * rowH);
    order.forEach((c, i) => {
      const yy = twY + 18 + i * rowH;
      if (c.isPlayer) {
        ctx.fillStyle = 'rgba(245,185,58,0.5)';
        ctx.fillRect(twX + 3, yy - 12, twW - 6, rowH - 3);
      }
      ctx.textAlign = 'left';
      ctx.font = '800 11px Segoe UI, sans-serif';
      ctx.fillStyle = 'rgba(20,18,22,0.6)';
      ctx.fillText(String(i + 1), twX + 8, yy);
      ctx.fillStyle = c.color;
      ctx.fillRect(twX + 17, yy - 9, 4, 10);
      ctx.font = '700 11px Segoe UI, sans-serif';
      ctx.fillStyle = '#141216';
      ctx.fillText(c.name.slice(0, 3), twX + 26, yy);
      ctx.font = '600 10px Consolas, monospace';
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(20,18,22,0.7)';
      ctx.fillText(c === leader ? '' : gapToLeader(c, leader), twX + twW - 6, yy);
      ctx.textAlign = 'left';
    });
  } else {
    const twW = 214, rowH = 30;
    const twH = 38 + cars.length * rowH;
    panel(twX, twY, twW, twH);
    ctx.font = '700 13px Segoe UI, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(20,18,22,0.55)';
    ctx.fillText('RACE  ·  ' + TOTAL_LAPS + ' LAPS', twX + 12, twY + 22);
    ctx.strokeStyle = 'rgba(20,18,22,0.18)';
    ctx.beginPath();
    ctx.moveTo(twX + 8, twY + 30); ctx.lineTo(twX + twW - 8, twY + 30);
    ctx.stroke();
    order.forEach((c, i) => {
      const yy = twY + 38 + i * rowH;
      if (c.isPlayer) {
        ctx.fillStyle = 'rgba(245,185,58,0.5)';
        ctx.fillRect(twX + 4, yy - 4, twW - 8, rowH - 2);
      }
      ctx.font = '800 14px Segoe UI, sans-serif';
      ctx.fillStyle = 'rgba(20,18,22,0.6)';
      ctx.fillText('P' + (i + 1), twX + 12, yy + 14);
      ctx.fillStyle = c.color;
      ctx.fillRect(twX + 40, yy + 3, 5, 14);
      ctx.font = '600 14px Segoe UI, sans-serif';
      ctx.fillStyle = '#141216';
      ctx.fillText(c.name, twX + 53, yy + 14);
      ctx.font = '600 13px Consolas, monospace';
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(20,18,22,0.7)';
      const txt = c.finishTime !== null && leader.finishTime !== null
        ? (c === leader ? fmtTime(c.finishTime) : '+' + (c.finishTime - leader.finishTime).toFixed(1))
        : (c === leader ? 'LEADER' : gapToLeader(c, leader));
      ctx.fillText(txt, twX + twW - 12, yy + 14);
      ctx.textAlign = 'left';
    });
  }

  // ===== top-right: minimap =====
  if (!COMPACT) {
    const mx = VW - MINI_W - pad, my = pad;
    panel(mx, my, MINI_W, MINI_H);
    ctx.drawImage(miniCanvas, mx, my);
    for (const c of [...order].reverse()) {
      ctx.fillStyle = c.color;
      ctx.beginPath();
      ctx.arc(mx + 12 + c.x * MINI_SX, my + 12 + c.y * MINI_SY, c.isPlayer ? 5 : 4, 0, TAU);
      ctx.fill();
      if (c.isPlayer) {
        ctx.strokeStyle = '#141216';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }

  const spd = Math.hypot(player.vx, player.vy);
  const kmh = Math.round(spd * 0.16);

  if (COMPACT) {
    // ===== compact: tiny speed/gear cluster top-right =====
    const spW = 108, spH = 60;
    const spX = VW - spW - 10, spY = twY;
    panel(spX, spY, spW, spH);
    ctx.textAlign = 'left';
    ctx.font = '900 24px Segoe UI, sans-serif';
    ctx.fillStyle = '#141216';
    ctx.fillText(String(kmh), spX + 11, spY + 28);
    ctx.font = '600 9px Segoe UI, sans-serif';
    ctx.fillStyle = 'rgba(20,18,22,0.55)';
    ctx.fillText('KM/H', spX + 11, spY + 40);
    ctx.font = '900 20px Segoe UI, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = player.rpm > 0.92 ? '#e8542f' : '#141216';
    ctx.fillText(player.gear === 0 ? 'R' : String(player.gear), spX + spW - 11, spY + 28);
    if (player.draft) {
      ctx.font = '800 9px Segoe UI, sans-serif';
      ctx.fillStyle = '#6f2da8';
      ctx.fillText('DRAFT', spX + spW - 11, spY + 40);
    }
    ctx.textAlign = 'left';
    const rbX = spX + 11, rbY = spY + 46, rbW = spW - 22, rbH = 6;
    ctx.fillStyle = 'rgba(20,18,22,0.12)';
    ctx.fillRect(rbX, rbY, rbW, rbH);
    const rfc = player.rpm;
    ctx.fillStyle = rfc > 0.85 ? '#e8542f' : rfc > 0.6 ? '#f5b93a' : '#4e9b3f';
    ctx.fillRect(rbX, rbY, rbW * rfc, rbH);

    // small minimap bottom-right, tucked above the touch pedals
    const ms = 0.52;
    const mw = MINI_W * ms, mh = MINI_H * ms;
    const rEst = Math.max(32, Math.min(46, VW * 0.055));
    const mBottom = IS_TOUCH ? VH - 24 - rEst * 2 - 8 : VH - 10;
    const mx2 = VW - mw - 10, my2 = mBottom - mh;
    panel(mx2, my2, mw, mh, 8);
    ctx.drawImage(miniCanvas, mx2, my2, mw, mh);
    for (const c of [...order].reverse()) {
      ctx.fillStyle = c.color;
      ctx.beginPath();
      ctx.arc(mx2 + (12 + c.x * MINI_SX) * ms, my2 + (12 + c.y * MINI_SY) * ms, c.isPlayer ? 3.5 : 3, 0, TAU);
      ctx.fill();
      if (c.isPlayer) {
        ctx.strokeStyle = '#141216';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  } else {

  // ===== bottom-left: speed / gear / rpm =====
  const spW = 240, spH = 110;
  const spX = pad, spY = VH - spH - pad;
  panel(spX, spY, spW, spH);
  // gear box
  ctx.fillStyle = 'rgba(20,18,22,0.08)';
  ctx.fillRect(spX + 14, spY + 16, 52, 58);
  ctx.font = '900 42px Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = player.rpm > 0.92 ? '#e8542f' : '#141216';
  ctx.fillText(player.gear === 0 ? 'R' : String(player.gear), spX + 40, spY + 60);
  // speed
  ctx.textAlign = 'left';
  ctx.font = '900 40px Segoe UI, sans-serif';
  ctx.fillStyle = '#141216';
  ctx.fillText(String(kmh), spX + 82, spY + 54);
  ctx.font = '600 13px Segoe UI, sans-serif';
  ctx.fillStyle = 'rgba(20,18,22,0.55)';
  ctx.fillText('KM/H', spX + 84, spY + 72);
  // rpm bar + shift lights
  const rbX = spX + 14, rbY = spY + 84, rbW = spW - 28, rbH = 10;
  ctx.fillStyle = 'rgba(20,18,22,0.18)';
  ctx.fillRect(rbX, rbY, rbW, rbH);
  const rf = player.rpm;
  // flat comic rpm zones: green / yellow / red
  ctx.fillStyle = '#4e9b3f';
  ctx.fillRect(rbX, rbY, rbW * Math.min(rf, 0.6), rbH);
  if (rf > 0.6) {
    ctx.fillStyle = '#f5b93a';
    ctx.fillRect(rbX + rbW * 0.6, rbY, rbW * (Math.min(rf, 0.85) - 0.6), rbH);
  }
  if (rf > 0.85) {
    ctx.fillStyle = '#e8542f';
    ctx.fillRect(rbX + rbW * 0.85, rbY, rbW * (rf - 0.85), rbH);
  }
  ctx.strokeStyle = '#141216';
  ctx.lineWidth = 2;
  ctx.strokeRect(rbX, rbY, rbW, rbH);
  // shift lights
  for (let i = 0; i < 5; i++) {
    const on = rf > 0.58 + i * 0.085;
    ctx.fillStyle = on
      ? (i < 3 ? '#4e9b3f' : '#e8542f')
      : 'rgba(20,18,22,0.18)';
    ctx.beginPath();
    ctx.arc(spX + spW - 78 + i * 15, spY + 24, 5, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#141216';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  // draft / drift indicators
  ctx.font = '800 12px Segoe UI, sans-serif';
  if (player.draft) {
    ctx.fillStyle = '#6f2da8';
    ctx.fillText('DRAFT', spX + 82, spY + 26);
  } else if (player.drifting) {
    ctx.fillStyle = '#e8542f';
    ctx.fillText('DRIFT', spX + 82, spY + 26);
  }

  // ===== bottom-center: pedal + steering telemetry =====
  const teW = 150, teH = 110;
  const teX = VW / 2 - teW / 2, teY = VH - teH - pad;
  panel(teX, teY, teW, teH);
  // brake + throttle vertical bars
  const barH2 = 62, barY2 = teY + 14;
  ctx.fillStyle = 'rgba(20,18,22,0.12)';
  ctx.fillRect(teX + 34, barY2, 16, barH2);
  ctx.fillRect(teX + 100, barY2, 16, barH2);
  ctx.fillStyle = '#e8542f';
  ctx.fillRect(teX + 34, barY2 + barH2 * (1 - dispBrake), 16, barH2 * dispBrake);
  ctx.fillStyle = '#4e9b3f';
  ctx.fillRect(teX + 100, barY2 + barH2 * (1 - dispThrottle), 16, barH2 * dispThrottle);
  ctx.font = '600 11px Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(20,18,22,0.55)';
  ctx.fillText('BRK', teX + 42, barY2 + barH2 + 14);
  ctx.fillText('THR', teX + 108, barY2 + barH2 + 14);
  // steering indicator
  const stY = teY + teH - 12, stW = teW - 40;
  ctx.fillStyle = 'rgba(20,18,22,0.12)';
  ctx.fillRect(teX + 20, stY - 4, stW, 6);
  ctx.fillStyle = '#141216';
  const stPos = teX + 20 + stW / 2 + player.steer * (stW / 2 - 5);
  ctx.beginPath();
  ctx.arc(stPos, stY - 1, 6, 0, TAU);
  ctx.fill();

  // ===== bottom-right: sectors + laps =====
  const scW = 240, scH = 110;
  const scX = VW - scW - pad, scY = VH - scH - pad;
  panel(scX, scY, scW, scH);
  ctx.font = '700 12px Segoe UI, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(20,18,22,0.55)';
  ctx.fillText('SECTORS', scX + 12, scY + 20);
  const boxW = (scW - 24 - 12) / 3;
  for (let i = 0; i < 3; i++) {
    const bx2 = scX + 12 + i * (boxW + 6), by2 = scY + 28;
    const hot = sectorFlash[i] > 0;
    ctx.fillStyle = hot ? 'rgba(78,155,63,0.35)' : 'rgba(20,18,22,0.08)';
    ctx.fillRect(bx2, by2, boxW, 30);
    ctx.font = '600 10px Segoe UI, sans-serif';
    ctx.fillStyle = 'rgba(20,18,22,0.5)';
    ctx.fillText('S' + (i + 1), bx2 + 5, by2 + 12);
    ctx.font = '700 13px Consolas, monospace';
    ctx.fillStyle = hot ? '#2f6b26' : '#141216';
    ctx.fillText(fmtSector(sectorLast[i]), bx2 + 5, by2 + 25);
  }
  ctx.font = '600 13px Consolas, monospace';
  ctx.fillStyle = 'rgba(20,18,22,0.75)';
  ctx.fillText('LAST ' + fmtTime(player.lastLap), scX + 12, scY + 78);
  ctx.fillStyle = '#2f6b26';
  ctx.fillText('BEST ' + fmtTime(player.bestLap), scX + 12, scY + 97);
  }  // end !COMPACT bottom panels

  // ===== on-screen touch controls =====
  if (IS_TOUCH && (state === 'racing' || state === 'countdown')) {
    updateTouchButtons(COMPACT);
    drawTouchControls();
  }

  // ===== flash message =====
  if (flashMsg) {
    const a = clamp(flashMsg.t / 0.4, 0, 1);
    ctx.globalAlpha = a;
    ctx.font = '900 30px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#141216';
    ctx.fillText(flashMsg.text, VW / 2 + 3, VH * 0.3 + 3);
    ctx.strokeStyle = '#141216';
    ctx.lineWidth = 6;
    ctx.lineJoin = 'round';
    ctx.strokeText(flashMsg.text, VW / 2, VH * 0.3);
    ctx.fillStyle = '#f5b93a';
    ctx.fillText(flashMsg.text, VW / 2, VH * 0.3);
    ctx.globalAlpha = 1;
  }

  // ===== countdown =====
  if (state === 'countdown') {
    const whole = Math.ceil(countT);
    const fr = countT - Math.floor(countT);
    const txt = whole >= 1 ? String(whole) : 'GO!';
    ctx.save();
    ctx.translate(VW / 2, VH / 2);
    ctx.scale(1 + (1 - fr) * 0.4, 1 + (1 - fr) * 0.4);
    ctx.globalAlpha = clamp(fr * 2, 0, 1);
    ctx.font = '900 ' + Math.round(Math.min(110, VW * 0.22)) + 'px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#141216';
    ctx.fillText(txt, 7, 40 + 7);
    ctx.strokeStyle = '#141216';
    ctx.lineWidth = 12;
    ctx.lineJoin = 'round';
    ctx.strokeText(txt, 0, 40);
    ctx.fillStyle = whole >= 1 ? '#f5b93a' : '#4e9b3f';
    ctx.fillText(txt, 0, 40);
    ctx.restore();
  }
  if (state === 'racing' && raceClock < 1) {
    ctx.globalAlpha = 1 - raceClock;
    ctx.font = '900 ' + Math.round(Math.min(110, VW * 0.22)) + 'px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#141216';
    ctx.lineWidth = 12;
    ctx.lineJoin = 'round';
    ctx.strokeText('GO!', VW / 2, VH / 2 + 40);
    ctx.fillStyle = '#4e9b3f';
    ctx.fillText('GO!', VW / 2, VH / 2 + 40);
    ctx.globalAlpha = 1;
  }

  if (state === 'finished') drawResults();
}

function drawWelcome() {
  ctx.fillStyle = 'rgba(22,48,20,0.62)';
  ctx.fillRect(0, 0, VW, VH);
  ctx.textAlign = 'center';
  const ts = Math.round(Math.min(54, VW * 0.075));
  ctx.font = '900 ' + ts + 'px Segoe UI, sans-serif';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#141216';
  ctx.lineWidth = Math.max(5, ts * 0.14);
  ctx.strokeText('WELCOME,', VW / 2, VH * 0.36);
  ctx.fillStyle = '#f2efe9';
  ctx.fillText('WELCOME,', VW / 2, VH * 0.36);
  ctx.strokeText('APEX RUSH RACER', VW / 2, VH * 0.36 + ts * 1.25);
  ctx.fillStyle = '#f5b93a';
  ctx.fillText('APEX RUSH RACER', VW / 2, VH * 0.36 + ts * 1.25);

  // loading bar
  const bw = Math.min(380, VW * 0.62), bh = 20;
  const bx = VW / 2 - bw / 2, by = VH * 0.60;
  panel(bx, by, bw, bh, 10);
  const f = clamp(welcomeT / 2, 0, 1);
  ctx.fillStyle = '#4e9b3f';
  ctx.beginPath();
  ctx.roundRect(bx + 3, by + 3, Math.max(8, (bw - 6) * f), bh - 6, 7);
  ctx.fill();
  ctx.font = '600 14px Segoe UI, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('loading the grid…', VW / 2, by + 46);
}

function drawTracks() {
  ctx.fillStyle = 'rgba(22,48,20,0.55)';
  ctx.fillRect(0, 0, VW, VH);
  const unlocked = unlockedCount();
  const wins = getWins();
  const compact = VW < 700;

  // header
  ctx.textAlign = 'left';
  ctx.font = '800 17px Segoe UI, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('◄ BACK', 18, 34);
  ctx.textAlign = 'center';
  ctx.font = '900 ' + (compact ? 24 : 32) + 'px Segoe UI, sans-serif';
  ctx.strokeStyle = '#141216';
  ctx.lineWidth = 7;
  ctx.lineJoin = 'round';
  ctx.strokeText('SELECT TRACK', VW / 2, 38);
  ctx.fillStyle = '#f5b93a';
  ctx.fillText('SELECT TRACK', VW / 2, 38);
  ctx.font = '600 ' + (compact ? 11 : 13) + 'px Segoe UI, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText(unlocked + ' / ' + TRACKS.length + ' unlocked   ·   win ' + WINS_TO_MASTER +
    ' races on one track to unlock the next', VW / 2, 62);

  // grid geometry
  const cols = VW < 640 ? 3 : VW < 1000 ? 4 : 5;
  tracksCols = cols;
  const rows = Math.ceil(TRACKS.length / cols);
  const gap = 12;
  let cardW = Math.min(190, (VW - 32 - (cols - 1) * gap) / cols);
  const headerH = 80;
  const maxCardH = (VH - headerH - 14 - (rows - 1) * gap) / rows;
  let prevH = (cardW - 14) * 0.62;
  let cardH = prevH + 46;
  if (cardH > maxCardH) {
    cardH = Math.max(70, maxCardH);
    prevH = cardH - 46;
    cardW = Math.min(cardW, prevH / 0.62 + 14);
  }
  const gridW = cols * cardW + (cols - 1) * gap;
  const x0 = VW / 2 - gridW / 2;
  const y0 = headerH;
  tracksGeo = { x0, y0, cardW, cardH, gap, cols };

  TRACKS.forEach((t, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const x = x0 + col * (cardW + gap), y = y0 + row * (cardH + gap);
    const open = isUnlocked(i);
    panel(x, y, cardW, cardH, 8);
    if (i === trackSel) {
      ctx.strokeStyle = '#f5b93a';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(x - 2, y - 2, cardW + 4, cardH + 4, 10);
      ctx.stroke();
    }
    ctx.drawImage(PREVIEWS[i], x + 7, y + 6, cardW - 14, prevH);
    ctx.textAlign = 'center';
    ctx.font = '800 ' + Math.min(12, cardW * 0.085) + 'px Segoe UI, sans-serif';
    ctx.fillStyle = '#141216';
    ctx.fillText(t.name, x + cardW / 2, y + prevH + 20);

    if (open) {
      // win pips toward mastery + best lap
      const w = Math.min(wins[t.id] || 0, WINS_TO_MASTER);
      for (let p = 0; p < WINS_TO_MASTER; p++) {
        ctx.fillStyle = p < w ? (w >= WINS_TO_MASTER ? '#f5b93a' : '#4e9b3f') : 'rgba(20,18,22,0.15)';
        ctx.beginPath();
        ctx.arc(x + cardW / 2 - 26 + p * 14, y + prevH + 32, 4.5, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = '#141216';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.font = '600 9px Consolas, monospace';
      ctx.fillStyle = 'rgba(20,18,22,0.6)';
      ctx.textAlign = 'right';
      ctx.fillText(fmtTime(getHSFor(t.id).bestLap).slice(0, 7), x + cardW - 7, y + prevH + 36);
      ctx.textAlign = 'center';
    } else {
      // locked: grey out + padlock
      ctx.fillStyle = 'rgba(22,48,20,0.60)';
      ctx.beginPath();
      ctx.roundRect(x, y, cardW, cardH, 8);
      ctx.fill();
      ctx.font = Math.round(cardH * 0.3) + 'px Segoe UI, sans-serif';
      ctx.fillText('🔒', x + cardW / 2, y + cardH / 2 + 4);
      if (i === unlocked) {
        ctx.font = '700 ' + Math.min(10, cardW * 0.075) + 'px Segoe UI, sans-serif';
        ctx.fillStyle = '#f5b93a';
        ctx.fillText('NEXT UNLOCK', x + cardW / 2, y + cardH - 8);
      }
    }
  });

  // locked-tap feedback
  if (performance.now() < tracksMsg) {
    ctx.font = '800 ' + (compact ? 14 : 18) + 'px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#141216';
    ctx.lineWidth = 5;
    ctx.strokeText('LOCKED — win ' + WINS_TO_MASTER + ' races on one track to unlock the next', VW / 2, VH - 18);
    ctx.fillStyle = '#f5b93a';
    ctx.fillText('LOCKED — win ' + WINS_TO_MASTER + ' races on one track to unlock the next', VW / 2, VH - 18);
  }
}

function drawTouchControls() {
  for (const b of touchButtons) {
    const pressed = touchCtl[b.id];
    ctx.fillStyle = 'rgba(20,18,22,0.85)';
    ctx.beginPath(); ctx.arc(b.x + 3, b.y + 4, b.r, 0, TAU); ctx.fill();
    ctx.fillStyle = pressed ? '#f5b93a' : 'rgba(242,239,233,0.90)';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#141216';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#141216';
    ctx.textAlign = 'center';
    if (b.id === 'left' || b.id === 'right') {
      ctx.font = '900 ' + Math.round(b.r * 0.8) + 'px Segoe UI, sans-serif';
      ctx.fillText(b.id === 'left' ? '◄' : '►', b.x, b.y + b.r * 0.28);
    } else {
      ctx.font = '900 ' + Math.round(b.r * 0.32) + 'px Segoe UI, sans-serif';
      ctx.fillText(b.id.toUpperCase(), b.x, b.y + b.r * 0.12);
    }
  }
  // exit-to-menu button
  if (menuBtn) {
    ctx.fillStyle = 'rgba(20,18,22,0.85)';
    ctx.beginPath(); ctx.arc(menuBtn.x + 2, menuBtn.y + 3, menuBtn.r, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(232,84,47,0.92)';
    ctx.beginPath(); ctx.arc(menuBtn.x, menuBtn.y, menuBtn.r, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#141216';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#f2efe9';
    ctx.font = '900 ' + Math.round(menuBtn.r * 0.75) + 'px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('≡', menuBtn.x, menuBtn.y + menuBtn.r * 0.26);
    if (menuBtn.label) {
      ctx.font = '800 ' + Math.round(menuBtn.r * 0.32) + 'px Segoe UI, sans-serif';
      ctx.fillText('MENU', menuBtn.x, menuBtn.y + menuBtn.r + 13);
    }
  }
}

function drawMenu() {
  ctx.fillStyle = 'rgba(22,48,20,0.40)';
  ctx.fillRect(0, 0, VW, VH);
  ctx.textAlign = 'center';

  const compact = VW < 760 || VH < 560;
  const titleSize = Math.round(Math.min(84, VW * 0.115));
  const titleY = compact ? Math.max(60, VH * 0.14) : Math.max(110, VH * 0.24);

  ctx.font = '900 ' + titleSize + 'px Segoe UI, sans-serif';
  ctx.fillStyle = '#141216';
  ctx.fillText('APEX RUSH GP', VW / 2 + 6, titleY + 6);
  ctx.strokeStyle = '#141216';
  ctx.lineWidth = Math.max(6, titleSize * 0.14);
  ctx.lineJoin = 'round';
  ctx.strokeText('APEX RUSH GP', VW / 2, titleY);
  ctx.fillStyle = '#f5b93a';
  ctx.fillText('APEX RUSH GP', VW / 2, titleY);

  if (!compact) {
    const champ = isChampion();
    ctx.font = (champ ? '800' : '600') + ' 20px Segoe UI, sans-serif';
    ctx.fillStyle = champ ? '#f5b93a' : 'rgba(255,255,255,0.9)';
    ctx.fillText(champ
      ? '🏆  APEX RUSH CHAMPION  🏆'
      : '13 circuits  ·  win races to unlock them all', VW / 2, titleY + 44);
  }

  // ---- track + difficulty + colour selector card ----
  const cw = Math.min(470, VW - 24);
  const ch = compact ? 200 : 254;
  const cx = VW / 2 - cw / 2;
  // hard-anchored below the subtitle line so it can never cover it
  const cy = compact ? titleY + 34 : titleY + 76;
  const swY = cy + (compact ? 114 : 132);
  const swGap = Math.min(36, (cw - 56) / KART_COLORS.length);
  const swX0 = VW / 2 - (KART_COLORS.length - 1) * swGap / 2;
  menuGeo = { cx, cy, cw, ch, compact, swY, swX0, swGap };
  panel(cx, cy, cw, ch);
  ctx.textAlign = 'center';
  ctx.font = '700 13px Segoe UI, sans-serif';
  ctx.fillStyle = 'rgba(20,18,22,0.55)';
  ctx.fillText('TRACK  ' + (curTrackIx + 1) + ' / ' + TRACKS.length + '   ·   ▦ ALL TRACKS (T)', VW / 2, cy + 24);
  ctx.font = '900 ' + (compact ? 23 : 32) + 'px Segoe UI, sans-serif';
  ctx.fillStyle = '#141216';
  ctx.fillText('◄   ' + TRACKS[curTrackIx].name + '   ►', VW / 2, cy + (compact ? 56 : 64));
  // AI difficulty row
  const dcfg = DIFFS[curDiffIx];
  ctx.font = '800 ' + (compact ? 17 : 19) + 'px Segoe UI, sans-serif';
  ctx.fillStyle = dcfg.color;
  ctx.fillText('▲   AI:  ' + dcfg.name + '   ▼', VW / 2, cy + (compact ? 88 : 100));
  // kart colour swatches
  KART_COLORS.forEach((kc, i) => {
    const sx2 = swX0 + i * swGap;
    ctx.fillStyle = kc[0];
    ctx.beginPath();
    ctx.arc(sx2, swY, i === kartColorIx ? 10 : 7, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#141216';
    ctx.lineWidth = i === kartColorIx ? 3 : 2;
    ctx.stroke();
  });

  // records for this track
  const hs = getHS();
  ctx.font = '700 ' + (compact ? 13 : 15) + 'px Consolas, monospace';
  if (compact) {
    ctx.fillStyle = '#2f6b26';
    ctx.fillText('BEST LAP  ' + fmtTime(hs.bestLap), VW / 2, cy + 152);
    ctx.fillStyle = 'rgba(20,18,22,0.75)';
    ctx.fillText('BEST RACE ' + fmtTime(hs.bestRace), VW / 2, cy + 178);
  } else {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#2f6b26';
    ctx.fillText('BEST LAP   ' + fmtTime(hs.bestLap), cx + 34, cy + 186);
    ctx.fillStyle = 'rgba(20,18,22,0.75)';
    ctx.fillText('BEST RACE  ' + fmtTime(hs.bestRace), cx + 34, cy + 214);
    ctx.drawImage(miniCanvas, cx + cw - 152, cy + 158, 122, 87);
    ctx.textAlign = 'center';
  }

  const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 300);
  ctx.font = '800 ' + (compact ? 20 : 26) + 'px Segoe UI, sans-serif';
  ctx.fillStyle = 'rgba(255,217,77,' + pulse.toFixed(2) + ')';
  ctx.fillText(IS_TOUCH ? 'TAP  HERE  TO  RACE' : 'PRESS  ENTER  TO  RACE', VW / 2, cy + ch + (compact ? 46 : 62));

  if (VH - (cy + ch) > 130) {
    ctx.font = '400 ' + (compact ? 12 : 15) + 'px Segoe UI, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    const lines = IS_TOUCH ? [
      'tap  ◄ ►  to change track  ·  tap the top row for the full map list',
      'tap the AI row for difficulty  ·  pedals appear when the race starts'
    ] : [
      '◄ ► — track        ▲ ▼ — AI skill        T — all tracks        G — race / time trial',
      'C — save code        O — sound        SPACE — handbrake        R — restart        M — mute'
    ];
    lines.forEach((l, i) => ctx.fillText(l, VW / 2, cy + ch + (compact ? 76 : 100) + i * 24));
  }

  // bottom-left pill row: save / sound / mode
  menuPills = [];
  ctx.font = '800 14px Segoe UI, sans-serif';
  const pillDefs = compact
    ? [['save', '💾'], ['sound', '🔊'], ['mode', gameMode === 'race' ? '🏁' : '⏱']]
    : [['save', '💾 SAVE CODE'], ['sound', '🔊 SOUND'],
       ['mode', gameMode === 'race' ? '🏁 MODE: RACE' : '⏱ MODE: TIME TRIAL']];
  let px = 12;
  const pH = 36, pY2 = VH - pH - 10;
  ctx.textAlign = 'left';
  for (const [id, label] of pillDefs) {
    const w = compact ? 46 : ctx.measureText(label).width + 26;
    panel(px, pY2, w, pH, 10);
    ctx.fillStyle = '#141216';
    ctx.fillText(label, px + 13, pY2 + 23);
    menuPills.push({ id, x: px, y: pY2, w, h: pH });
    px += w + 10;
  }
  ctx.textAlign = 'center';
}

function drawResults() {
  ctx.fillStyle = 'rgba(22,48,20,0.50)';
  ctx.fillRect(0, 0, VW, VH);

  const order = standings();
  const rank = order.indexOf(player);
  ctx.textAlign = 'center';

  if (championNow) {
    // confetti rain behind the champion banner
    const tNow = performance.now() / 1000;
    const CONF = ['#e8542f', '#f5b93a', '#4e9b3f', '#22a7d9', '#6f2da8', '#e668b5'];
    for (let i = 0; i < 140; i++) {
      const xx = ((i * 761) % 997) / 997 * VW;
      const spd2 = 60 + (i % 7) * 24;
      const yy = ((i * 373) % 611 + tNow * spd2) % (VH + 40) - 20;
      ctx.fillStyle = CONF[i % 6];
      ctx.save();
      ctx.translate(xx, yy);
      ctx.rotate(tNow * 2 + i);
      ctx.fillRect(-4, -2.5, 8, 5);
      ctx.restore();
    }
    const cs = Math.round(Math.min(56, VW * 0.07));
    ctx.lineJoin = 'round';
    ctx.font = Math.round(cs * 1.4) + 'px Segoe UI, sans-serif';
    ctx.fillText('🏆', VW / 2, VH * 0.13);
    ctx.font = '900 ' + cs + 'px Segoe UI, sans-serif';
    ctx.strokeStyle = '#141216';
    ctx.lineWidth = Math.max(6, cs * 0.16);
    ctx.strokeText('CONGRATULATIONS!!', VW / 2, VH * 0.22);
    ctx.fillStyle = '#f2efe9';
    ctx.fillText('CONGRATULATIONS!!', VW / 2, VH * 0.22);
    ctx.font = '900 ' + Math.round(cs * 0.62) + 'px Segoe UI, sans-serif';
    ctx.strokeText('YOU ARE THE APEX RUSH CHAMPION!!', VW / 2, VH * 0.22 + cs * 1.05);
    ctx.fillStyle = '#f5b93a';
    ctx.fillText('YOU ARE THE APEX RUSH CHAMPION!!', VW / 2, VH * 0.22 + cs * 1.05);
  } else {
    ctx.font = '900 72px Segoe UI, sans-serif';
    ctx.fillStyle = '#141216';
    ctx.fillText('FINISH!', VW / 2 + 5, VH * 0.24 + 5);
    ctx.strokeStyle = '#141216';
    ctx.lineWidth = 10;
    ctx.lineJoin = 'round';
    ctx.strokeText('FINISH!', VW / 2, VH * 0.24);
    ctx.fillStyle = rank === 0 ? '#f5b93a' : '#f2efe9';
    ctx.fillText('FINISH!', VW / 2, VH * 0.24);

    ctx.font = '800 34px Segoe UI, sans-serif';
    ctx.fillStyle = rank === 0 ? '#8fe08a' : '#f5b93a';
    ctx.fillText(rank === 0 ? 'YOU WIN — ' + ORDINAL[rank] + ' PLACE' : ORDINAL[rank] + ' PLACE', VW / 2, VH * 0.24 + 56);
  }

  ctx.font = '500 20px Segoe UI, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillText('Total  ' + fmtTime(player.finishTime) + '        Best lap  ' + fmtTime(player.bestLap), VW / 2, VH * 0.24 + 100);

  const winsHere = Math.min(getWins()[TRACKS[curTrackIx].id] || 0, WINS_TO_MASTER);
  ctx.font = '600 15px Segoe UI, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText('WINS ON THIS TRACK   ' + winsHere + ' / ' + WINS_TO_MASTER, VW / 2, VH * 0.24 + 126);

  const blink = Math.sin(performance.now() / 200) > -0.3;
  if (blink) {
    ctx.font = '800 24px Segoe UI, sans-serif';
    ctx.fillStyle = '#f5b93a';
    if (unlockMsg) {
      ctx.fillText('🔓  NEW TRACK UNLOCKED — ' + unlockMsg + '  🔓', VW / 2, VH * 0.24 + 154);
    } else if (newRaceRecord || newLapRecord) {
      ctx.fillText(newRaceRecord ? '★  NEW TRACK RECORD  ★' : '★  NEW LAP RECORD  ★', VW / 2, VH * 0.24 + 154);
    }
  }

  // mini results table
  ctx.font = '600 17px Consolas, monospace';
  order.forEach((c, i) => {
    const yy = VH * 0.24 + 172 + i * 30;
    ctx.fillStyle = c.isPlayer ? '#f5b93a' : 'rgba(255,255,255,0.85)';
    const t = c.finishTime !== null ? fmtTime(c.finishTime) : 'DNF';
    ctx.fillText('P' + (i + 1) + '  ' + c.name.padEnd(8, ' ') + t, VW / 2, yy);
  });

  const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 300);
  const nextName = TRACKS[nextUnlockedTrack()].name;
  ctx.font = '800 24px Segoe UI, sans-serif';
  ctx.fillStyle = 'rgba(255,217,77,' + pulse.toFixed(2) + ')';
  ctx.fillText((IS_TOUCH ? 'TAP  —  NEXT:  ' : 'ENTER  —  NEXT:  ') + nextName, VW / 2, VH * 0.78);
  ctx.font = '600 15px Segoe UI, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText(IS_TOUCH ? 'tap here to choose another track' : 'R — same track again        ESC — track select', VW / 2, VH * 0.78 + 30);
}

// roundRect fallback for older browsers
if (!ctx.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
    return this;
  };
}

// ---------- Main loop ----------
let lastT = performance.now();
function frame(now) {
  const dt = Math.min((now - lastT) / 1000, 1 / 30);
  lastT = now;
  update(dt);
  updateMusicContext();
  scheduleMusic();
  draw();
  requestAnimationFrame(frame);
}

// boot on the last-driven track (if it's still unlocked)
let bootIx = 0;
try {
  const s = parseInt(localStorage.getItem('apexgp_lastTrack'), 10);
  if (s >= 0 && s < TRACKS.length) bootIx = s;
} catch (e) {}
if (!isUnlocked(bootIx)) bootIx = 0;
loadTrack(bootIx);
startRace();
state = 'welcome';
// try to start the menu music right away (browsers that allow autoplay
// get sound on the loading screen; others start on the first tap/key)
startStreamMusic();
requestAnimationFrame(frame);
