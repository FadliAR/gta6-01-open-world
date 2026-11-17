// NEON HARBOR — the city. One seeded pass builds the whole map: streets,
// blocks, buildings, parks, the plaza spire, the docks and the pier.
// Everything the game needs to navigate or collide with comes back in the
// returned object; nothing here knows about the player or the missions.
import * as THREE from 'three';
import { CFG } from './config.js';

const PITCH = CFG.blockSize + CFG.roadWidth; // 55
const STREETS = 7; // street lines per axis, at (k - 3) * PITCH
const HALF = 3 * PITCH + CFG.roadWidth / 2; // 171.5 — city edge

function streetCoord(k) {
  return (k - 3) * PITCH;
}

// Canvas texture: a facade of lit and dark windows. Generated at runtime,
// so the game ships zero image files.
function makeFacadeTexture(rng) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#10131c';
  g.fillRect(0, 0, 128, 256);
  for (let y = 8; y < 248; y += 18) {
    for (let x = 8; x < 120; x += 16) {
      const lit = rng.next();
      if (lit < 0.42) {
        g.fillStyle = rng.pick(['#ffd98a', '#ffe9b0', '#9fd8ff', '#ffb46b']);
        g.globalAlpha = 0.55 + rng.next() * 0.45;
      } else {
        g.fillStyle = '#1d2333';
        g.globalAlpha = 1;
      }
      g.fillRect(x, y, 10, 12);
    }
  }
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function box(w, h, d, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.y = h / 2;
  return m;
}

