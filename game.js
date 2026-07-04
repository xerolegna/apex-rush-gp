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

// three circuits, all inside the same world
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
  }
];

let curTrackIx = 0;
let SAMPLES = [];
let N_SAMPLES = 0;

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

  // flat pop-art magenta ground
  g.fillStyle = '#d16fd4';
  g.fillRect(0, 0, WORLD_W, WORLD_H);

  for (let i = 0; i < 900; i++) {
    g.fillStyle = Math.random() < 0.5
      ? 'rgba(255,255,255,0.05)' : 'rgba(60,20,62,0.06)';
    const r = rand(18, 80);
    g.beginPath();
    g.ellipse(rand(0, WORLD_W), rand(0, WORLD_H), r, r * 0.6, rand(0, TAU), 0, TAU);
    g.fill();
  }

  const path = new Path2D();
  path.moveTo(SAMPLES[0].x, SAMPLES[0].y);
  for (let i = 1; i < N_SAMPLES; i++) path.lineTo(SAMPLES[i].x, SAMPLES[i].y);
  path.closePath();

  g.lineJoin = 'round';
  g.lineCap = 'round';

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

  // trees / bushes
  for (let i = 0; i < 90; i++) {
    const x = rand(60, WORLD_W - 60), y = rand(60, WORLD_H - 60);
    let minD = Infinity;
    for (let s = 0; s < N_SAMPLES; s += 6) {
      const p = SAMPLES[s];
      const d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
      if (d < minD) minD = d;
    }
    if (Math.sqrt(minD) < ROAD_W / 2 + 90) continue;
    const r = rand(16, 34);
    g.fillStyle = 'rgba(20,18,22,0.30)';
    g.beginPath(); g.ellipse(x + 6, y + 8, r, r * 0.8, 0, 0, TAU); g.fill();
    g.fillStyle = i % 3 === 0 ? '#3f8a34' : '#4e9b3f';
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.strokeStyle = '#141216';
    g.lineWidth = 3;
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.20)';
    g.beginPath(); g.arc(x - r * 0.3, y - r * 0.3, r * 0.45, 0, TAU); g.fill();
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

// swap the whole world over to another circuit
function loadTrack(ix) {
  curTrackIx = ix;
  SAMPLES = buildSamples(TRACKS[ix].ctrl);
  N_SAMPLES = SAMPLES.length;
  MARKER_LEN = N_SAMPLES / MARKERS;
  renderTrackCanvas();
  renderMiniCanvas();
  skidCtx.clearRect(0, 0, WORLD_W, WORLD_H);
}

function cycleTrack(d) {
  loadTrack((curTrackIx + d + TRACKS.length) % TRACKS.length);
  startRace();
  state = 'menu';
  beep(520, 0.08, 0.15);
}

