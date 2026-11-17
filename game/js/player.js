// NEON HARBOR — the player on foot. "Rook", a courier who picked the wrong
// package. WASD relative to the camera, run, jump, punch. Movement is fixed
// timestep; the camera yaw comes from the camera module each frame.
import * as THREE from 'three';
import { CFG } from './config.js';

function makePlayerMesh() {
  const g = new THREE.Group();
  const jacket = new THREE.MeshStandardMaterial({ color: 0x1f8a4c, roughness: 0.85 });
  const jeans = new THREE.MeshStandardMaterial({ color: 0x2a3a55, roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xe8b98a, roughness: 0.8 });
  const cap = new THREE.MeshStandardMaterial({ color: 0xd8b13a, roughness: 0.85 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.66, 0.34), jacket);
  torso.position.y = 1.08;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 12, 10), skin);
  head.position.y = 1.6;
  const capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.1, 12), cap);
  capTop.position.y = 1.76;
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.04, 0.24), cap);
  brim.position.set(0, 1.72, 0.26);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.74, 0.22), jeans);
  legL.position.set(-0.14, 0.37, 0);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.74, 0.22), jeans);
  legR.position.set(0.14, 0.37, 0);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.58, 0.17), jacket);
  armL.position.set(-0.37, 1.08, 0);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.58, 0.17), jacket);
  armR.position.set(0.37, 1.08, 0);
  g.add(torso, head, capTop, brim, legL, legR, armL, armR);
  g.userData.limbs = { legL, legR, armL, armR, torso };
  return g;
}

export class Player {
  constructor(scene, spawn) {
    this.mesh = makePlayerMesh();
    scene.add(this.mesh);
    this.pos = new THREE.Vector3(spawn.x, 0, spawn.z);
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.onGround = true;
    this.health = CFG.playerHealth;
    this.punchTimer = 0;
    this.punchAnim = 0;
    this.walkPhase = 0;
    this.speed2d = 0;
    this.mesh.position.copy(this.pos);
  }
  reset(spawn) {
    this.pos.set(spawn.x, 0, spawn.z);
    this.vel.set(0, 0, 0);
    this.health = CFG.playerHealth;
    this.punchTimer = 0;
    this.mesh.position.copy(this.pos);
  }
  // keys: {forward, back, left, right, run, jump, punch} — cameraYaw in radians.
  update(dt, keys, cameraYaw, city) {
    this.punchTimer = Math.max(0, this.punchTimer - dt);
    this.punchAnim = Math.max(0, this.punchAnim - dt * 4);
    const f = (keys.forward ? 1 : 0) - (keys.back ? 1 : 0);
    const s = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    const sin = Math.sin(cameraYaw);
    const cos = Math.cos(cameraYaw);
    // Forward is the camera's look direction (sin, cos) on the ground plane;
    // right is (-cos, sin). W walks away from the camera, into the screen.
    let mx = sin * f - cos * s;
    let mz = cos * f + sin * s;
    const ml = Math.hypot(mx, mz);
    if (ml > 0.01) {
      mx /= ml;
      mz /= ml;
      this.yaw = Math.atan2(mx, mz);
    }
    const target = keys.run ? CFG.runSpeed : CFG.walkSpeed;
    const vx = mx * target;
    const vz = mz * target;
    // Snappy accel on the ground, air control kept light.
    const k = this.onGround ? 14 : 5;
    this.vel.x += (vx - this.vel.x) * Math.min(1, k * dt);
    this.vel.z += (vz - this.vel.z) * Math.min(1, k * dt);
    this.vel.y -= CFG.gravity * dt;
    if (keys.jump && this.onGround) {
      this.vel.y = CFG.jumpSpeed;
      this.onGround = false;
    }
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.pos.y += this.vel.y * dt;
    if (this.pos.y <= 0) {
      this.pos.y = 0;
      this.vel.y = 0;
      this.onGround = true;
    }
    city.resolveCircle(this.pos, CFG.playerRadius);
    city.clampToCity(this.pos, CFG.playerRadius + 0.5);
    // Squash on landing, stretch on jump — presentation only.
    const squash = this.onGround ? 1 : 1.06;
    this.speed2d = Math.hypot(this.vel.x, this.vel.z);
    this.walkPhase += dt * this.speed2d * 2.4;
    const swing = this.speed2d > 0.5 ? Math.sin(this.walkPhase) * 0.5 : 0;
    const L = this.mesh.userData.limbs;
    L.legL.rotation.x = swing;
    L.legR.rotation.x = -swing;
    L.armL.rotation.x = -swing * 0.8 + (this.punchAnim > 0 ? -1.4 * this.punchAnim : 0);
    L.armR.rotation.x = swing * 0.8;
    L.torso.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.yaw;
  }
  tryPunch() {
    if (this.punchTimer > 0) return false;
    this.punchTimer = CFG.punchCooldown;
    this.punchAnim = 1;
    return true;
  }
  // Point 2.2 m ahead of the player, for hit tests.
  punchPoint() {
    return {
      x: this.pos.x + Math.sin(this.yaw) * 1.4,
      z: this.pos.z + Math.cos(this.yaw) * 1.4,
    };
  }
  hurt(amount) {
    this.health = Math.max(0, this.health - amount);
    return this.health <= 0;
  }
  heal(amount) {
    this.health = Math.min(CFG.playerHealth, this.health + amount);
  }
}