export function buildCity(scene, rng) {
  const group = new THREE.Group();
  scene.add(group);
  const colliders = [];
  const facade = makeFacadeTexture(rng.child(11));
  const wallMats = [0x5a6b8c, 0x6b5a7d, 0x4d6b6b, 0x7d6b5a, 0x54607a, 0x715f6e].map(
    (color) => new THREE.MeshStandardMaterial({ color, map: facade, emissive: 0xffffff, emissiveMap: facade, emissiveIntensity: 0.75, roughness: 0.85 })
  );
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x232838, roughness: 0.95 });
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x20242f, roughness: 0.95 });
  const walkMat = new THREE.MeshStandardMaterial({ color: 0x2e3340, roughness: 0.95 });
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x14161f, roughness: 1 });
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x1d4a2a, roughness: 1 });
  const dashMat = new THREE.MeshStandardMaterial({ color: 0xd8b13a, emissive: 0x6b5510, roughness: 0.8 });
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x0e3a58, roughness: 0.25, metalness: 0.55, emissive: 0x0a2438, emissiveIntensity: 0.7 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.9 });

  // Ground, roads, sidewalks.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(560, 560), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  group.add(ground);
  for (let k = 0; k < STREETS; k++) {
    const s = streetCoord(k);
    const roadV = new THREE.Mesh(new THREE.PlaneGeometry(CFG.roadWidth, HALF * 2 + CFG.roadWidth), roadMat);
    roadV.rotation.x = -Math.PI / 2;
    roadV.position.set(s, 0.01, 0);
    group.add(roadV);
    const roadH = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2 + CFG.roadWidth, CFG.roadWidth), roadMat);
    roadH.rotation.x = -Math.PI / 2;
    roadH.position.set(0, 0.01, s);
    group.add(roadH);
    // Sidewalk strips along both sides of each street.
    for (const off of [-CFG.roadWidth / 2 - 2.5, CFG.roadWidth / 2 + 2.5]) {
      const wV = new THREE.Mesh(new THREE.PlaneGeometry(5, HALF * 2 + CFG.roadWidth), walkMat);
      wV.rotation.x = -Math.PI / 2;
      wV.position.set(s + off, 0.02, 0);
      group.add(wV);
      const wH = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2 + CFG.roadWidth, 5), walkMat);
      wH.rotation.x = -Math.PI / 2;
      wH.position.set(0, 0.02, s + off);
      group.add(wH);
    }
    // Centre dashes.
    for (let d = -HALF + 6; d < HALF - 6; d += 12) {
      const dashV = box(0.5, 0.06, 3, dashMat);
      dashV.position.set(s, 0.03, d);
      group.add(dashV);
      const dashH = box(3, 0.06, 0.5, dashMat);
      dashH.position.set(d, 0.03, s);
      group.add(dashH);
    }
  }

  // Water south of the city, and a wooden pier.
  const water = new THREE.Mesh(new THREE.PlaneGeometry(560, 190), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -0.6, HALF + 95);
  group.add(water);
  const pier = new THREE.Group();
  for (let z = HALF; z < HALF + 34; z += 3.4) {
    const plank = box(10, 0.3, 3.2, woodMat);
    plank.position.set(55, 0.4, z + 1.7);
    pier.add(plank);
  }
  for (const x of [50.6, 59.4]) {
    const rail = box(0.3, 1, 34, woodMat);
    rail.position.set(x, 1, HALF + 17);
    pier.add(rail);
  }
  group.add(pier);

  // Blocks: buildings, parks, the plaza, the docks.
  const buildings = [];
  const blockRng = rng.child(23);
  for (let i = 0; i < STREETS - 1; i++) {
    for (let j = 0; j < STREETS - 1; j++) {
      const x0 = streetCoord(i) + CFG.roadWidth / 2 + 2.5;
      const z0 = streetCoord(j) + CFG.roadWidth / 2 + 2.5;
      const cx = x0 + CFG.blockSize / 2;
      const cz = z0 + CFG.blockSize / 2;
      // Central plaza (block 2,2): the Harbor Spire, no other buildings.
      if (i === 2 && j === 2) {
        const plaza = new THREE.Mesh(new THREE.CircleGeometry(20, 24), walkMat);
        plaza.rotation.x = -Math.PI / 2;
        plaza.position.set(cx, 0.03, cz);
        group.add(plaza);
        const spireMat = new THREE.MeshStandardMaterial({ color: 0x2a3550, map: facade, emissive: 0xffffff, emissiveMap: facade, emissiveIntensity: 0.7, roughness: 0.7 });
        const spire = box(10, 78, 10, spireMat);
        spire.position.set(cx, 0, cz);
        group.add(spire);
        const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 6, 8),
          new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 2.4 }));
        beacon.position.set(cx, 81, cz);
        group.add(beacon);
        colliders.push({ minX: cx - 5, maxX: cx + 5, minZ: cz - 5, maxZ: cz + 5 });
        continue;
      }
      // Two parks (blocks 4,1 and 1,4): grass, trees, benches.
      if ((i === 4 && j === 1) || (i === 1 && j === 4)) {
        const lawn = new THREE.Mesh(new THREE.PlaneGeometry(CFG.blockSize, CFG.blockSize), grassMat);
        lawn.rotation.x = -Math.PI / 2;
        lawn.position.set(cx, 0.03, cz);
        group.add(lawn);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3220, roughness: 1 });
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x2a6b35, roughness: 1 });
        for (let t = 0; t < 7; t++) {
          const tx = cx + blockRng.range(-16, 16);
          const tz = cz + blockRng.range(-16, 16);
          const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 3, 6), trunkMat);
          trunk.position.set(tx, 1.5, tz);
          const leaves = new THREE.Mesh(new THREE.ConeGeometry(2.4, 5, 8), leafMat);
          leaves.position.set(tx, 5, tz);
          group.add(trunk, leaves);
          colliders.push({ minX: tx - 0.5, maxX: tx + 0.5, minZ: tz - 0.5, maxZ: tz + 0.5 });
        }
        continue;
      }
      // District by row: north rows tall, south rows low.
      const tall = j <= 1;
      const mid = j === 2 || j === 3;
      const hMin = tall ? 26 : mid ? 12 : 6;
      const hMax = tall ? 62 : mid ? 24 : 13;
      const count = tall ? 1 : blockRng.int(2, 4);
      const spots = count === 1
        ? [{ x: cx, z: cz, w: 30, d: 30 }]
        : count === 2
          ? [{ x: cx - 9, z: cz, w: 18, d: 26 }, { x: cx + 9, z: cz, w: 18, d: 26 }]
          : [{ x: cx - 10, z: cz - 9, w: 17, d: 17 }, { x: cx + 10, z: cz - 9, w: 17, d: 17 }, { x: cx, z: cz + 10, w: 26, d: 14 }];
      for (const s of spots) {
        const h = blockRng.range(hMin, hMax);
        const mat = blockRng.pick(wallMats);
        const b = box(s.w, h, s.d, mat);
        b.position.set(s.x, 0, s.z);
        group.add(b);
        const roof = box(s.w + 1, 0.8, s.d + 1, roofMat);
        roof.position.set(s.x, h + 0.4, s.z);
        group.add(roof);
        if (h > 40 && blockRng.next() < 0.6) {
          const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 7, 6), roofMat);
          ant.position.set(s.x, h + 4, s.z);
          group.add(ant);
        }
        const aabb = { minX: s.x - s.w / 2, maxX: s.x + s.w / 2, minZ: s.z - s.d / 2, maxZ: s.z + s.d / 2 };
        colliders.push(aabb);
        buildings.push({ x: s.x, z: s.z, w: s.w, d: s.d, h, aabb });
      }
    }
  }

  // Dock containers along the south edge.
  const contCols = [0xd84a4a, 0x4a7dd8, 0x4ad87d, 0xd8b13a];
  for (let k = 0; k < 8; k++) {
    const x = -120 + k * 32 + rng.range(-4, 4);
    const mat = new THREE.MeshStandardMaterial({ color: contCols[k % 4], roughness: 0.8 });
    const c1 = box(12, 3, 3.4, mat);
    c1.position.set(x, 0, HALF - 12);
    const c2 = box(12, 3, 3.4, mat);
    c2.position.set(x + 2, 3, HALF - 12);
    group.add(c1, c2);
    colliders.push({ minX: x - 6, maxX: x + 8, minZ: HALF - 13.7, maxZ: HALF - 10.3 });
  }

  // Street lamps at every other intersection.
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x22242c, roughness: 0.9 });
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0xffe9b0, emissive: 0xffc95e, emissiveIntensity: 2 });
  for (let i = 0; i < STREETS; i += 2) {
    for (let j = 0; j < STREETS; j += 2) {
      const x = streetCoord(i) + CFG.roadWidth / 2 + 1;
      const z = streetCoord(j) + CFG.roadWidth / 2 + 1;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6.5, 6), poleMat);
      pole.position.set(x, 3.25, z);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), bulbMat);
      bulb.position.set(x, 6.6, z);
      group.add(pole, bulb);
    }
  }

  // Road graph: intersections are nodes; streets are edges.
  const nodes = [];
  const nodeAt = (i, j) => i * STREETS + j;
  for (let i = 0; i < STREETS; i++) {
    for (let j = 0; j < STREETS; j++) nodes.push({ x: streetCoord(i), z: streetCoord(j) });
  }
  const edges = [];
  for (let i = 0; i < STREETS; i++) {
    for (let j = 0; j < STREETS; j++) {
      if (i + 1 < STREETS) edges.push([nodeAt(i, j), nodeAt(i + 1, j)]);
      if (j + 1 < STREETS) edges.push([nodeAt(i, j), nodeAt(i, j + 1)]);
    }
  }
  const adj = nodes.map(() => []);
  for (const [a, b] of edges) {
    adj[a].push(b);
    adj[b].push(a);
  }

  const plazaBlock = { x: streetCoord(2) + CFG.roadWidth / 2 + 2.5 + CFG.blockSize / 2, z: streetCoord(2) + CFG.roadWidth / 2 + 2.5 + CFG.blockSize / 2 };

  return {
    group,
    colliders,
    buildings,
    nodes,
    adj,
    half: HALF,
    // Landmarks the missions use.
    spirePos: { x: plazaBlock.x, z: plazaBlock.z },
    docksPos: { x: 55, z: HALF + 12 },
    pierPos: { x: 55, z: HALF + 12 },
    pawnShopPos: { x: streetCoord(4) + 8, z: streetCoord(1) },
    garagePos: { x: streetCoord(1), z: streetCoord(5) + 8 },
    marinaPos: { x: streetCoord(5), z: streetCoord(4) - 8 },
    clinicPos: { x: streetCoord(0), z: streetCoord(0) },
    spawnPos: { x: streetCoord(3), z: streetCoord(3) + 4 },
    // Helpers.
    nearestNode(x, z) {
      let best = 0;
      let bd = Infinity;
      for (let n = 0; n < nodes.length; n++) {
        const dx = nodes[n].x - x;
        const dz = nodes[n].z - z;
        const d = dx * dx + dz * dz;
        if (d < bd) { bd = d; best = n; }
      }
      return best;
    },
    // Push a circle out of every building AABB; returns true when a hit happened.
    resolveCircle(pos, radius) {
      let hit = false;
      for (const c of colliders) {
        const nx = Math.max(c.minX, Math.min(pos.x, c.maxX));
        const nz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
        const dx = pos.x - nx;
        const dz = pos.z - nz;
        const d2 = dx * dx + dz * dz;
        if (d2 < radius * radius) {
          hit = true;
          if (d2 > 0.0001) {
            const d = Math.sqrt(d2);
            pos.x = nx + (dx / d) * radius;
            pos.z = nz + (dz / d) * radius;
          } else {
            // Centre inside the box: push out along the smallest penetration.
            const pl = pos.x - c.minX;
            const pr = c.maxX - pos.x;
            const pt = pos.z - c.minZ;
            const pb = c.maxZ - pos.z;
            const m = Math.min(pl, pr, pt, pb);
            if (m === pl) pos.x = c.minX - radius;
            else if (m === pr) pos.x = c.maxX + radius;
            else if (m === pt) pos.z = c.minZ - radius;
            else pos.z = c.maxZ + radius;
          }
        }
      }
      return hit;
    },
    clampToCity(pos, margin) {
      const lim = HALF + 14 - margin;
      pos.x = Math.max(-lim, Math.min(lim, pos.x));
      pos.z = Math.max(-lim, Math.min(lim, pos.z));
    },
  };
}
