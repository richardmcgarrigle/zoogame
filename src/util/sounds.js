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

    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.08);

    gain.gain.setValueAtTime(0.45, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.start(t);
    osc.stop(t + 0.12);
  }

  // Call every update frame while the elephant is running on the ground.
  tickFootsteps(delta, isGrounded, isMoving) {
    if (!isGrounded || !isMoving) {
      this._footstepTimer = 0;
      return;
    }
    this._footstepTimer += delta;
    if (this._footstepTimer >= this._footstepInterval) {
      this._footstepTimer -= this._footstepInterval;
      this._playFootstep();
    }
  }

  // Descending sine chirp — fruit bounces off a platform.
  playBounce(velocityMagnitude = 5) {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const vol = Math.min(velocityMagnitude / 12, 1) * 0.5;
    if (vol < 0.05) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, t);
    osc.frequency.exponentialRampToValueAtTime(110, t + 0.18);

    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    osc.start(t);
    osc.stop(t + 0.2);
  }

  // Filtered white noise burst — crate explosion crack.
  playCrateBreak() {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const duration = 0.22;

    const bufSize = Math.ceil(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    // High-pass to make it crackly, not boomy.
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 800;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.6, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    source.connect(hp);
    hp.connect(gain);
    gain.connect(ctx.destination);

    source.start(t);
    source.stop(t + duration);
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
