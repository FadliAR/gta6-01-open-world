// NEON HARBOR — bootstrap and game loop. Builds the world, wires the
// systems together, owns the game state (title / playing / paused / busted /
// wasted / complete) and the crime rules that connect them. The simulation
// runs on a fixed 1/60 s step; rendering follows every animation frame.
// A ?shot=<name> query stages a fixed scene for screenshots.
import * as THREE from 'three';
import { CFG } from './config.js';
import { SplitMix64 } from './rng.js';
import { buildCity } from './city.js';
import { TrafficSystem, makeCarMesh } from './vehicles.js';
import { PedSystem } from './pedestrians.js';
import { Player } from './player.js';
import { DrivingSystem } from './driving.js';
import { WantedSystem } from './police.js';
import { MissionSystem } from './missions.js';
import { HUD } from './hud.js';
import { AudioEngine } from './audio.js';
import { Effects } from './effects.js';
import { FollowCamera } from './camera.js';

const STEP = 1 / 60;
const params = new URLSearchParams(location.search);
const SHOT = params.get('shot');

// --- Renderer, scene, lights -------------------------------------------------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x141b33);
scene.fog = new THREE.FogExp2(0x141b33, 0.0026);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
scene.add(new THREE.HemisphereLight(0x8a9cc8, 0x1a1410, 0.85));
const moon = new THREE.DirectionalLight(0xbfd0ff, 1.1);
moon.position.set(-120, 180, 60);
scene.add(moon);
const dusk = new THREE.DirectionalLight(0xff9a5a, 0.5);
dusk.position.set(140, 40, -80);
scene.add(dusk);

// --- World -------------------------------------------------------------------
const rng = new SplitMix64(CFG.seed);
const city = buildCity(scene, rng);
const traffic = new TrafficSystem(scene, city, rng.child(41));
const peds = new PedSystem(scene, city, rng.child(57));
const player = new Player(scene, city.spawnPos);
const driving = new DrivingSystem(scene, city);
const wanted = new WantedSystem(scene, city);
const missions = new MissionSystem(scene, city, rng.child(73));
const hud = new HUD(city);
const audio = new AudioEngine();
const effects = new Effects(scene);
const followCam = new FollowCamera(camera, city);

// Parked cars the player can steal, plus the mission sports car.
const parkedRng = rng.child(91);
for (let i = 0; i < 8; i++) {
  const n = city.nodes[parkedRng.int(0, city.nodes.length)];
  const side = parkedRng.pick([-1, 1]);
  driving.addParked(n.x + side * 8.5, n.z + parkedRng.range(-6, 6), parkedRng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]), parkedRng.pick([0xc23b3b, 0x3b6fc2, 0xd8b13a, 0x4a9e6b, 0xc2c2c2]));
}
const sportsCar = driving.addParked(city.marinaPos.x, city.marinaPos.z, Math.PI / 2, 0xd81e1e, 'sports');

// --- State -------------------------------------------------------------------
let state = 'title';
let cash = CFG.startCash;
let cameraOverride = null;
let holdSpeed = null; // screenshot staging: keep the chase car at speed.
const keys = { forward: false, back: false, left: false, right: false, run: false, jump: false, punch: false };
const pressed = new Set();
let dragging = false;
let lastMouse = { x: 0, y: 0 };

function showScreen(id) {
  for (const s of ['title', 'pause', 'busted', 'wasted', 'complete']) {
    document.getElementById(s).classList.toggle('hidden', s !== id);
  }
  if (!id) for (const s of ['title', 'pause', 'busted', 'wasted', 'complete']) document.getElementById(s).classList.add('hidden');
  hud.el.hud.classList.toggle('hidden', id !== null);
}

function startGame() {
  audio.init();
  audio.resume();
  state = 'playing';
  showScreen(null);
  hud.show();
  followCam.reset(0, player.pos);
  hud.toast('JOB 1 — Harbor Pickup: get to the docks', 3400);
}

function respawn(kind) {
  cash = Math.max(0, cash - CFG.bustedFine);
  wanted.clear();
  player.reset(city.clinicPos);
  if (driving.car) {
    const out = driving.exit();
    if (out) driving.addParked(out.car.pos.x, out.car.pos.z, out.car.yaw, 0xc2c2c2);
  }
  player.heal(CFG.playerHealth);
  followCam.reset(0, player.pos);
  state = 'playing';
  showScreen(null);
  hud.show();
  hud.toast(kind === 'busted' ? 'BUSTED — $50 bail. Lay low for a while.' : 'WASTED — the clinic patched you up. $50.', 3400);
}

missions.onEvent = (type, payload) => {
  if (type === 'reward') {
    cash += payload.amount;
    audio.success();
  } else if (type === 'toast') {
    hud.toast(payload);
    audio.blip(990, 0.08);
  } else if (type === 'mission') {
    if (payload.index < 3) hud.toast(`JOB ${payload.index + 1} — ${['Harbor Pickup', 'Hot Wheels', 'Spire Run'][payload.index]}`, 3000);
  } else if (type === 'complete') {
    state = 'complete';
    document.getElementById('complete-text').textContent = `All three jobs done. $${cash} in your pocket. Neon Harbor is yours.`;
    showScreen('complete');
    audio.success();
  } else if (type === 'checkpoint') {
    audio.blip(1200, 0.1);
  }
};

