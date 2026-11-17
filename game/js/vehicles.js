// NEON HARBOR — cars. One factory builds every car in the city (traffic,
// parked cars, the mission sports car); the traffic system drives the
// background cars along the road graph with simple car-following.
import * as THREE from 'three';
import { CFG } from './config.js';

const CAR_COLORS = [0xc23b3b, 0x3b6fc2, 0xd8b13a, 0x4a9e6b, 0x8a5fc2, 0xc2c2c2, 0x2a2a2e, 0xd86b2a];

// A low-poly car from boxes: body, cabin, wheels, headlights, taillights.
export function makeCarMesh(color, isPolice = false) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.6 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x10151f, roughness: 0.15, metalness: 0.8 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.62, 4.3), bodyMat);
  body.position.y = 0.55;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.55, 2.1), glassMat);
  cabin.position.set(0, 1.08, -0.25);
  g.add(cabin);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.9 });
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
  for (const [x, z] of [[-0.95, 1.35], [0.95, 1.35], [-0.95, -1.35], [0.95, -1.35]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.36, z);
    g.add(w);
  }
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffedb0, emissiveIntensity: 1.6 });
  for (const x of [-0.6, 0.6]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.08), lightMat);
    h.position.set(x, 0.6, 2.16);
    g.add(h);
  }
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xff2a2a, emissive: 0xff1a1a, emissiveIntensity: 1.4 });
  for (const x of [-0.6, 0.6]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.08), tailMat);
    t.position.set(x, 0.6, -2.16);
    g.add(t);
  }
  if (isPolice) {
    const barMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.16, 0.4), barMat);
    bar.position.set(0, 1.42, -0.25);
    g.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.2, 0.42),
      new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 2.5 }));
    red.position.set(-0.3, 1.42, -0.25);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.2, 0.42),
      new THREE.MeshStandardMaterial({ color: 0x2040ff, emissive: 0x2040ff, emissiveIntensity: 2.5 }));
    blue.position.set(0.3, 1.42, -0.25);
    g.add(red, blue);
    g.userData.lightBar = { red, blue };
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return g;
}

export class TrafficSystem {
  constructor(scene, city, rng) {
    this.city = city;
    this.rng = rng;
    this.cars = [];
    const palette = CAR_COLORS;
    for (let i = 0; i < CFG.trafficCars; i++) {
      const mesh = makeCarMesh(palette[i % palette.length]);
      scene.add(mesh);
      const node = rng.int(0, city.nodes.length);
      const next = city.adj[node][rng.int(0, city.adj[node].length)];
      this.cars.push({
        mesh,
        node,
        next,
        t: rng.next(),
        speed: CFG.trafficSpeed * rng.range(0.8, 1.15),
        color: palette[i % palette.length],
        stopped: 0,
      });
    }
  }
  update(dt) {
    const { nodes, adj } = this.city;
    for (const car of this.cars) {
      const a = nodes[car.node];
      const b = nodes[car.next];
      const ex = b.x - a.x;
      const ez = b.z - a.z;
      const len = Math.hypot(ex, ez) || 1;
      // Car-following: slow down when another traffic car is close ahead.
      let want = car.speed;
      for (const other of this.cars) {
        if (other === car) continue;
        const dx = other.mesh.position.x - car.mesh.position.x;
        const dz = other.mesh.position.z - car.mesh.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 9) {
          const ahead = (dx * ex + dz * ez) / len;
          if (ahead > 0 && ahead < 9) want = Math.min(want, 2.5);
        }
      }
      car.t += (want / len) * dt;
      if (car.t >= 1) {
        car.node = car.next;
        const choices = adj[car.node];
        car.next = choices[Math.floor(Math.random() * choices.length)];
        car.t = 0;
      }
      const x = a.x + ex * car.t;
      const z = a.z + ez * car.t;
      car.mesh.position.set(x, 0, z);
      car.mesh.rotation.y = Math.atan2(ex, ez);
    }
  }
  // The closest traffic car to a point, for collisions and stealing.
  nearest(x, z, maxDist) {
    let best = null;
    let bd = maxDist;
    for (const car of this.cars) {
      const d = Math.hypot(car.mesh.position.x - x, car.mesh.position.z - z);
      if (d < bd) { bd = d; best = car; }
    }
    return best;
  }
  remove(car) {
    const i = this.cars.indexOf(car);
    if (i >= 0) this.cars.splice(i, 1);
  }
}
