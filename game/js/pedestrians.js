// NEON HARBOR — pedestrians. A tiny FSM per walker: WALK the sidewalks,
// IDLE at corners, FLEE from a threat (a punch, a speeding car). They are
// the city's life — and the fastest way to earn wanted stars.
import * as THREE from 'three';
import { CFG } from './config.js';

const SHIRTS = [0xd84a4a, 0x4a7dd8, 0x4ad87d, 0xd8b13a, 0x8a5fc2, 0xe0e0e0, 0x2a9e9e, 0xd86b2a];
const PANTS = [0x2a2f3a, 0x3a2f2a, 0x1f2a3a, 0x333333];

function makePedMesh(rng) {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: rng.pick([0xe8b98a, 0xc98d5f, 0x8a5a3a, 0xf0c8a0]), roughness: 0.8 });
  const shirt = new THREE.MeshStandardMaterial({ color: rng.pick(SHIRTS), roughness: 0.9 });
  const pants = new THREE.MeshStandardMaterial({ color: rng.pick(PANTS), roughness: 0.9 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.62, 0.3), shirt);
  torso.position.y = 1.05;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), skin);
  head.position.y = 1.55;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.72, 0.2), pants);
  legL.position.set(-0.13, 0.36, 0);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.72, 0.2), pants);
  legR.position.set(0.13, 0.36, 0);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.55, 0.15), shirt);
  armL.position.set(-0.33, 1.05, 0);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.55, 0.15), shirt);
  armR.position.set(0.33, 1.05, 0);
  g.add(torso, head, legL, legR, armL, armR);
  g.userData.limbs = { legL, legR, armL, armR };
  return g;
}

export class PedSystem {
  constructor(scene, city, rng) {
    this.city = city;
    this.peds = [];
    this.scene = scene;
    for (let i = 0; i < CFG.pedestrians; i++) {
      const mesh = makePedMesh(rng.child(100 + i));
      scene.add(mesh);
      const node = rng.int(0, city.nodes.length);
      const next = city.adj[node][rng.int(0, city.adj[node].length)];
      this.peds.push({
        mesh,
        node,
        next,
        t: rng.next(),
        speed: CFG.pedSpeed * rng.range(0.8, 1.3),
        state: 'walk',
        idleT: 0,
        fleeT: 0,
        threat: null,
        walkPhase: rng.next() * Math.PI * 2,
        down: false,
        downT: 0,
      });
    }
  }
  // A threat (punch, speeding car) makes nearby peds flee.
  scare(x, z, radius) {
    for (const p of this.peds) {
      if (p.down) continue;
      const dx = p.mesh.position.x - x;
      const dz = p.mesh.position.z - z;
      if (dx * dx + dz * dz < radius * radius) {
        p.state = 'flee';
        p.fleeT = 2.5 + Math.random() * 2;
        p.threat = { x, z };
      }
    }
  }
  // Knock a ped down (hit by a car). Returns true when a ped was hit.
  knockDown(x, z, radius) {
    for (const p of this.peds) {
      if (p.down) continue;
      const dx = p.mesh.position.x - x;
      const dz = p.mesh.position.z - z;
      if (dx * dx + dz * dz < radius * radius) {
        p.down = true;
        p.downT = 4;
        p.mesh.rotation.x = -Math.PI / 2 + 0.15;
        p.mesh.position.y = 0.3;
        return true;
      }
    }
    return false;
  }
  nearest(x, z, maxDist) {
    let best = null;
    let bd = maxDist;
    for (const p of this.peds) {
      if (p.down) continue;
      const d = Math.hypot(p.mesh.position.x - x, p.mesh.position.z - z);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
  update(dt) {
    const { nodes, adj } = this.city;
    for (const p of this.peds) {
      if (p.down) {
        p.downT -= dt;
        if (p.downT <= 0) {
          p.down = false;
          p.mesh.rotation.x = 0;
          p.mesh.position.y = 0;
        }
        continue;
      }
      let speed = p.speed;
      let tx;
      let tz;
      if (p.state === 'flee') {
        p.fleeT -= dt;
        const dx = p.mesh.position.x - p.threat.x;
        const dz = p.mesh.position.z - p.threat.z;
        const d = Math.hypot(dx, dz) || 1;
        tx = p.mesh.position.x + (dx / d) * 6;
        tz = p.mesh.position.z + (dz / d) * 6;
        speed = CFG.pedFleeSpeed;
        if (p.fleeT <= 0) p.state = 'walk';
      } else if (p.state === 'idle') {
        p.idleT -= dt;
        if (p.idleT <= 0) p.state = 'walk';
        tx = p.mesh.position.x;
        tz = p.mesh.position.z;
        speed = 0;
      } else {
        const a = nodes[p.node];
        const b = nodes[p.next];
        p.t += (p.speed / Math.max(1, Math.hypot(b.x - a.x, b.z - a.z))) * dt;
        if (p.t >= 1) {
          p.node = p.next;
          const choices = adj[p.node];
          p.next = choices[Math.floor(Math.random() * choices.length)];
          p.t = 0;
          if (Math.random() < 0.18) {
            p.state = 'idle';
            p.idleT = 1 + Math.random() * 3;
          }
        }
        // Walk on the sidewalk: offset the road centre by 8.5 m.
        const ex = b.x - a.x;
        const ez = b.z - a.z;
        const len = Math.hypot(ex, ez) || 1;
        const ox = -ez / len * 8.5;
        const oz = ex / len * 8.5;
        tx = a.x + ex * p.t + ox;
        tz = a.z + ez * p.t + oz;
      }
      const dx = tx - p.mesh.position.x;
      const dz = tz - p.mesh.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.02 && speed > 0) {
        const step = Math.min(dist, speed * dt);
        p.mesh.position.x += (dx / dist) * step;
        p.mesh.position.z += (dz / dist) * step;
        p.mesh.rotation.y = Math.atan2(dx, dz);
        p.walkPhase += dt * speed * 3.2;
        const s = Math.sin(p.walkPhase) * 0.45;
        p.mesh.userData.limbs.legL.rotation.x = s;
        p.mesh.userData.limbs.legR.rotation.x = -s;
        p.mesh.userData.limbs.armL.rotation.x = -s * 0.7;
        p.mesh.userData.limbs.armR.rotation.x = s * 0.7;
      }
    }
  }
}
