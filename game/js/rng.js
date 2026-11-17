// SplitMix64 — a tiny PRNG whose sequence we own. Same seed, same world,
// on every browser and every run, so screenshots and bug reports replay.
export class SplitMix64 {
  constructor(seed) {
    this.state = BigInt(seed >>> 0) & 0xffffffffffffffffn;
  }
  nextU64() {
    this.state = (this.state + 0x9e3779b97f4a7c15n) & 0xffffffffffffffffn;
    let z = this.state;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & 0xffffffffffffffffn;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & 0xffffffffffffffffn;
    return z ^ (z >> 31n);
  }
  // Uniform float in [0, 1).
  next() {
    return Number(this.nextU64() >> 11n) / 9007199254740992;
  }
  // Integer in [min, max).
  int(min, max) {
    return min + Math.floor(this.next() * (max - min));
  }
  // Float in [min, max).
  range(min, max) {
    return min + this.next() * (max - min);
  }
  // One element of an array.
  pick(arr) {
    return arr[this.int(0, arr.length)];
  }
  // Child stream per system, so adding a roll in one system never reshuffles another.
  child(salt) {
    return new SplitMix64(Number((this.nextU64() ^ BigInt(salt)) & 0xffffffffn));
  }
}
