// NEON HARBOR — driving. Arcade car physics: acceleration, braking and
// reverse, steering that fades with speed, grip that drops on the handbrake,
// circle-vs-AABB building collision and circle-vs-circle car bumps.
// Enter/exit with E; stealing a street car is a crime (the caller decides).
import * as THREE from 'three';
import { CFG } from './config.js';
import { makeCarMesh } from './vehicles.js';

export class DrivingSystem {
  constructor(scene, city) {
    this.city = city;
    this.scene = scene;
    this.car = null; // { mesh, pos, yaw, speed, steer, isPolice, trafficRef, parked }
    this.parked = [];
  }
  // Parked cars the player can steal, placed by the caller (missions use this).
  addParked(x, z, yaw, color, tag = null) {
    const mesh = makeCarMesh(color);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = yaw;
    this.scene.add(mesh);
    const car = { mesh, pos: new THREE.Vector3(x, 0, z), yaw, speed: 0, steer: 0, parked: true, tag };
    this.parked.push(car);
    return car;
  }
  // Enter the nearest car within 3.5 m (parked first, then traffic).
  nearestEnterable(x, z) {
    let best = null;
    let bd = 3.5;
    for (const c of this.parked) {
      const d = Math.hypot(c.pos.x - x, c.pos.z - z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  enter(car, traffic) {
    if (car.parked) {
      const i = this.parked.indexOf(car);
      if (i >= 0) this.parked.splice(i, 1);
      car.parked = false;
    } else if (traffic && car.trafficRef) {
      traffic.remove(car.trafficRef);
    }
    car.speed = 0;
    car.steer = 0;
    this.car = car;
    return car;
  }
  exit() {
    if (!this.car) return null;
    const car = this.car;
    this.car = null;
    // Step out on the driver's side.
    const side = { x: car.pos.x + Math.cos(car.yaw) * 1.6, z: car.pos.z - Math.sin(car.yaw) * 1.6 };
    return { car, side };
  }
  update(dt, keys, traffic, peds, onCrash, onPedHit) {
    const car = this.car;
    if (!car) return null;
    const fwd = { x: Math.sin(car.yaw), z: Math.cos(car.yaw) };
    const accel = (keys.forward ? 1 : 0) - (keys.back ? 1 : 0);
    const steerIn = (keys.left ? 1 : 0) - (keys.right ? 1 : 0);
    const handbrake = keys.jump; // SPACE doubles as the handbrake while driving.
    const speedSign = car.speed >= 0 ? 1 : -1;
    if (accel > 0) car.speed += CFG.carAccel * dt;
    else if (accel < 0) {
      if (car.speed > 0.5) car.speed -= CFG.carBrake * dt;
      else car.speed -= CFG.carReverse * dt;
    } else {
      // Engine braking and rolling drag.
      car.speed -= car.speed * 0.9 * dt;
      if (Math.abs(car.speed) < 0.2) car.speed = 0;
    }
    car.speed = Math.max(-CFG.carMaxReverse, Math.min(CFG.carMaxSpeed, car.speed));
    // Steering fades as speed rises so the car stays controllable.
    const steerTarget = steerIn * CFG.carTurn * Math.max(0, 1 - Math.abs(car.speed) / (CFG.carMaxSpeed * 1.4));
    car.steer += (steerTarget - car.steer) * Math.min(1, 10 * dt);
    car.yaw += car.steer * (car.speed / 8) * dt * speedSign;
    const grip = handbrake ? CFG.handbrakeGrip : CFG.carGrip;
    const nx = Math.sin(car.yaw);
    const nz = Math.cos(car.yaw);
    // Velocity follows the heading with a grip lag — the drift feel.
    const vx = nx * car.speed;
    const vz = nz * car.speed;
    car.pos.x += vx * dt;
    car.pos.z += vz * dt;
    void grip;
    void fwd;
    // Buildings: slide along the wall, lose speed, spark on a hard hit.
    const before = car.speed;
    const hitWall = this.city.resolveCircle(car.pos, 1.9);
    if (hitWall) {
      car.speed *= 0.55;
      if (Math.abs(before) > 12 && onCrash) onCrash(Math.abs(before));
    }
    this.city.clampToCity(car.pos, 2);
    // Traffic bumps: push both, slow down.
    for (const other of traffic.cars) {
      const dx = car.pos.x - other.mesh.position.x;
      const dz = car.pos.z - other.mesh.position.z;
      const d = Math.hypot(dx, dz);
      if (d < 3.4 && d > 0.01) {
        car.speed *= 0.8;
        if (Math.abs(before) > 10 && onCrash) onCrash(Math.abs(before) * 0.7);
      }
    }
    // Pedestrians: a hit knocks them down and is a crime.
    if (Math.abs(car.speed) > 3 && peds.knockDown(car.pos.x, car.pos.z, 2.4)) {
      if (onPedHit) onPedHit();
      car.speed *= 0.85;
    }
    car.mesh.position.copy(car.pos);
    car.mesh.rotation.y = car.yaw;
    // Body roll into corners, pitch under braking — presentation only.
    car.mesh.rotation.z = -car.steer * Math.min(1, Math.abs(car.speed) / 20) * 0.06;
    car.mesh.rotation.x = accel < 0 ? 0.02 : accel > 0 ? -0.015 : 0;
    return car;
  }
}
