// Master volume scale applied to all sounds. Raise to make the game louder overall.
const MASTER_VOLUME = 1.0;

// Minimum computed volume below which bounce sounds are skipped (avoids near-silent pops).
const BOUNCE_VOL_FLOOR = 0.05;

// --- Bounce (spring twang) frequency keyframes (Hz) ---
// The alternating high/low ramp creates a characteristic spring-wobble effect.
// Odd keyframes are peaks, even keyframes are valleys; each pair is one oscillation.
const BOUNCE_FREQ_KEYFRAMES = [
  { t: 0.00, hz: 620 }, // initial attack — bright and punchy
  { t: 0.04, hz: 280 }, // drop
  { t: 0.08, hz: 540 }, // rise
  { t: 0.12, hz: 260 }, // drop
  { t: 0.16, hz: 450 }, // rise
  { t: 0.20, hz: 240 }, // drop
  { t: 0.24, hz: 360 }, // rise
  { t: 0.30, hz: 200 }, // final decay tail
];
const BOUNCE_DURATION = 0.32; // seconds
const BOUNCE_GAIN = 0.55;     // peak gain before velocity scaling

// --- Crate break layer parameters ---
// Layer 1: sub-bass thud (oscillator) — gives the hit physical weight.
const CRATE_THUD_FREQ_START  = 200;   // Hz — mid punch
const CRATE_THUD_FREQ_END    = 22;    // Hz — drops into sub-bass
const CRATE_THUD_DURATION    = 0.45;  // seconds
const CRATE_THUD_GAIN        = 1.4 * MASTER_VOLUME;

// Layer 2: low-frequency noise rumble — adds body to the impact.
const CRATE_RUMBLE_CUTOFF    = 180;   // Hz lowpass cutoff
const CRATE_RUMBLE_DURATION  = 0.5;   // seconds
const CRATE_RUMBLE_GAIN      = 1.2 * MASTER_VOLUME;

// Layer 3: mid-range bandpass noise — the actual wood-crack character.
const CRATE_CRACK_FREQ       = 500;   // Hz bandpass centre
const CRATE_CRACK_Q          = 0.6;   // wide-ish band for a natural crack timbre
const CRATE_CRACK_DURATION   = 0.4;   // seconds
const CRATE_CRACK_GAIN       = 1.1 * MASTER_VOLUME;

// Layer 4: high-frequency highpass noise snap — transient sharpness.
const CRATE_SNAP_FREQ        = 2000;  // Hz highpass cutoff
const CRATE_SNAP_DURATION    = 0.08;  // seconds — very short attack burst
const CRATE_SNAP_GAIN        = 0.9 * MASTER_VOLUME;

// --- Land thud parameters ---
// Simple sine sweep downward — a heavy footfall without being distracting.
const LAND_FREQ_START  = 90;   // Hz
const LAND_FREQ_END    = 40;   // Hz
const LAND_DURATION    = 0.16; // seconds
const LAND_GAIN        = 0.6 * MASTER_VOLUME;

export default class SoundManager {
  constructor(audioContext) {
    this.ctx = audioContext;
  }

  // Spring twang — zigzag pitch that oscillates high/low while decaying.
  playBounce(velocityMagnitude = 5) {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const vol = Math.min(velocityMagnitude / 12, 1) * BOUNCE_GAIN * MASTER_VOLUME;
    if (vol < BOUNCE_VOL_FLOOR) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    for (const kf of BOUNCE_FREQ_KEYFRAMES) {
      osc.frequency.exponentialRampToValueAtTime(kf.hz, t + kf.t);
    }

    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + BOUNCE_DURATION);

