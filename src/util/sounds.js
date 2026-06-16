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

  // Spring boing — pitch rises sharply then falls slowly, like a cartoon spring.
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
    // Quick rise (impact), then slow fall (spring releasing) — that's the boing shape.
    osc.frequency.setValueAtTime(130, t);
    osc.frequency.exponentialRampToValueAtTime(520, t + 0.04);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.38);

    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    osc.start(t);
    osc.stop(t + 0.4);
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
