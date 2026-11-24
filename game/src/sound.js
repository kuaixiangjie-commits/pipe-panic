// Sound, all synthesized with WebAudio: no audio files, no network. The
// context starts on the player's first gesture (browsers block sound before
// one), and every call is guarded, so a browser without audio still plays.

export function createSound() {
  let context = null;
  let master = null;
  let hiss = null;
  let hissGain = null;

  function ensure() {
    if (context !== null) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
      // The leak hiss: a looped noise buffer through a low-pass filter.
      const length = context.sampleRate * 2;
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 900;
      hissGain = context.createGain();
      hissGain.gain.value = 0;
      source.connect(filter);
      filter.connect(hissGain);
      hissGain.connect(master);
      source.start();
      hiss = source;
      return true;
    } catch {
      context = null;
      return false;
    }
  }

  /** Call from the first user gesture so later sounds are allowed. */
  function unlock() {
    if (!ensure()) return;
    if (context.state === 'suspended') context.resume().catch(() => {});
  }

  function tone(freq, seconds, type, volume, when) {
    if (!ensure() || context.state !== 'running') return;
    try {
      const start = context.currentTime + (when || 0);
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(volume, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, start + seconds);
      osc.connect(gain);
      gain.connect(master);
      osc.start(start);
      osc.stop(start + seconds + 0.05);
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  /** A short ratchet click while the wrench turns. */
  function ratchet() {
    tone(1400 + Math.random() * 600, 0.05, 'square', 0.08);
  }

  /** A pipe fixed: a rising two-note chime. */
  function fix() {
    tone(523, 0.12, 'triangle', 0.2);
    tone(784, 0.2, 'triangle', 0.2, 0.09);
  }

  /** A pickup collected: a bright ding. */
  function ding() {
    tone(880, 0.1, 'sine', 0.18);
    tone(1318, 0.16, 'sine', 0.14, 0.07);
  }

  /** Pressure hits FLOODING: a two-tone alarm. */
  function alarm() {
    tone(660, 0.18, 'sawtooth', 0.12);
    tone(440, 0.18, 'sawtooth', 0.12, 0.2);
  }

  /** The shift is won: a little fanfare. */
  function win() {
    tone(523, 0.14, 'triangle', 0.22);
    tone(659, 0.14, 'triangle', 0.22, 0.12);
    tone(784, 0.14, 'triangle', 0.22, 0.24);
    tone(1046, 0.3, 'triangle', 0.22, 0.36);
  }

  /** The shift is lost: a low falling line. */
  function lose() {
    tone(392, 0.2, 'triangle', 0.2);
    tone(311, 0.2, 'triangle', 0.2, 0.18);
    tone(233, 0.4, 'triangle', 0.2, 0.36);
  }

  /** Hiss follows the nearest leak: loud up close, silent when dry. */
  function setHiss(distance) {
    if (!ensure() || !hissGain) return;
    try {
      const level = distance === Infinity ? 0 : Math.max(0, 1 - distance / 700) * 0.14;
      hissGain.gain.setTargetAtTime(level, context.currentTime, 0.2);
    } catch {
      // Ignore.
    }
  }

  return { unlock, ratchet, fix, ding, alarm, win, lose, setHiss };
}
