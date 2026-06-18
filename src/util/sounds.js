// Minimum computed volume below which bounce sounds are skipped (avoids near-silent pops).
const BOUNCE_VOL_FLOOR = 0.05;
// Master volume scale applied to all sounds. Raise to make the game louder overall.
const MASTER_VOLUME = 1.0;

export default class SoundManager {
  constructor(audioContext) {
    this.ctx = audioContext;
  }

  // Spring twang — zigzag pitch that oscillates high/low while decaying.
  playBounce(velocityMagnitude = 5) {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const vol = Math.min(velocityMagnitude / 12, 1) * 0.55 * MASTER_VOLUME;
    if (vol < BOUNCE_VOL_FLOOR) return;

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

  // Heavy wooden crate smash: sub-bass thud + rumble + wood crack + snap transient.
  playCrateBreak() {
    const ctx = this.ctx;
    const t = ctx.currentTime;

    // Layer 1: sub-bass punch — drops deep for a weighty feel.
    const thud = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thud.connect(thudGain);
    thudGain.connect(ctx.destination);
    thud.type = 'sine';
    thud.frequency.setValueAtTime(200, t);
    thud.frequency.exponentialRampToValueAtTime(22, t + 0.35);
    thudGain.gain.setValueAtTime(1.4, t);
    thudGain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    thud.start(t);
    thud.stop(t + 0.45);

    // Layer 2: low-frequency rumble noise for body/weight.
    const rumbleBuf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.5), ctx.sampleRate);
    const rumbleData = rumbleBuf.getChannelData(0);
    for (let i = 0; i < rumbleData.length; i++) rumbleData[i] = Math.random() * 2 - 1;
    const rumble = ctx.createBufferSource();
    rumble.buffer = rumbleBuf;
    const rumbleBp = ctx.createBiquadFilter();
    rumbleBp.type = 'lowpass';
    rumbleBp.frequency.value = 180;
    const rumbleGain = ctx.createGain();
    rumbleGain.gain.setValueAtTime(1.2, t);
    rumbleGain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    rumble.connect(rumbleBp);
    rumbleBp.connect(rumbleGain);
    rumbleGain.connect(ctx.destination);
    rumble.start(t);
    rumble.stop(t + 0.5);

    // Layer 3: mid-range wood crack noise.
    const crackBuf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.4), ctx.sampleRate);
    const crackData = crackBuf.getChannelData(0);
    for (let i = 0; i < crackData.length; i++) crackData[i] = Math.random() * 2 - 1;
    const crack = ctx.createBufferSource();
    crack.buffer = crackBuf;
    const crackBp = ctx.createBiquadFilter();
    crackBp.type = 'bandpass';
    crackBp.frequency.value = 500;
    crackBp.Q.value = 0.6;
    const crackGain = ctx.createGain();
    crackGain.gain.setValueAtTime(1.1, t);
    crackGain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    crack.connect(crackBp);
    crackBp.connect(crackGain);
    crackGain.connect(ctx.destination);
    crack.start(t);
    crack.stop(t + 0.4);

    // Layer 4: high-frequency snap transient for impact sharpness.
    const snapBuf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.08), ctx.sampleRate);
    const snapData = snapBuf.getChannelData(0);
    for (let i = 0; i < snapData.length; i++) snapData[i] = Math.random() * 2 - 1;
    const snap = ctx.createBufferSource();
    snap.buffer = snapBuf;
    const snapHp = ctx.createBiquadFilter();
    snapHp.type = 'highpass';
    snapHp.frequency.value = 2000;
    const snapGain = ctx.createGain();
    snapGain.gain.setValueAtTime(0.9, t);
    snapGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    snap.connect(snapHp);
    snapHp.connect(snapGain);
    snapGain.connect(ctx.destination);
    snap.start(t);
    snap.stop(t + 0.08);
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
