const Sound = {
  ctx: null,
  enabled: false,
  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.enabled = true;
    } catch (e) {
      this.enabled = false;
    }
  },
  tone(freq, dur, type) {
    if (!this.enabled || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + dur);
    } catch (e) {
      // audio is decoration; never break the game
    }
  },
  repair() {
    this.tone(660, 0.12, 'square');
    setTimeout(() => this.tone(880, 0.15, 'square'), 90);
  },
  pickup() {
    this.tone(980, 0.1, 'sine');
  },
  burst() {
    this.tone(180, 0.25, 'sawtooth');
  },
  win() {
    this.tone(523, 0.15, 'sine');
    setTimeout(() => this.tone(659, 0.15, 'sine'), 140);
    setTimeout(() => this.tone(784, 0.3, 'sine'), 280);
  },
  lose() {
    this.tone(220, 0.4, 'sawtooth');
    setTimeout(() => this.tone(147, 0.5, 'sawtooth'), 200);
  },
};
