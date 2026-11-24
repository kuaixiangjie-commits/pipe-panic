// All sound is synthesised with WebAudio — no audio files, no network.
export class Sound {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  ensure() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) {
        this.enabled = false;
        return;
      }
      this.ctx = new AC();
    } catch {
      this.enabled = false;
    }
  }

  resume() {
    this.ensure();
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }

  tone(freq, dur, type = "sine", vol = 0.08, when = 0) {
    if (!this.enabled) return;
    this.ensure();
    if (!this.ctx) return;
    try {
      const t0 = this.ctx.currentTime + when;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g);
      g.connect(this.ctx.destination);
      o.start(t0);
      o.stop(t0 + dur + 0.02);
    } catch {
      // Audio must never break the game.
    }
  }

  repairTick() {
    this.tone(520, 0.05, "square", 0.03);
  }

  fixed() {
    this.tone(660, 0.12, "sine", 0.09);
    this.tone(880, 0.18, "sine", 0.09, 0.09);
  }

  pickup() {
    this.tone(740, 0.08, "triangle", 0.08);
    this.tone(990, 0.12, "triangle", 0.08, 0.07);
  }

  duck() {
    this.tone(1180, 0.07, "square", 0.05);
    this.tone(1560, 0.09, "square", 0.05, 0.06);
  }

  reburst() {
    this.tone(180, 0.3, "sawtooth", 0.07);
  }

  win() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.16, "sine", 0.09, i * 0.12));
  }

  lose() {
    [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.22, "sine", 0.08, i * 0.15));
  }
}
