// Pipe Panic! — tiny synthesized sound effects (WebAudio, no audio files).
// Everything is best-effort and guarded: if audio is unavailable the game
// keeps running silently and never throws.
export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = false;
    this._lastTick = 0;
  }

  // Call from a user gesture (starting the game).
  unlock() {
    if (this.enabled) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.12;
      this.master.connect(this.ctx.destination);
      this.enabled = true;
    } catch {
      this.enabled = false;
    }
  }

  _tone(freq, dur, type = "sine", vol = 1, delay = 0) {
    if (!this.enabled || !this.ctx) return;
    try {
      const t0 = this.ctx.currentTime + delay;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.9 * vol, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g);
      g.connect(this.master);
      o.start(t0);
      o.stop(t0 + dur + 0.05);
    } catch {
      // Sound is best-effort; never let it break the game.
    }
  }

  click() {
    this._tone(520, 0.07, "triangle", 0.8);
  }

  // Short wrench tick while repairing (throttled so it does not buzz).
  tick() {
    const now = performance.now();
    if (now - this._lastTick < 90) return;
    this._lastTick = now;
    this._tone(740, 0.05, "square", 0.35);
  }

  fixed() {
    this._tone(660, 0.09, "triangle", 0.9);
    this._tone(880, 0.14, "triangle", 0.9, 0.09);
  }

  pickup() {
    this._tone(520, 0.06, "sine", 0.8);
    this._tone(780, 0.09, "sine", 0.8, 0.06);
  }

  quack() {
    this._tone(300, 0.07, "square", 0.5);
    this._tone(240, 0.09, "square", 0.5, 0.08);
  }

  alarm() {
    this._tone(196, 0.22, "sawtooth", 0.5);
  }

  win() {
    [523, 659, 784, 1046].forEach((f, i) => this._tone(f, 0.16, "triangle", 0.9, i * 0.12));
  }

  lose() {
    [392, 330, 262, 196].forEach((f, i) => this._tone(f, 0.2, "triangle", 0.8, i * 0.14));
  }
}