// --- Input -------------------------------------------------------------------
const KEYMAP = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run',
  Space: 'jump',
  KeyF: 'punch',
};
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') e.preventDefault();
  const k = KEYMAP[e.code];
  if (k) {
    if (!e.repeat) pressed.add(k);
    keys[k] = true;
  }
  if (e.code === 'KeyE' && !e.repeat) pressed.add('interact');
  if (e.code === 'KeyM' && !e.repeat) {
    audio.setMuted(!audio.muted);
    hud.toast(audio.muted ? 'SOUND OFF' : 'SOUND ON', 1200);
  }
  if (e.code === 'Escape' && !e.repeat) {
    if (state === 'playing') { state = 'paused'; showScreen('pause'); }
    else if (state === 'paused') { state = 'playing'; showScreen(null); hud.show(); }
  }
});
window.addEventListener('keyup', (e) => {
  const k = KEYMAP[e.code];
  if (k) keys[k] = false;
});
canvas.addEventListener('mousedown', (e) => { dragging = true; lastMouse = { x: e.clientX, y: e.clientY }; });
window.addEventListener('mouseup', () => { dragging = false; });
window.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  followCam.addOrbit(e.clientX - lastMouse.x, e.clientY - lastMouse.y);
  lastMouse = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener('wheel', (e) => { followCam.addZoom(e.deltaY); }, { passive: true });
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
document.getElementById('play-btn').addEventListener('click', startGame);
document.getElementById('how-btn').addEventListener('click', () => {
  document.getElementById('howto').classList.toggle('hidden');
});
document.getElementById('resume-btn').addEventListener('click', () => { state = 'playing'; showScreen(null); hud.show(); });
document.getElementById('restart-btn').addEventListener('click', () => location.reload());
document.getElementById('busted-btn').addEventListener('click', () => respawn('busted'));
document.getElementById('wasted-btn').addEventListener('click', () => respawn('wasted'));
document.getElementById('complete-btn').addEventListener('click', () => { state = 'playing'; showScreen(null); hud.show(); });

// --- Crime rules ---------------------------------------------------------------
function commitCrime(heat, reason) {
  wanted.addHeat(heat, reason);
  if (reason === 'steal') hud.toast('CAR STOLEN — the cops saw that', 2200);
  if (reason === 'assault') hud.toast('ASSAULT — witnesses called the cops', 2200);
  if (reason === 'vehicular') hud.toast('HIT AND RUN', 1800);
}

function doPunch() {
  if (!player.tryPunch()) return;
  audio.blip(220, 0.07, 'square', 0.1);
  const pt = player.punchPoint();
  const ped = peds.nearest(pt.x, pt.z, CFG.punchRange);
  if (ped) {
    peds.knockDown(pt.x, pt.z, CFG.punchRange);
    peds.scare(pt.x, pt.z, 14);
    effects.burst(pt.x, 1.4, pt.z, 0xffe9b0, 10, 4);
    effects.addTrauma(0.35);
    effects.hitStop(CFG.hitStopPunch);
    audio.thud(0.6);
    commitCrime(1, 'assault');
    return;
  }
  // Punch a foot cop and the whole precinct notices.
  for (const cop of wanted.footCops) {
    if (Math.hypot(cop.pos.x - pt.x, cop.pos.z - pt.z) < CFG.punchRange) {
      effects.burst(pt.x, 1.4, pt.z, 0xffe9b0, 10, 4);
      effects.addTrauma(0.35);
      commitCrime(2, 'assault');
      return;
    }
  }
}

function doInteract() {
  if (driving.car) {
    const out = driving.exit();
    player.pos.set(out.side.x, 0, out.side.z);
    player.mesh.position.copy(player.pos);
    audio.blip(520, 0.06);
    return;
  }
  const car = driving.nearestEnterable(player.pos.x, player.pos.z);
  if (car) {
    const isSports = car.tag === 'sports';
    driving.enter(car, traffic);
    audio.blip(660, 0.08);
    followCam.dist = CFG.camCarDist;
    if (isSports) {
      commitCrime(1, 'steal');
      missions.onEnterSportsCar();
    } else {
      commitCrime(1, 'steal');
    }
  }
}

