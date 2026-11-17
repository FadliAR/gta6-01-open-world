// NEON HARBOR — synthesized sound. No audio files ship with the game:
// engine hum, sirens, pickups, crashes and UI clicks are all oscillators
// and filtered noise built with the Web Audio API. Starts on first gesture.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenLfo = null;
    this.lastBlip = 0;
  }
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    // Engine: a low sawtooth through a low-pass filter.
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 320;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(filt).connect(this.engineGain).connect(this.ctx.destination);
    this.engineOsc.start();
    // Siren: a sine whose pitch wobbles between two tones.
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'sine';
    this.sirenOsc.frequency.value = 750;
    this.sirenLfo = this.ctx.createOscillator();
    this.sirenLfo.type = 'square';
    this.sirenLfo.frequency.value = 0.55;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 180;
    this.sirenLfo.connect(lfoGain).connect(this.sirenOsc.frequency);
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain).connect(this.ctx.destination);
    this.sirenOsc.start();
    this.sirenLfo.start();
  }
  resume() {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }
  setMuted(m) {
    this.muted = m;
    if (this.ctx) void this.ctx.destination;
    if (this.engineGain) this.engineGain.gain.value = m ? 0 : this.engineGain.gain.value;
    if (this.sirenGain) this.sirenGain.gain.value = m ? 0 : this.sirenGain.gain.value;
  }
  // speed01: 0..1 while driving; 0 when on foot.
  setEngine(speed01, on) {
    if (!this.ctx || this.muted) return;
    const target = on ? 0.03 + speed01 * 0.06 : 0;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
    this.engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, this.ctx.currentTime, 0.1);
  }
  setSiren(on) {
    if (!this.ctx) return;
    this.sirenGain.gain.setTargetAtTime(on && !this.muted ? 0.028 : 0, this.ctx.currentTime, 0.2);
  }
  blip(freq = 880, dur = 0.09, type = 'sine', vol = 0.12) {
    if (!this.ctx || this.muted) return;
    const now = performance.now();
    if (now - this.lastBlip < 40) return;
    this.lastBlip = now;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start();
    o.stop(this.ctx.currentTime + dur);
  }
  thud(strength = 1) {
    if (!this.ctx || this.muted) return;
    const dur = 0.18;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 300;
    const g = this.ctx.createGain();
    g.gain.value = 0.25 * Math.min(1, strength);
    src.connect(filt).connect(g).connect(this.ctx.destination);
    src.start();
  }
  success() {
    this.blip(660, 0.1);
    setTimeout(() => this.blip(880, 0.12), 90);
    setTimeout(() => this.blip(1320, 0.18), 180);
  }
}
