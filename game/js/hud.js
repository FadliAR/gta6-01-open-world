// NEON HARBOR — the HUD. DOM reads and writes live here and nowhere else:
// wanted stars, cash, health, objective, mission checklist, toasts, and the
// canvas minimap (roads, player, cops, traffic, mission beacon). Values are
// written only when they change, so the HUD costs nothing most frames.
import { MISSION_NAMES } from './config.js';

export class HUD {
  constructor(city) {
    this.city = city;
    this.el = {
      hud: document.getElementById('hud'),
      wanted: document.getElementById('wanted'),
      cash: document.getElementById('cash'),
      healthFill: document.getElementById('health-fill'),
      healthText: document.getElementById('health-text'),
      objTitle: document.getElementById('objective-title'),
      objText: document.getElementById('objective-text'),
      missions: document.getElementById('missions'),
      toast: document.getElementById('toast'),
      speed: document.getElementById('speed'),
      vignette: document.getElementById('vignette'),
      flash: document.getElementById('damage-flash'),
    };
    this.map = document.getElementById('minimap').getContext('2d');
    this.last = {};
    this.toastTimer = null;
  }
  show() {
    this.el.hud.classList.remove('hidden');
  }
  hide() {
    this.el.hud.classList.add('hidden');
  }
  set(key, el, value) {
    if (this.last[key] !== value) {
      this.last[key] = value;
      el.textContent = value;
    }
  }
  toast(text, ms = 2600) {
    this.el.toast.textContent = text;
    this.el.toast.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.el.toast.classList.remove('show'), ms);
  }
  damageFlash() {
    this.el.flash.classList.add('hit');
    setTimeout(() => this.el.flash.classList.remove('hit'), 130);
  }
  update(state) {
    // Wanted stars: filled gold, the rest dim.
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < state.wanted ? '★' : '☆';
    this.set('wanted', this.el.wanted, stars);
    this.el.wanted.innerHTML = [...stars].map((s) => (s === '★' ? s : `<span class="dim">${s}</span>`)).join('');
    this.set('cash', this.el.cash, `$${state.cash}`);
    const hp = Math.max(0, Math.round(state.health));
    if (this.last.health !== hp) {
      this.last.health = hp;
      this.el.healthFill.style.width = `${hp}%`;
      this.el.healthText.textContent = String(hp);
      this.el.vignette.classList.toggle('low', hp <= 30);
    }
    this.set('objTitle', this.el.objTitle, state.objective.title);
    this.set('objText', this.el.objText, state.objective.text);
    this.set('speed', this.el.speed, String(Math.round(Math.abs(state.speedKmh))));
    // Mission checklist.
    const list = MISSION_NAMES.map((n, i) => {
      const cls = state.missionsDone[i] ? 'done' : i === state.missionIndex ? 'active' : 'todo';
      const mark = state.missionsDone[i] ? '✓ ' : i === state.missionIndex ? '▶ ' : '· ';
      return `<div class="${cls}">${mark}${n}</div>`;
    }).join('');
    if (this.last.missions !== list) {
      this.last.missions = list;
      this.el.missions.innerHTML = list;
    }
    this.drawMinimap(state);
  }
  drawMinimap(state) {
    const ctx = this.map;
    const S = 200;
    const half = this.city.half + 20;
    const toMap = (x, z) => [S / 2 + (x / half) * (S / 2), S / 2 + (z / half) * (S / 2)];
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = '#0a0e1a';
    ctx.fillRect(0, 0, S, S);
    // Water at the bottom (south).
    ctx.fillStyle = '#0b3049';
    const [, wy] = toMap(0, this.city.half);
    ctx.fillRect(0, wy, S, S - wy);
    // Roads.
    ctx.strokeStyle = '#3a4152';
    ctx.lineWidth = 4;
    const PITCH = 55;
    for (let k = 0; k < 7; k++) {
      const s = (k - 3) * PITCH;
      const [x1] = toMap(s, 0);
      ctx.beginPath(); ctx.moveTo(x1, 0); ctx.lineTo(x1, S); ctx.stroke();
      const [, z1] = toMap(0, s);
      ctx.beginPath(); ctx.moveTo(0, z1); ctx.lineTo(S, z1); ctx.stroke();
    }
    // Mission beacon: pulsing yellow diamond.
    if (state.beacon) {
      const [bx, by] = toMap(state.beacon.x, state.beacon.z);
      const r = 5 + Math.sin(performance.now() / 220) * 2;
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath();
      ctx.moveTo(bx, by - r - 2); ctx.lineTo(bx + r, by); ctx.lineTo(bx, by + r + 2); ctx.lineTo(bx - r, by);
      ctx.closePath(); ctx.fill();
    }
    // Traffic: grey dots. Police: blue dots. Player: white arrow.
    ctx.fillStyle = '#8a93a8';
    for (const c of state.traffic) {
      const [x, y] = toMap(c.x, c.z);
      ctx.fillRect(x - 1, y - 1, 2, 2);
    }
    ctx.fillStyle = '#3b82ff';
    for (const c of state.cops) {
      const [x, y] = toMap(c.x, c.z);
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
    }
    const [px, py] = toMap(state.player.x, state.player.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(state.playerYaw);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    // North marker.
    ctx.fillStyle = '#cdd6ff';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('N', S / 2 - 4, 12);
  }
}
