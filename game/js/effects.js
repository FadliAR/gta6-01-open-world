// NEON HARBOR — juice. One pooled particle system, trauma-based camera
// shake (shake = trauma^2, decays in real time) and hit-stop measured on
// the wall clock. Juice never touches gameplay state: it only moves the
// camera, the time scale and the particles.
import * as THREE from 'three';
import { CFG } from './config.js';

const MAX_PARTICLES = 400;

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.trauma = 0;
    this.timeScale = 1;
    this.hitStopUntil = 0;
    this.hitStopId = 0;
    this.particles = [];
    const geo = new THREE.BufferGeometry();
    this.positions = new Float32Array(MAX_PARTICLES * 3);
    this.colors = new Float32Array(MAX_PARTICLES * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.35, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false,
    }));
    this.points.frustumCulled = false;
    scene.add(this.points);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push({ life: 0, maxLife: 1, vx: 0, vy: 0, vz: 0, x: 0, y: -100, z: 0 });
    }
    this.next = 0;
  }
  addTrauma(amount) {
    this.trauma = Math.min(1, this.trauma + amount);
  }
  hitStop(duration) {
    const id = ++this.hitStopId;
    this.hitStopUntil = performance.now() + duration * 1000;
    this.timeScale = 0.08;
    setTimeout(() => {
      if (id === this.hitStopId) this.timeScale = 1;
    }, duration * 1000);
  }
  burst(x, y, z, colorHex, count = 16, speed = 6) {
    const c = new THREE.Color(colorHex);
    for (let n = 0; n < count; n++) {
      const p = this.particles[this.next];
      this.next = (this.next + 1) % MAX_PARTICLES;
      p.life = p.maxLife = 0.5 + Math.random() * 0.5;
      p.x = x;
      p.y = y;
      p.z = z;
      const a = Math.random() * Math.PI * 2;
      const up = Math.random() * speed;
      p.vx = Math.cos(a) * speed * (0.4 + Math.random() * 0.6);
      p.vz = Math.sin(a) * speed * (0.4 + Math.random() * 0.6);
      p.vy = up;
      const i = this.particles.indexOf(p);
      this.colors[i * 3] = c.r;
      this.colors[i * 3 + 1] = c.g;
      this.colors[i * 3 + 2] = c.b;
    }
  }
  // Returns the camera shake offset for this frame (real-time decay).
  update(dt, realDt) {
    if (performance.now() > this.hitStopUntil && this.timeScale !== 1) this.timeScale = 1;
    this.trauma = Math.max(0, this.trauma - CFG.shakeDecay * realDt);
    const shake = this.trauma * this.trauma;
    const t = performance.now() / 1000 * 30;
    const offset = {
      x: 0.55 * shake * Math.sin(t * 1.7),
      y: 0.4 * shake * Math.sin(t * 2.3),
      z: 0,
    };
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (p.life > 0) {
        p.life -= dt;
        p.vy -= 14 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        if (p.y < 0.05) { p.y = 0.05; p.vy *= -0.4; }
      }
      this.positions[i * 3] = p.x;
      this.positions[i * 3 + 1] = p.life > 0 ? p.y : -100;
      this.positions[i * 3 + 2] = p.z;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
    return offset;
  }
}