// --- Simulation step -----------------------------------------------------------
function step(dt) {
  const inCar = !!driving.car;
  if (pressed.has('punch') && !inCar) doPunch();
  if (pressed.has('interact')) doInteract();
  pressed.clear();
  if (inCar) {
    driving.update(dt, keys, traffic, peds,
      (speed) => {
        effects.addTrauma(Math.min(0.7, speed / 45));
        effects.hitStop(CFG.hitStopCrash);
        effects.burst(driving.car.pos.x, 1, driving.car.pos.z, 0xffc95e, 18, 7);
        audio.thud(Math.min(1, speed / 25));
        hud.damageFlash();
        player.hurt(Math.max(4, Math.round(speed / 4)));
      },
      () => commitCrime(1, 'vehicular'));
    if (holdSpeed !== null) driving.car.speed = holdSpeed;
  } else {
    player.update(dt, keys, followCam.moveYaw, city);
  }
  traffic.update(dt);
  peds.update(dt);
  const busted = wanted.update(dt, player.pos, inCar, inCar ? Math.abs(driving.car.speed) : player.speed2d);
  if (busted && state === 'playing') {
    state = 'busted';
    showScreen('busted');
    audio.blip(180, 0.3, 'sawtooth', 0.15);
    return;
  }
  if (player.health <= 0 && state === 'playing') {
    state = 'wasted';
    showScreen('wasted');
    return;
  }
  missions.update(dt, player.pos, inCar);
  const got = missions.collectPickups(player.pos);
  if (got > 0) {
    cash += got;
    audio.blip(1320, 0.09);
    hud.toast(`+$${got}`, 1200);
  }
  // Audio follows the chase.
  audio.setEngine(inCar ? Math.abs(driving.car.speed) / CFG.carMaxSpeed : 0, inCar);
  audio.setSiren(wanted.stars >= 2 || wanted.policeCars.length > 0);
  // The camera is updated once per frame in frame(), not per step.
  // HUD.
  hud.update({
    wanted: wanted.stars,
    cash,
    health: player.health,
    objective: missions.objectiveText(),
    missionsDone: missions.done,
    missionIndex: missions.index,
    speedKmh: inCar ? driving.car.speed * 3.6 : player.speed2d * 3.6,
    beacon: missions.beaconTarget,
    traffic: traffic.cars.map((c) => ({ x: c.mesh.position.x, z: c.mesh.position.z })),
    cops: [...wanted.footCops.map((c) => ({ x: c.pos.x, z: c.pos.z })), ...wanted.policeCars.map((c) => ({ x: c.pos.x, z: c.pos.z }))],
    player: { x: player.pos.x, z: player.pos.z },
    playerYaw: inCar ? driving.car.yaw : player.yaw,
  });
}

// --- Screenshot staging --------------------------------------------------------
function stageShot(name) {
  state = 'playing';
  showScreen(null);
  hud.show();
  const warm = () => { for (let i = 0; i < 150; i++) step(STEP); };
  if (name === 'street') {
    // On foot on a downtown street, traffic and pedestrians in frame,
    // towers ahead.
    player.pos.set(-55, 0, -82);
    player.yaw = Math.PI;
    followCam.reset(Math.PI, player.pos);
    followCam.dist = 8;
    warm();
  } else if (name === 'chase') {
    // Driving fast with a 3-star wanted level and police on the tail.
    const car = driving.addParked(0, 8, 0, 0x2a2a2e);
    driving.enter(car, traffic);
    driving.car.speed = 26;
    holdSpeed = 26;
    wanted.addHeat(3, 'stage');
    player.pos.copy(driving.car.pos);
    followCam.reset(Math.PI, driving.car.pos);
    followCam.dist = CFG.camCarDist;
    warm();
  } else if (name === 'docks') {
    // On foot at the docks, mission beacon glowing over the pier.
    player.pos.set(48, 0, 168);
    player.yaw = 0;
    followCam.reset(0, player.pos);
    followCam.dist = 9;
    warm();
  } else if (name === 'spire') {
    // High wide shot of the plaza and the Harbor Spire at dusk.
    cameraOverride = { pos: new THREE.Vector3(120, 95, 150), look: new THREE.Vector3(-10, 18, -10) };
    camera.position.copy(cameraOverride.pos);
    camera.lookAt(cameraOverride.look);
    warm();
  }
  window.__shotReady = true;
}

// --- Main loop -------------------------------------------------------------------
let last = performance.now();
let acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let realDt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const shake = effects.update(STEP, realDt);
  if (state === 'playing') {
    acc += realDt * effects.timeScale;
    let n = 0;
    while (acc >= STEP && n < 5) {
      step(STEP);
      acc -= STEP;
      n++;
    }
    if (n === 5) acc = 0;
    if (!cameraOverride) {
      const inCar = !!driving.car;
      const focus = inCar ? driving.car.pos : player.pos;
      const vel = inCar ? { x: Math.sin(driving.car.yaw) * driving.car.speed, z: Math.cos(driving.car.yaw) * driving.car.speed } : player.vel;
      followCam.update(realDt, focus, vel, inCar, shake);
    } else {
      camera.position.copy(cameraOverride.pos);
      camera.lookAt(cameraOverride.look);
    }
  }
  renderer.render(scene, camera);
}

if (SHOT) {
  stageShot(SHOT);
} else {
  followCam.reset(0, player.pos);
  camera.position.set(30, 26, 60);
  camera.lookAt(0, 10, 0);
}
window.__game = { city, player, driving, wanted, missions, get state() { return state; }, get cash() { return cash; } };
requestAnimationFrame(frame);
