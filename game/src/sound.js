// Synthesized sound effects via WebAudio. No external audio files.
// The context starts lazily on the first user gesture; until then every
// call is a silent no-op.
export function createSound() {
  let ctx = null;
  let lastTick = 0;

  function ensure() {
    if (ctx !== null) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    } catch (e) {
      ctx = null;
    }
    return ctx;
  }

  function tone(freq, dur, type, vol, when = 0) {
    const c = ensure();
    if (!c) return;
    try {
      if (c.state === 'suspended') c.resume();
      const t0 = c.currentTime + when;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    } catch (e) {
      // audio is decoration; never break the game over it
    }
  }

  return {
    resume() {
      ensure();
    },
    play(name) {
      if (name === 'tick') {
        // Throttle repair ticks so they don't buzz every frame.
        const now = performance.now();
        if (now - lastTick < 120) return;
        lastTick = now;
        tone(620, 0.05, 'square', 0.04);
        return;
      }
      if (name === 'fix') {
        tone(523, 0.12, 'sine', 0.12);
        tone(784, 0.18, 'sine', 0.12, 0.09);
        return;
      }
      if (name === 'pickup') {
        tone(880, 0.08, 'triangle', 0.1);
        tone(1174, 0.12, 'triangle', 0.1, 0.07);
        return;
      }
      if (name === 'duck') {
        tone(988, 0.07, 'square', 0.07);
        tone(1318, 0.07, 'square', 0.07, 0.06);
        tone(1568, 0.12, 'square', 0.07, 0.12);
        return;
      }
      if (name === 'alarm') {
        tone(220, 0.2, 'sawtooth', 0.09);
        tone(220, 0.2, 'sawtooth', 0.09, 0.22);
        return;
      }
      if (name === 'win') {
        tone(523, 0.14, 'sine', 0.12);
        tone(659, 0.14, 'sine', 0.12, 0.12);
        tone(784, 0.14, 'sine', 0.12, 0.24);
        tone(1046, 0.3, 'sine', 0.12, 0.36);
        return;
      }
      if (name === 'lose') {
        tone(392, 0.25, 'sawtooth', 0.08);
        tone(311, 0.25, 'sawtooth', 0.08, 0.22);
        tone(233, 0.5, 'sawtooth', 0.08, 0.44);
      }
    },
  };
}