// ---------- AI difficulty ----------
// skills: pace multipliers for the three rivals
// corner: how much curvature slows them (lower = braver in corners)
// rubber: max rubber-band strength keeping the field close to the player
// mistake: chance per ~4-9s window that a rival briefly bobbles
const DIFFS = [
  { id: 'rookie', name: 'ROOKIE', color: '#4e9b3f', skills: [0.92, 0.88, 0.85], corner: 0.46, rubber: 0,     mistake: 0.35 },
  { id: 'pro',    name: 'PRO',    color: '#f5b93a', skills: [1.00, 0.97, 0.94], corner: 0.38, rubber: 0.035, mistake: 0.15 },
  { id: 'legend', name: 'LEGEND', color: '#e8542f', skills: [1.06, 1.03, 1.00], corner: 0.30, rubber: 0.055, mistake: 0.04 }
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
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key))
    e.preventDefault();
  keys[e.key.toLowerCase()] = true;
  initAudio();
  if (e.key === 'Enter') onEnter();
  if (e.key.toLowerCase() === 'r') startRace();
  if (e.key.toLowerCase() === 'm') toggleMute();
  if (state === 'menu' && (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a')) cycleTrack(-1);
  if (state === 'menu' && (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd')) cycleTrack(1);
  if (state === 'menu' && (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w')) cycleDiff(1);
  if (state === 'menu' && (e.key === 'ArrowDown' || e.key.toLowerCase() === 's')) cycleDiff(-1);
  if (e.key === 'Escape' && state !== 'menu') { startRace(); state = 'menu'; }
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
  if (state === 'menu') {
    const g = menuGeo;
    if (g && x > g.cx && x < g.cx + g.cw && y > g.cy && y < g.cy + g.ch) {
      const trackRowY = y > g.cy + 34 && y < g.cy + (g.compact ? 68 : 76);
      const diffRowY = y > g.cy + (g.compact ? 68 : 76) && y < g.cy + (g.compact ? 100 : 112);
      if (trackRowY) {
        if (x < g.cx + g.cw * 0.4) return cycleTrack(-1);
        if (x > g.cx + g.cw * 0.6) return cycleTrack(1);
      }
      if (diffRowY) return cycleDiff(1);
      return;              // dead area of the card
    }
    onEnter();
  } else if (state === 'finished') {
    // small zone on the "choose another track" line goes back to the menu
    if (Math.abs(y - (VH * 0.78 + 24)) < 28) { startRace(); state = 'menu'; return; }
    onEnter();
  }
}

// ---------- Audio ----------
let AC = null, masterGain = null, muted = false;
let engineOsc = null, engineOsc2 = null, engineGain = null, engineFilter = null;
let skidGain = null;

function initAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) { return; }
  masterGain = AC.createGain();
  masterGain.gain.value = 0.6;
  masterGain.connect(AC.destination);

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
  engineGain.connect(masterGain);
  engineOsc.start();
  engineOsc2.start();

  const len = AC.sampleRate * 1;
  const buf = AC.createBuffer(1, len, AC.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const noise = AC.createBufferSource();
  noise.buffer = buf;
  noise.loop = true;
  const bp = AC.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 900;
  bp.Q.value = 0.8;
  skidGain = AC.createGain();
  skidGain.gain.value = 0;
  noise.connect(bp);
  bp.connect(skidGain);
  skidGain.connect(masterGain);
  noise.start();
}
function toggleMute() {
  muted = !muted;
  if (masterGain) masterGain.gain.value = muted ? 0 : 0.6;
}
function beep(freq, dur, vol) {
  if (!AC || muted) return;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = 'triangle';
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol, AC.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + dur);
  o.connect(g); g.connect(masterGain);
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
function getHS() {
  const id = TRACKS[curTrackIx].id;
  try {
    const v = JSON.parse(localStorage.getItem('apexgp_hs_' + id));
    if (v) return v;
  } catch (e) {}
  return memHS[id] || {};
}
function saveHS(hs) {
  const id = TRACKS[curTrackIx].id;
  memHS[id] = hs;
  try { localStorage.setItem('apexgp_hs_' + id, JSON.stringify(hs)); } catch (e) {}
}
let newLapRecord = false, newRaceRecord = false;

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
let state = 'menu';            // menu | countdown | racing | finished
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
  cars = [
    makeCar('YOU',   '#f5b93a', '#c78d16', true, 0, 1),
    makeCar('VIPER', '#e8542f', '#a83318', false, 1, sk[0]),
    makeCar('BOLT',  '#4e9b3f', '#2f6b26', false, 2, sk[1]),
    makeCar('GHOST', '#6f2da8', '#4a1c73', false, 3, sk[2])
  ];
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
}

function onEnter() {
  if (state === 'menu' || state === 'finished') startRace();
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
  const steerPower = 3.1 * (spd / (spd + 150)) * (1 - 0.32 * spd / (VMAX + 10));
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
        }
        car.lapStart = raceClock;
        car.lap++;
        if (car.isPlayer) {
          if (car.lap >= TOTAL_LAPS) {
            car.finishTime = raceClock;
            state = 'finished';
            beep(880, 0.5, 0.25);
            const rhs = getHS();
            if (rhs.bestRace === undefined || raceClock < rhs.bestRace) {
              rhs.bestRace = raceClock;
              saveHS(rhs);
              newRaceRecord = true;
            }
          } else if (car.lap === TOTAL_LAPS - 1) {
            beep(740, 0.25, 0.2);
            flashMsg = { text: 'FINAL LAP', t: 2 };
          } else {
            beep(660, 0.18, 0.18);
            flashMsg = flashMsg || { text: 'LAP ' + (car.lap + 1) + ' / ' + TOTAL_LAPS, t: 1.6 };
          }
        } else if (car.lap >= TOTAL_LAPS && car.finishTime === null) {
          car.finishTime = raceClock;
        }
      }
    }
  }

  // skid marks + smoke
  const rlx = car.x - c2 * 12 - (-s2) * 7, rly = car.y - s2 * 12 - c2 * 7;
  const rrx = car.x - c2 * 12 + (-s2) * 7, rry = car.y - s2 * 12 + c2 * 7;
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
    spawnSmoke(car.x - c2 * 14, car.y - s2 * 14, 'rgba(228,150,230,');
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
function driveAI(car, dt) {
  const diffCfg = DIFFS[curDiffIx];
  const vFwd = car.vx * Math.cos(car.angle) + car.vy * Math.sin(car.angle);

  // stay on the tarmac: when running wide, aim back toward the centerline
  const sN = SAMPLES[car.idx];
  const latOff = (car.x - sN.x) * sN.nx + (car.y - sN.y) * sN.ny;
  const wide = Math.abs(latOff) > ROAD_W / 2 - 28;
  const laneTarget = wide ? -Math.sign(latOff) * 0.15 : car.laneOffset;

  const look = 14 + Math.abs(vFwd) * 0.05;
  const ti = (car.idx + Math.round(look)) % N_SAMPLES;
  const t = SAMPLES[ti];
  const tx = t.x + t.nx * laneTarget * ROAD_W;
  const ty = t.y + t.ny * laneTarget * ROAD_W;
  const want = Math.atan2(ty - car.y, tx - car.x);
  const diff = angleWrap(want - car.angle);
  let steer = clamp(diff * 3.4, -1, 1);

  // curvature ahead -> corner speed target
  const a1 = SAMPLES[(car.idx + 14) % N_SAMPLES].dir;
  const a2 = SAMPLES[(car.idx + 52) % N_SAMPLES].dir;
  const curv = Math.abs(angleWrap(a2 - a1));
  if (Math.random() < 0.005) car.aiSpeedJitter = rand(0.97, 1.03);
  let pace = car.skill * car.aiSpeedJitter;
  // rubber-band: trail the player -> push a little harder, lead -> ease off
  if (diffCfg.rubber > 0 && car !== player) {
    const gap = raceProgress(player) - raceProgress(car);
    pace *= clamp(1 + (gap / N_SAMPLES) * 0.15, 1 - diffCfg.rubber, 1 + diffCfg.rubber);
  }
  let targetSpd = clamp(465 * pace * (1 - curv * diffCfg.corner), 140, 520);

  // never trade tarmac for time: slow down when pointing badly or wide
  if (Math.abs(diff) > 0.5) targetSpd = Math.min(targetSpd, 260);
  if (wide) targetSpd = Math.min(targetSpd, 300);

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
  if (vFwd < targetSpd) throttle = 1;
  else if (vFwd > targetSpd + 15) brake = 1;
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
  if (state === 'menu') return;

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
    const tgtGain = state === 'racing' ? 0.04 + rpmF * 0.03 : 0.018;
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
  ctx.ellipse(3, 5, 19, 12, 0, 0, TAU);
  ctx.fill();

  ctx.fillStyle = '#141216';
  ctx.fillRect(-14, -11, 9, 4.5);
  ctx.fillRect(-14, 6.5, 9, 4.5);
  ctx.fillRect(6, -11, 9, 4.5);
  ctx.fillRect(6, 6.5, 9, 4.5);

  // flat body with bold ink outline
  ctx.fillStyle = c.color;
  ctx.beginPath();
  ctx.moveTo(17, 0);
  ctx.lineTo(13, -8);
  ctx.lineTo(-14, -9);
  ctx.lineTo(-17, -6);
  ctx.lineTo(-17, 6);
  ctx.lineTo(-14, 9);
  ctx.lineTo(13, 8);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#141216';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.fillStyle = '#141216';
  ctx.beginPath();
  ctx.moveTo(8, -5);
  ctx.lineTo(-6, -6);
  ctx.lineTo(-6, 6);
  ctx.lineTo(8, 5);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = c.accent;
  ctx.fillRect(-18, -8, 3, 16);
  ctx.strokeStyle = '#141216';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-18, -8, 3, 16);

  ctx.fillStyle = '#f2efe9';
  ctx.fillRect(14.5, -6.5, 2.5, 3);
  ctx.fillRect(14.5, 3.5, 2.5, 3);

  ctx.restore();
}