    osc.start(t);
    osc.stop(t + BOUNCE_DURATION);
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
    thud.frequency.setValueAtTime(CRATE_THUD_FREQ_START, t);
    thud.frequency.exponentialRampToValueAtTime(CRATE_THUD_FREQ_END, t + CRATE_THUD_DURATION - 0.1);
    thudGain.gain.setValueAtTime(CRATE_THUD_GAIN, t);
    thudGain.gain.exponentialRampToValueAtTime(0.001, t + CRATE_THUD_DURATION);
    thud.start(t);
    thud.stop(t + CRATE_THUD_DURATION);

    // Layer 2: low-frequency rumble noise for body/weight.
    const rumbleBuf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * CRATE_RUMBLE_DURATION), ctx.sampleRate);
    const rumbleData = rumbleBuf.getChannelData(0);
    for (let i = 0; i < rumbleData.length; i++) rumbleData[i] = Math.random() * 2 - 1;
    const rumble = ctx.createBufferSource();
    rumble.buffer = rumbleBuf;
    const rumbleBp = ctx.createBiquadFilter();
    rumbleBp.type = 'lowpass';
    rumbleBp.frequency.value = CRATE_RUMBLE_CUTOFF;
    const rumbleGain = ctx.createGain();
    rumbleGain.gain.setValueAtTime(CRATE_RUMBLE_GAIN, t);
    rumbleGain.gain.exponentialRampToValueAtTime(0.001, t + CRATE_RUMBLE_DURATION);
    rumble.connect(rumbleBp);
    rumbleBp.connect(rumbleGain);
    rumbleGain.connect(ctx.destination);
    rumble.start(t);
    rumble.stop(t + CRATE_RUMBLE_DURATION);

    // Layer 3: mid-range wood crack noise.
    const crackBuf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * CRATE_CRACK_DURATION), ctx.sampleRate);
    const crackData = crackBuf.getChannelData(0);
    for (let i = 0; i < crackData.length; i++) crackData[i] = Math.random() * 2 - 1;
    const crack = ctx.createBufferSource();
    crack.buffer = crackBuf;
    const crackBp = ctx.createBiquadFilter();
    crackBp.type = 'bandpass';
    crackBp.frequency.value = CRATE_CRACK_FREQ;
    crackBp.Q.value = CRATE_CRACK_Q;
    const crackGain = ctx.createGain();
    crackGain.gain.setValueAtTime(CRATE_CRACK_GAIN, t);
    crackGain.gain.exponentialRampToValueAtTime(0.001, t + CRATE_CRACK_DURATION);
    crack.connect(crackBp);
    crackBp.connect(crackGain);
    crackGain.connect(ctx.destination);
    crack.start(t);
    crack.stop(t + CRATE_CRACK_DURATION);

    // Layer 4: high-frequency snap transient for impact sharpness.
    const snapBuf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * CRATE_SNAP_DURATION), ctx.sampleRate);
    const snapData = snapBuf.getChannelData(0);
    for (let i = 0; i < snapData.length; i++) snapData[i] = Math.random() * 2 - 1;
    const snap = ctx.createBufferSource();
    snap.buffer = snapBuf;
    const snapHp = ctx.createBiquadFilter();
    snapHp.type = 'highpass';
    snapHp.frequency.value = CRATE_SNAP_FREQ;
    const snapGain = ctx.createGain();
    snapGain.gain.setValueAtTime(CRATE_SNAP_GAIN, t);
    snapGain.gain.exponentialRampToValueAtTime(0.001, t + CRATE_SNAP_DURATION);
    snap.connect(snapHp);
    snapHp.connect(snapGain);
    snapGain.connect(ctx.destination);
    snap.start(t);
    snap.stop(t + CRATE_SNAP_DURATION);
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
    osc.frequency.setValueAtTime(LAND_FREQ_START, t);
    osc.frequency.exponentialRampToValueAtTime(LAND_FREQ_END, t + LAND_DURATION - 0.02);

    gain.gain.setValueAtTime(LAND_GAIN, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + LAND_DURATION);

    osc.start(t);
    osc.stop(t + LAND_DURATION);
  }
}
