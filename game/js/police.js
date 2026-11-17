// NEON HARBOR — the law. Wanted stars 0–5: crimes add heat, heat decays
// when the player stays clean and unseen. Foot cops chase on foot; police
// cars chase on the roads. A cop holding the player on foot means BUSTED.
import * as THREE from 'three';
import { CFG } from './config.js';
import { makeCarMesh } from './vehicles.js';

function makeCopMesh() {
  const g = new THREE.Group();
  const navy = new THREE.MeshStandardMaterial({ color: 0x1a2a55, roughness: 0.85 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc98d5f, roughness: 0.8 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.66, 0.34), navy);
  torso.position.y = 1.08;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 12, 10), skin);
  head.position.y = 1.6;
  const capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.09, 12), navy);
  capTop.position.y = 1.76;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.74, 0.22), navy);
  legL.position.set(-0.14, 0.37, 0);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.74, 0.22), navy);
  legR.position.set(0.14, 0.37, 0);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.58, 0.17), navy);
  armL.position.set(-0.37, 1.08, 0);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.58, 0.17), navy);
  armR.position.set(0.37, 1.08, 0);
  g.add(torso, head, capTop, legL, legR, armL, armR);
  g.userData.limbs = { legL, legR, armL, armR };
  return g;
}

export class WantedSystem {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.stars = 0;
    this.heat = 0; // 0..5 continuous; stars = ceil(heat) while heat > 0
    this.cleanTimer = 0;
    this.bustedTimer = 0;
    this.footCops = [];
    this.policeCars = [];
    this.sirenPhase = 0;
  }
  addHeat(amount, reason) {
    this.heat = Math.min(CFG.maxWanted, this.heat + amount);
    this.stars = Math.ceil(this.heat);
    this.cleanTimer = 0;
    return reason;
  }
  clear() {
    this.stars = 0;
    this.heat = 0;
    this.bustedTimer = 0;
    this.despawnAll();
  }
  despawnAll() {
    for (const c of this.footCops) this.scene.remove(c.mesh);
    for (const c of this.policeCars) this.scene.remove(c.mesh);
    this.footCops = [];
    this.policeCars = [];
  }
  spawnFootCop(x, z) {
    const mesh = makeCopMesh();
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    const cop = { mesh, pos: new THREE.Vector3(x, 0, z), walkPhase: Math.random() * 6, grabT: 0 };
    this.footCops.push(cop);
    return cop;
  }
  spawnPoliceCar(x, z, yaw) {
    const mesh = makeCarMesh(0x1a2a55, true);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = yaw;
    this.scene.add(mesh);
    const car = { mesh, pos: new THREE.Vector3(x, 0, z), yaw, speed: 0, node: this.city.nearestNode(x, z), next: 0, t: 0 };
    car.next = this.city.adj[car.node][0];
    this.policeCars.push(car);
    return car;
  }
  update(dt, playerPos, playerInCar, playerSpeed) {
    // Heat decays only after a clean stretch with no new crime.
    if (this.heat > 0) {
      this.cleanTimer += dt;
      if (this.cleanTimer > CFG.wantedDecayDelay) {
        this.heat = Math.max(0, this.heat - CFG.wantedDecayRate * dt);
        this.stars = Math.ceil(this.heat);
      }
    }
    // Reinforcements scale with the wanted level.
    const wantCops = this.stars >= 1 ? Math.min(CFG.maxFootCops, this.stars) : 0;
    const wantCars = this.stars >= 2 ? Math.min(CFG.maxPoliceCars, this.stars - 1) : 0;
    while (this.footCops.length < wantCops) {
      const a = Math.random() * Math.PI * 2;
      const r = 26 + Math.random() * 14;
      this.spawnFootCop(playerPos.x + Math.cos(a) * r, playerPos.z + Math.sin(a) * r);
    }
    while (this.footCops.length > wantCops) {
      const c = this.footCops.pop();
      this.scene.remove(c.mesh);
    }
    while (this.policeCars.length < wantCars) {
      const a = Math.random() * Math.PI * 2;
      const r = 30 + Math.random() * 16;
      const n = this.city.nearestNode(playerPos.x + Math.cos(a) * r, playerPos.z + Math.sin(a) * r);
      const node = this.city.nodes[n];
      this.spawnPoliceCar(node.x, node.z, Math.random() * Math.PI * 2);
    }
    while (this.policeCars.length > wantCars) {
      const c = this.policeCars.pop();
      this.scene.remove(c.mesh);
    }
    // Foot cops: steer straight at the player, grab when close.
    let busted = false;
    for (const cop of this.footCops) {
      const dx = playerPos.x - cop.pos.x;
      const dz = playerPos.z - cop.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.05) {
        const step = Math.min(d, CFG.copFootSpeed * dt);
        cop.pos.x += (dx / d) * step;
        cop.pos.z += (dz / d) * step;
        cop.mesh.rotation.y = Math.atan2(dx, dz);
        cop.walkPhase += dt * CFG.copFootSpeed * 2.4;
        const s = Math.sin(cop.walkPhase) * 0.5;
        cop.mesh.userData.limbs.legL.rotation.x = s;
        cop.mesh.userData.limbs.legR.rotation.x = -s;
        cop.mesh.userData.limbs.armL.rotation.x = -s * 0.7;
        cop.mesh.userData.limbs.armR.rotation.x = s * 0.7;
      }
      cop.mesh.position.copy(cop.pos);
      if (!playerInCar && d < 1.5 && this.stars > 0) {
        cop.grabT += dt;
        if (cop.grabT > CFG.bustedHoldTime) busted = true;
      } else {
        cop.grabT = 0;
      }
    }
    // Police cars: follow the road graph toward the player's nearest node,
    // then ram straight at the player's car.
    const targetNode = this.city.nearestNode(playerPos.x, playerPos.z);
    for (const car of this.policeCars) {
      const a = this.city.nodes[car.node];
      const b = this.city.nodes[car.next];
      const ex = b.x - a.x;
      const ez = b.z - a.z;
      const len = Math.hypot(ex, ez) || 1;
      car.t += (CFG.copCarSpeed / len) * dt;
      if (car.t >= 1) {
        car.node = car.next;
        // Greedy step toward the target node.
        let best = this.city.adj[car.node][0];
        let bd = Infinity;
        for (const n of this.city.adj[car.node]) {
          const dx = this.city.nodes[n].x - this.city.nodes[targetNode].x;
          const dz = this.city.nodes[n].z - this.city.nodes[targetNode].z;
          const d = dx * dx + dz * dz;
          if (d < bd) { bd = d; best = n; }
        }
        car.next = best;
        car.t = 0;
      }
      car.pos.x = a.x + ex * car.t;
      car.pos.z = a.z + ez * car.t;
      car.mesh.position.copy(car.pos);
      car.mesh.rotation.y = Math.atan2(ex, ez);
      // Flash the light bar.
      this.sirenPhase += dt * 6;
      const on = Math.sin(this.sirenPhase) > 0;
      const bar = car.mesh.userData.lightBar;
      if (bar) {
        bar.red.material.emissiveIntensity = on ? 3 : 0.3;
        bar.blue.material.emissiveIntensity = on ? 0.3 : 3;
      }
    }
    return busted;
  }
}
