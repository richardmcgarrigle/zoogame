export default class SoundManager {
  constructor(audioContext) {
    this.ctx = audioContext;
    this._footstepTimer = 0;
    this._footstepInterval = 280; // ms between footstep thuds
  }

  // Short low percussive thud — one footstep.
  _playFootstep() {
    const ctx = this.ctx;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    // Slightly randomize pitch and volume each step so no two sound identical.
    const pitchStart = 100 + Math.random() * 40;
    const pitchEnd   = 45  + Math.random() * 20;
    const vol        = 0.3 + Math.random() * 0.2;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(pitchStart, t);
    osc.frequency.exponentialRampToValueAtTime(pitchEnd, t + 0.08);

    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.start(t);
    osc.stop(t + 0.12);
  }

  // Call every update frame while the elephant is running on the ground.
  // speedAbs: absolute horizontal speed (px per physics unit).
  tickFootsteps(delta, isGrounded, speedAbs) {
    if (!isGrounded || speedAbs < 1) {
      this._footstepTimer = 0;
      return;
    }
    // Faster movement → shorter interval. Walk ~4.5 ≈ 280ms, dash ~9 ≈ 160ms.
    const baseInterval = Math.max(140, 340 - speedAbs * 22);
    // ±25% random jitter so steps don't feel mechanical.
    const interval = baseInterval * (0.75 + Math.random() * 0.5);

    this._footstepTimer += delta;
    if (this._footstepTimer >= interval) {
      this._footstepTimer = 0;
      this._playFootstep();
    }
  }

  // Spring twang — zigzag pitch that oscillates high/low while decaying.
  playBounce(velocityMagnitude = 5) {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const vol = Math.min(velocityMagnitude / 12, 1) * 0.55;
    if (vol < 0.05) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    // Oscillating peaks/valleys that decay — the characteristic spring wobble.
    osc.frequency.setValueAtTime(620, t);
    osc.frequency.exponentialRampToValueAtTime(280, t + 0.04);
    osc.frequency.exponentialRampToValueAtTime(540, t + 0.08);
    osc.frequency.exponentialRampToValueAtTime(260, t + 0.12);
    osc.frequency.exponentialRampToValueAtTime(450, t + 0.16);
    osc.frequency.exponentialRampToValueAtTime(240, t + 0.20);
    osc.frequency.exponentialRampToValueAtTime(360, t + 0.24);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.30);

    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);

    osc.start(t);
    osc.stop(t + 0.32);
  }

  // Heavy wooden crate smash: bass thud + mid-frequency wood crack.
  playCrateBreak() {
    const ctx = this.ctx;
    const t = ctx.currentTime;

    // Layer 1: deep impact thud — the elephant's mass hitting the crate.
    const thud = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thud.connect(thudGain);
    thudGain.connect(ctx.destination);
    thud.type = 'sine';
    thud.frequency.setValueAtTime(140, t);
    thud.frequency.exponentialRampToValueAtTime(40, t + 0.18);
    thudGain.gain.setValueAtTime(0.9, t);
    thudGain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    thud.start(t);
    thud.stop(t + 0.28);

    // Layer 2: wood splinter crack — bandpass noise in the midrange.
    const duration = 0.45;
    const bufSize = Math.ceil(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 350;
    bp.Q.value = 0.8;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.8, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    noise.connect(bp);
    bp.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(t);
    noise.stop(t + duration);
  }

  // Big stadium air horn blast — two detuned sawtooth waves through a low-pass filter.
  playGoalHorn() {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const duration = 1.4;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2200;
    lp.Q.value = 0.8;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0, t);
    masterGain.gain.linearRampToValueAtTime(0.5, t + 0.05);
    masterGain.gain.setValueAtTime(0.5, t + duration - 0.3);
    masterGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    lp.connect(masterGain);
    masterGain.connect(ctx.destination);

    // Higher pitch with an upward sweep at the start — celebratory, not industrial.
    for (const [start, end, detune] of [[360, 440, 0], [364, 445, 0]]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(start, t);
      osc.frequency.exponentialRampToValueAtTime(end, t + 0.12);
      osc.detune.value = detune;
      osc.connect(lp);
      osc.start(t);
      osc.stop(t + duration);
    }
  }

  // Short "land" thud — heavier than a footstep.
  playLand() {
    const ctx = this.ctx;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.14);

    gain.gain.setValueAtTime(0.6, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

    osc.start(t);
    osc.stop(t + 0.16);
  }
}