function draw() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#b355b7';
  ctx.fillRect(0, 0, VW, VH);

  const shX = shake > 0 ? rand(-shake, shake) : 0;
  const shY = shake > 0 ? rand(-shake, shake) : 0;
  ctx.save();
  ctx.translate(VW / 2 + shX, VH / 2 + shY);
  ctx.scale(camZoom, camZoom);
  ctx.translate(-camX, -camY);

  const viewW = VW / camZoom, viewH = VH / camZoom;
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

  if (state === 'menu') { drawMenu(); return; }

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
  ctx.fillStyle = rank === 0 ? '#e8542f' : '#141216';
  ctx.fillText('P' + (rank + 1), tbX + 48, tbY + 32);
  ctx.font = '700 20px Segoe UI, sans-serif';
  ctx.fillStyle = '#141216';
  ctx.fillText('LAP ' + Math.min(player.lap + 1, TOTAL_LAPS) + '/' + TOTAL_LAPS, tbX + tbW / 2, tbY + 31);
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

  // ===== left: position tower with gaps =====
  const twX = COMPACT ? 10 : pad;
  const twY = COMPACT ? tbY + tbH + 44 : pad;   // below the delta bar on phones
  if (COMPACT) {
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
    // ===== compact: small speed/gear cluster top-right =====
    const spW = 148, spH = 88;
    const spX = VW - spW - 10, spY = twY;
    panel(spX, spY, spW, spH);
    ctx.textAlign = 'left';
    ctx.font = '900 34px Segoe UI, sans-serif';
    ctx.fillStyle = '#141216';
    ctx.fillText(String(kmh), spX + 14, spY + 42);
    ctx.font = '600 11px Segoe UI, sans-serif';
    ctx.fillStyle = 'rgba(20,18,22,0.55)';
    ctx.fillText('KM/H', spX + 14, spY + 58);
    ctx.font = '900 30px Segoe UI, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = player.rpm > 0.92 ? '#e8542f' : '#141216';
    ctx.fillText(player.gear === 0 ? 'R' : String(player.gear), spX + spW - 16, spY + 42);
    ctx.textAlign = 'left';
    const rbX = spX + 14, rbY = spY + 66, rbW = spW - 28, rbH = 8;
    ctx.fillStyle = 'rgba(20,18,22,0.12)';
    ctx.fillRect(rbX, rbY, rbW, rbH);
    const rfc = player.rpm;
    ctx.fillStyle = rfc > 0.85 ? '#e8542f' : rfc > 0.6 ? '#f5b93a' : '#4e9b3f';
    ctx.fillRect(rbX, rbY, rbW * rfc, rbH);
    if (player.draft) {
      ctx.font = '800 11px Segoe UI, sans-serif';
      ctx.fillStyle = '#6f2da8';
      ctx.fillText('DRAFT', spX + 60, spY + 22);
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
}

function drawMenu() {
  ctx.fillStyle = 'rgba(70,22,72,0.40)';
  ctx.fillRect(0, 0, VW, VH);
  ctx.textAlign = 'center';

  const compact = VW < 760 || VH < 560;
  const titleSize = Math.round(Math.min(84, VW * 0.115));
  const titleY = compact ? Math.max(60, VH * 0.14) : VH * 0.32;

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
    ctx.font = '600 20px Segoe UI, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText('3 laps  ·  3 circuits  ·  local track records', VW / 2, titleY + 44);
  }

  // ---- track + difficulty selector card ----
  const cw = Math.min(470, VW - 24);
  const ch = compact ? 162 : 216;
  const cx = VW / 2 - cw / 2;
  const cy = compact ? titleY + 34 : VH * 0.38;
  menuGeo = { cx, cy, cw, ch, compact };
  panel(cx, cy, cw, ch);
  ctx.textAlign = 'center';
  ctx.font = '700 13px Segoe UI, sans-serif';
  ctx.fillStyle = 'rgba(20,18,22,0.55)';
  ctx.fillText('CHOOSE  TRACK   ' + (curTrackIx + 1) + ' / ' + TRACKS.length, VW / 2, cy + 24);
  ctx.font = '900 ' + (compact ? 23 : 32) + 'px Segoe UI, sans-serif';
  ctx.fillStyle = '#141216';
  ctx.fillText('◄   ' + TRACKS[curTrackIx].name + '   ►', VW / 2, cy + (compact ? 56 : 64));
  // AI difficulty row
  const dcfg = DIFFS[curDiffIx];
  ctx.font = '800 ' + (compact ? 17 : 19) + 'px Segoe UI, sans-serif';
  ctx.fillStyle = dcfg.color;
  ctx.fillText('▲   AI:  ' + dcfg.name + '   ▼', VW / 2, cy + (compact ? 88 : 100));
  // records for this track
  const hs = getHS();
  ctx.font = '700 ' + (compact ? 13 : 15) + 'px Consolas, monospace';
  if (compact) {
    ctx.fillStyle = '#2f6b26';
    ctx.fillText('BEST LAP  ' + fmtTime(hs.bestLap), VW / 2, cy + 118);
    ctx.fillStyle = 'rgba(20,18,22,0.75)';
    ctx.fillText('BEST RACE ' + fmtTime(hs.bestRace), VW / 2, cy + 142);
  } else {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#2f6b26';
    ctx.fillText('BEST LAP   ' + fmtTime(hs.bestLap), cx + 34, cy + 148);
    ctx.fillStyle = 'rgba(20,18,22,0.75)';
    ctx.fillText('BEST RACE  ' + fmtTime(hs.bestRace), cx + 34, cy + 176);
    ctx.drawImage(miniCanvas, cx + cw - 152, cy + 120, 122, 87);
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
      'tap  ◄ ►  to change track   ·   tap the AI row for difficulty',
      'on-screen pedals appear when the race starts'
    ] : [
      '◄ ► — track        ▲ ▼ — AI skill        WASD / Arrows — drive        SPACE — handbrake',
      'R — restart        ESC — track select        M — mute'
    ];
    lines.forEach((l, i) => ctx.fillText(l, VW / 2, cy + ch + (compact ? 76 : 100) + i * 24));
  }
}

