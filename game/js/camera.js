// NEON HARBOR — the camera. Third-person orbit: drag to look, scroll to
// zoom. Follow uses exponential smoothing (1 - exp(-rate * dt)) so it feels
// identical at 30 and 144 fps, with a small deadzone and velocity look-ahead.
// Shake is added last, on top of the smooth follow, never inside it.
import * as THREE from 'three';
import { CFG } from './config.js';

export class FollowCamera {
  constructor(camera, city) {
    this.camera = camera;
    this.city = city;
    this.yaw = 0;
    this.pitch = 0.32;
    this.dist = CFG.camFootDist;
    this.target = new THREE.Vector3();
    this.focus = new THREE.Vector3();
    this.snap = true;
  }
  reset(yaw, focus) {
    this.yaw = yaw;
    this.focus.copy(focus);
    this.target.copy(focus);
    this.snap = true;
  }
  addOrbit(dx, dy) {
    this.yaw -= dx * 0.0042;
    this.pitch = Math.max(0.08, Math.min(1.1, this.pitch + dy * 0.0032));
  }
  addZoom(delta) {
    this.dist = Math.max(4.5, Math.min(16, this.dist + delta * 0.002));
  }
  update(dt, focusPos, velocity, inCar, shakeOffset) {
    const wantDist = inCar ? CFG.camCarDist : this.dist;
    // Deadzone: ignore tiny focus movement so the camera never twitches.
    const dx = focusPos.x - this.focus.x;
    const dz = focusPos.z - this.focus.z;
    const dzx = Math.abs(dx) > 0.4 ? dx - Math.sign(dx) * 0.4 : 0;
    const dzz = Math.abs(dz) > 0.4 ? dz - Math.sign(dz) * 0.4 : 0;
    this.focus.x += dzx;
    this.focus.z += dzz;
    this.focus.y = focusPos.y + 1.6;
    // Look-ahead: aim a little past the motion.
    const speed = Math.hypot(velocity.x, velocity.z);
    const lead = Math.min(3.5, speed * 0.22);
    const lx = speed > 0.5 ? (velocity.x / speed) * lead : 0;
    const lz = speed > 0.5 ? (velocity.z / speed) * lead : 0;
    this.target.set(this.focus.x + lx, this.focus.y, this.focus.z + lz);
    // Camera position on the orbit sphere behind the target.
    const cx = this.target.x - Math.sin(this.yaw) * Math.cos(this.pitch) * wantDist;
    const cz = this.target.z - Math.cos(this.yaw) * Math.cos(this.pitch) * wantDist;
    const cy = this.target.y + Math.sin(this.pitch) * wantDist;
    const t = this.snap ? 1 : 1 - Math.exp(-CFG.camFollowRate * dt);
    this.snap = false;
    this.camera.position.x += (cx - this.camera.position.x) * t;
    this.camera.position.y += (cy - this.camera.position.y) * t;
    this.camera.position.z += (cz - this.camera.position.z) * t;
    // Never let the camera sink under the street or inside a building.
    if (this.camera.position.y < 0.7) this.camera.position.y = 0.7;
    const probe = { x: this.camera.position.x, z: this.camera.position.z };
    if (this.city.resolveCircle(probe, 0.6)) {
      this.camera.position.x = probe.x;
      this.camera.position.z = probe.z;
    }
    this.camera.position.x += shakeOffset.x;
    this.camera.position.y += shakeOffset.y;
    this.camera.lookAt(this.target.x, this.target.y, this.target.z);
  }
  // The yaw the player moves relative to: the camera looks along
  // (sin(yaw), cos(yaw)), so W walks in exactly that direction.
  get moveYaw() {
    return this.yaw;
  }
}
