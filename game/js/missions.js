// NEON HARBOR — the night's work. Three chained jobs, each a short chain of
// stages with a beacon in the world, a blip on the minimap and a line in the
// HUD. Finishing all three makes the player a Harbor Legend. Cash pickups
// are scattered for free-roam money.
import * as THREE from 'three';
import { CFG, MISSION_NAMES, MISSION_BRIEFS } from './config.js';

function makeBeacon(color) {
  const g = new THREE.Group();
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 1.6, 26, 12, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false })
  );
  pillar.position.y = 13;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.2, 0.18, 8, 24),
    new THREE.MeshBasicMaterial({ color })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.4;
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.7, 12, 10),
    new THREE.MeshBasicMaterial({ color })
  );
  core.position.y = 2.2;
  g.add(pillar, ring, core);
  g.userData = { pillar, ring, core };
  return g;
}

export class MissionSystem {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.index = 0; // current mission
    this.stage = 0; // stage inside the mission
    this.done = [false, false, false];
    this.allDone = false;
    this.timer = 0;
    this.timerOn = false;
    this.checkpoints = [];
    this.checkpointIndex = 0;
    this.beacon = makeBeacon(0xffd23e);
    this.beacon.visible = false;
    scene.add(this.beacon);
    this.beaconTarget = null;
    this.pickups = [];
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd23e, emissive: 0xa88400, emissiveIntensity: 0.9, metalness: 0.7, roughness: 0.3 });
    const goldGeo = new THREE.BoxGeometry(0.7, 0.7, 0.7);
    for (let i = 0; i < CFG.pickupCount; i++) {
      const node = city.nodes[rng.int(0, city.nodes.length)];
      const m = new THREE.Mesh(goldGeo, goldMat);
      m.position.set(node.x + rng.range(-4, 4), 1, node.z + rng.range(-4, 4));
      scene.add(m);
      this.pickups.push({ mesh: m, taken: false, phase: rng.next() * 6 });
    }
    this.onEvent = null; // set by main.js: (type, payload) => void
    this.setMission(0, 0);
  }
  emit(type, payload) {
    if (this.onEvent) this.onEvent(type, payload);
  }
  setBeacon(x, z) {
    this.beaconTarget = { x, z };
    this.beacon.position.set(x, 0, z);
    this.beacon.visible = true;
  }
  clearBeacon() {
    this.beacon.visible = false;
    this.beaconTarget = null;
  }
  setMission(i, stage) {
    this.index = i;
    this.stage = stage;
    this.timerOn = false;
    this.clearCheckpoints();
    if (i >= 3) {
      this.allDone = true;
      this.clearBeacon();
      this.emit('complete', null);
      return;
    }
    if (i === 0 && stage === 0) this.setBeacon(this.city.docksPos.x, this.city.docksPos.z);
    if (i === 0 && stage === 1) this.setBeacon(this.city.pawnShopPos.x, this.city.pawnShopPos.z);
    if (i === 1 && stage === 0) this.setBeacon(this.city.marinaPos.x, this.city.marinaPos.z);
    if (i === 1 && stage === 1) this.setBeacon(this.city.garagePos.x, this.city.garagePos.z);
    if (i === 2 && stage === 0) {
      this.timer = CFG.missionTimeLimit;
      this.timerOn = true;
      this.buildCheckpoints();
      this.setBeacon(this.checkpoints[0].x, this.checkpoints[0].z);
    }
    this.emit('mission', { index: i, stage });
  }
  buildCheckpoints() {
    const spots = [
      { x: this.city.nodes[0].x, z: this.city.nodes[0].z },
      { x: this.city.nodes[42].x, z: this.city.nodes[42].z },
      { x: this.city.spirePos.x, z: this.city.spirePos.z - 24 },
      { x: this.city.nodes[48].x, z: this.city.nodes[48].z },
      { x: this.city.docksPos.x, z: this.city.docksPos.z - 6 },
    ];
    this.checkpoints = spots.map((s) => {
      const b = makeBeacon(0x00e5ff);
      b.position.set(s.x, 0, s.z);
      this.scene.add(b);
      return { ...s, beacon: b };
    });
    this.checkpointIndex = 0;
  }
  clearCheckpoints() {
    for (const c of this.checkpoints) this.scene.remove(c.beacon);
    this.checkpoints = [];
  }
  completeMission() {
    const reward = CFG.missionReward[this.index];
    this.done[this.index] = true;
    this.emit('reward', { amount: reward, mission: this.index });
    this.emit('toast', `JOB DONE — $${reward}`);
    this.setMission(this.index + 1, 0);
  }
  // Called every frame with the player's position and car state.
  update(dt, playerPos, inCar) {
    const t = performance.now() / 1000;
    this.beacon.rotation.y = t * 0.8;
    if (this.beacon.userData.core) this.beacon.userData.core.position.y = 2.2 + Math.sin(t * 2.4) * 0.5;
    for (const c of this.checkpoints) {
      c.beacon.rotation.y = t * 0.8;
    }
    for (const p of this.pickups) {
      if (p.taken) continue;
      p.mesh.rotation.y = t * 1.5;
      p.mesh.position.y = 1 + Math.sin(t * 2 + p.phase) * 0.25;
    }
    if (this.allDone) return;
    if (this.timerOn) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timerOn = false;
        this.emit('toast', 'TIME UP — the Spire Run failed. Try again.');
        this.setMission(2, 0);
        return;
      }
    }
    if (this.index === 2) {
      // Spire Run: drive through the checkpoints in order.
      const cp = this.checkpoints[this.checkpointIndex];
      if (cp && Math.hypot(playerPos.x - cp.x, playerPos.z - cp.z) < 6) {
        this.emit('toast', `CHECKPOINT ${this.checkpointIndex + 1}/5`);
        this.emit('checkpoint', { index: this.checkpointIndex });
        this.scene.remove(cp.beacon);
        this.checkpointIndex++;
        if (this.checkpointIndex >= this.checkpoints.length) {
          this.completeMission();
        } else {
          const next = this.checkpoints[this.checkpointIndex];
          this.setBeacon(next.x, next.z);
        }
      }
      return;
    }
    if (!this.beaconTarget) return;
    const d = Math.hypot(playerPos.x - this.beaconTarget.x, playerPos.z - this.beaconTarget.z);
    if (d < 4.5) {
      if (this.index === 0 && this.stage === 0) {
        this.emit('toast', 'PACKAGE SECURED — deliver it to the pawn shop');
        this.setMission(0, 1);
      } else if (this.index === 0 && this.stage === 1) {
        this.completeMission();
      } else if (this.index === 1 && this.stage === 1) {
        if (inCar) this.completeMission();
        // On foot at the garage: the job needs the car delivered.
      }
    }
  }
  // Mission 2 stage 0 completes when the player enters the sports car.
  onEnterSportsCar() {
    if (this.index === 1 && this.stage === 0) {
      this.emit('toast', 'STOLEN — deliver it to the garage, fast');
      this.setMission(1, 1);
    }
  }
  // Cash pickups. Returns the value collected, or 0.
  collectPickups(playerPos) {
    let got = 0;
    for (const p of this.pickups) {
      if (p.taken) continue;
      if (Math.hypot(playerPos.x - p.mesh.position.x, playerPos.z - p.mesh.position.z) < 2.2) {
        p.taken = true;
        p.mesh.visible = false;
        got += CFG.pickupValue;
      }
    }
    return got;
  }
  objectiveText() {
    if (this.allDone) return { title: 'Harbor Legend', text: 'All jobs done — free roam. The city is yours.' };
    const i = this.index;
    const s = this.stage;
    let text = MISSION_BRIEFS[i];
    if (i === 0 && s === 0) text = 'Go to the yellow beacon at the docks and grab the package.';
    if (i === 0 && s === 1) text = 'Deliver the package to the pawn shop (yellow beacon).';
    if (i === 1 && s === 0) text = 'Steal the sports car at the marina (yellow beacon). Press E near it.';
    if (i === 1 && s === 1) text = 'Deliver the sports car to the garage. Lose the cops if you can.';
    if (i === 2) text = `Spire Run — checkpoint ${this.checkpointIndex + 1}/5. ${Math.max(0, Math.ceil(this.timer))}s left.`;
    return { title: `Job ${i + 1}/3 — ${MISSION_NAMES[i]}`, text };
  }
}