function drawResults() {
  ctx.fillStyle = 'rgba(70,22,72,0.50)';
  ctx.fillRect(0, 0, VW, VH);

  const order = standings();
  const rank = order.indexOf(player);
  ctx.textAlign = 'center';
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

  ctx.font = '500 20px Segoe UI, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillText('Total  ' + fmtTime(player.finishTime) + '        Best lap  ' + fmtTime(player.bestLap), VW / 2, VH * 0.24 + 100);

  if (newRaceRecord || newLapRecord) {
    const blink = Math.sin(performance.now() / 200) > -0.3;
    if (blink) {
      ctx.font = '800 24px Segoe UI, sans-serif';
      ctx.fillStyle = '#f5b93a';
      ctx.fillText(newRaceRecord ? '★  NEW TRACK RECORD  ★' : '★  NEW LAP RECORD  ★', VW / 2, VH * 0.24 + 134);
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
  ctx.font = '800 24px Segoe UI, sans-serif';
  ctx.fillStyle = 'rgba(255,217,77,' + pulse.toFixed(2) + ')';
  ctx.fillText(IS_TOUCH ? 'TAP  TO  RACE  AGAIN' : 'PRESS  ENTER  TO  RACE  AGAIN', VW / 2, VH * 0.78);
  ctx.font = '600 15px Segoe UI, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText(IS_TOUCH ? 'tap here to choose another track' : 'ESC — choose another track', VW / 2, VH * 0.78 + 30);
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
  draw();
  requestAnimationFrame(frame);
}

loadTrack(0);
startRace();
state = 'menu';
requestAnimationFrame(frame);
