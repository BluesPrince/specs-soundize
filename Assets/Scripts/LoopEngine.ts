// LoopEngine.ts: a 5-track loop band synthesized inside the Lens.
// Tracks: Vox (live input, no synthesis), Keys, Pad, Bass, Drums, Perc. Every track runs on one
// sequencer clocked ONLY by the running sample count inside render() (16th-note grid, 90 BPM, 4/4),
// so all parts stay sample-locked. Keys, Pad and Bass follow the committed chord progression.
// Pure TypeScript, no Lens Studio APIs, no samples (everything is synthesized, license-clean).

import { rootPitchClass } from "./ChordParser";

export interface LoopPosition {
  playing: boolean;
  bar: number;      // 1-based bar within the progression
  barCount: number;
  beat: number;     // 1..4
  step: number;     // 0..7 eighth-note step in the bar (kept for TransportCard compatibility)
  current: string;
  next: string;
}

export type TrackId = "vox" | "keys" | "pad" | "bass" | "drums" | "perc";
export const TRACKS: TrackId[] = ["vox", "keys", "pad", "bass", "drums", "perc"];
export const TRACK_TITLES: { [t: string]: string } = {
  vox: "Vox (live)", keys: "Keys", pad: "Pad", bass: "Bass", drums: "Drums", perc: "Perc",
};
export const PATTERN_NAMES: { [t: string]: string[] } = {
  vox: ["Live"],
  keys: ["Whole", "Quarters", "Charleston", "Offbeats"],
  pad: ["Sustain", "Open", "Swell", "High"],
  bass: ["Groove", "Root-5th", "Octaves", "Halves"],
  drums: ["Boom bap", "House", "Half-time", "Funk"],
  perc: ["Shaker", "Congas", "Clave", "Tambourine"],
};

const STEPS = 16;
const FLAT = "♭";
const SHARP = "♯";

// ---------- sine table ----------
const TABLE = 4096;
const SINE = new Float32Array(TABLE + 1);
for (let i = 0; i <= TABLE; i++) SINE[i] = Math.sin((2 * Math.PI * i) / TABLE);
function sinC(phase: number): number { // phase in cycles, any value
  let p = phase - Math.floor(phase);
  const x = p * TABLE;
  const i = x | 0;
  return SINE[i] + (SINE[i + 1] - SINE[i]) * (x - i);
}
const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

// ---------- chords ----------
export function chordIntervals(symbol: string): number[] {
  let q = symbol.slice(1);
  if (q.charAt(0) === FLAT || q.charAt(0) === SHARP) q = q.slice(1);
  switch (q) {
    case "": return [0, 4, 7];
    case "m": return [0, 3, 7];
    case "7": return [0, 4, 7, 10];
    case "maj7": return [0, 4, 7, 11];
    case "m7": return [0, 3, 7, 10];
    case "m7" + FLAT + "5": return [0, 3, 6, 10];
    case "dim": return [0, 3, 6];
    case "dim7": return [0, 3, 6, 9];
    case "sus": case "sus4": return [0, 5, 7];
    case "sus2": return [0, 2, 7];
    default: return [0, 4, 7];
  }
}
export function keysVoicing(symbol: string): number[] {
  let root = 60 + rootPitchClass(symbol);
  if (root > 65) root -= 12; // keep the chord centered around middle C (root F#3..F4)
  return chordIntervals(symbol).map((i) => root + i);
}
export function padVoicing(symbol: string, variant: number): number[] {
  const iv = chordIntervals(symbol);
  let root = 48 + rootPitchClass(symbol);
  if (root > 53) root -= 12;
  if (variant === 1) { // open: root, fifth, tenth, and seventh or octave on top
    return [root + 12, root + 12 + iv[2], root + 24 + iv[1], root + (iv.length > 3 ? 24 + iv[3] : 36)];
  }
  const notes = iv.map((i) => root + 12 + i);
  return variant === 3 ? notes.map((n) => n + 12) : notes;
}

// ---------- patterns ----------
interface NoteHit { step: number; len: number; semis?: number }
const KEYS_PATTERNS: NoteHit[][] = [
  [{ step: 0, len: 15 }],
  [{ step: 0, len: 3 }, { step: 4, len: 3 }, { step: 8, len: 3 }, { step: 12, len: 3 }],
  [{ step: 0, len: 4 }, { step: 6, len: 8 }],
  [{ step: 2, len: 1 }, { step: 6, len: 1 }, { step: 10, len: 1 }, { step: 14, len: 1 }],
];
const PAD_PATTERNS: NoteHit[][] = [
  [{ step: 0, len: 16 }],
  [{ step: 0, len: 16 }],
  [{ step: 0, len: 7 }, { step: 8, len: 7 }],
  [{ step: 0, len: 16 }],
];
const BASS_PATTERNS: NoteHit[][] = [
  [{ step: 0, len: 5 }, { step: 6, len: 2 }, { step: 8, len: 3, semis: 12 }, { step: 12, len: 2 }, { step: 14, len: 1 }],
  [{ step: 0, len: 7 }, { step: 8, len: 7, semis: 7 }],
  [0, 2, 4, 6, 8, 10, 12, 14].map((s, k) => ({ step: s, len: 1, semis: k % 2 ? 12 : 0 })),
  [{ step: 0, len: 7 }, { step: 8, len: 7 }],
];
// x = hit, g = ghost (soft)
type Grid = { [inst: string]: string };
const DRUM_PATTERNS: Grid[] = [
  { kick: "x......x..x.....", snare: "....x.......x...", chh: "x.x.x.x.x.x.x.x." },
  { kick: "x...x...x...x...", clap: "....x.......x...", chh: "..x...x...x...x." },
  { kick: "x.........x.....", snare: "........x.......", chh: "xgxgxgxgxgxgxgxg" },
  { kick: "x..x....x.x.....", snare: "....x..g.g..x..g", chh: "x.x.x.x.x.x.x...", ohh: "..............x." },
];
const PERC_PATTERNS: Grid[] = [
  { shaker: "xgxgxgxgxgxgxgxg" },
  { congaL: "x.....x...x.....", congaH: "...x.x.....x.x.x" },
  { clave: "x..x..x...x.x...", shaker: "g.g.g.g.g.g.g.g." },
  { tamb: "..x...x...x...x.", rim: "....x.......x..." },
];
function vel(c: string): number { return c === "x" ? 1 : c === "g" ? 0.4 : 0; }

// ---------- percussion voice ----------
interface PercParams { f0: number; f1: number; pitchTau: number; toneTau: number; noiseTau: number; tone: number; noise: number; hpHz: number; lpHz: number; gain: number; bursts?: number }
class PercVoice {
  private toneEnv = 0; private noiseEnv = 0; private pitchEnv = 0; private phase = 0;
  private lpA = 0; private hpA = 0; private lpS = 0; private hpS = 0;
  private dTone: number; private dNoise: number; private dPitch: number;
  private burstLeft = 0; private burstCount = 0; private burstGap: number; private burstVel = 0;
  constructor(private sr: number, private p: PercParams) {
    this.dTone = p.toneTau > 0 ? Math.exp(-1 / (p.toneTau * sr)) : 0;
    this.dNoise = p.noiseTau > 0 ? Math.exp(-1 / (p.noiseTau * sr)) : 0;
    this.dPitch = p.pitchTau > 0 ? Math.exp(-1 / (p.pitchTau * sr)) : 0;
    this.lpA = p.lpHz >= sr * 0.45 ? 1 : 1 - Math.exp((-2 * Math.PI * p.lpHz) / sr);
    this.hpA = p.hpHz <= 0 ? 0 : 1 - Math.exp((-2 * Math.PI * p.hpHz) / sr);
    this.burstGap = Math.round(0.011 * sr);
  }
  trigger(v: number): void {
    this.toneEnv = v; this.noiseEnv = v; this.pitchEnv = 1;
    if (this.p.bursts) { this.burstCount = this.p.bursts; this.burstLeft = this.burstGap; this.burstVel = v; }
  }
  choke(): void { this.noiseEnv = 0; this.toneEnv = 0; }
  tick(white: number): number {
    if (this.burstCount > 0 && --this.burstLeft <= 0) { this.noiseEnv = this.burstVel; this.burstCount--; this.burstLeft = this.burstGap; }
    if (this.toneEnv < 1e-4 && this.noiseEnv < 1e-4) return 0;
    let out = 0;
    if (this.p.tone > 0 && this.toneEnv > 1e-4) {
      const f = this.p.f1 + (this.p.f0 - this.p.f1) * this.pitchEnv;
      this.pitchEnv *= this.dPitch;
      this.phase += f / this.sr;
      if (this.phase >= 1) this.phase -= 1;
      out += sinC(this.phase) * this.toneEnv * this.p.tone;
      this.toneEnv *= this.dTone;
    }
    if (this.p.noise > 0 && this.noiseEnv > 1e-4) {
      this.lpS += (white - this.lpS) * this.lpA;   // low-pass
      this.hpS += (this.lpS - this.hpS) * this.hpA; // tracks the lows
      out += (this.lpS - this.hpS) * this.noiseEnv * this.p.noise; // band = LP minus its low end
      this.noiseEnv *= this.dNoise;
    }
    return out * this.p.gain;
  }
}

// ---------- tonal voices ----------
class KeyVoice {
  phase = 0; inc = 0; env = 0; att = 0; gateLeft = 0; t = 0;
}
class PadVoice {
  pa = 0; pb = 0; ia = 0; ib = 0; env = 0; target = 0;
}

export class LoopEngine {
  readonly sampleRate: number;
  readonly bpm: number;
  readonly samplesPerStep: number; // one 16th note

  private bars: string[] = [];
  private playing = false;
  private sampleCount = 0;

  private pattern: { [t: string]: number } = { vox: 0, keys: 2, pad: 0, bass: 0, drums: 0, perc: 0 };
  private pending: { [t: string]: number } = {};
  private muted: { [t: string]: boolean } = { vox: false, keys: false, pad: false, bass: false, drums: false, perc: false };
  private gain: { [t: string]: number } = { vox: 0, keys: 1, pad: 1, bass: 1, drums: 1, perc: 1 };
  private readonly gainCoef: number;

  // noise
  private seed = 0x1234567;

  // drums + perc
  private perc: { [name: string]: PercVoice } = {};

  // keys
  private keys: KeyVoice[] = [new KeyVoice(), new KeyVoice(), new KeyVoice(), new KeyVoice()];
  private readonly keyDecay: number; private readonly keyRel: number; private readonly keyModDecay: number;

  // pad
  private pad: PadVoice[] = [];
  private padChord = ""; private padVariant = -1;
  private padLp = 0; private readonly padLpA: number;
  private readonly padAtk: number; private readonly padAtkSlow: number; private readonly padRel: number;
  private padGateLeft = 0;

  // bass (same voice as BassEngine: sine -> tanh drive -> 2-pole low-pass, glide + LFO on cutoff)
  private bPhase = 0; private bFreq = 0; private bEnv = 0; private bGate = 0;
  private readonly bAtk: number; private readonly bRel: number;
  private readonly drive = 3.0; private readonly driveNorm: number;
  private s1 = 0; private s2 = 0; private G = 0.5;
  private cutoffNorm = 0.5; private cutoffGlided = 0.5; private readonly glideCoef: number;
  private lfoRateNorm = 0.3; private lfoPhase = 0; private readonly lfoDepthOct = 0.8;

  // ducking + test tone
  private ducked = false; private duckGain = 1; private readonly duckCoef: number;
  private toneLeft = 0; private tonePhase = 0;

  constructor(sampleRate = 44100, bpm = 90) {
    this.sampleRate = sampleRate;
    this.bpm = bpm;
    this.samplesPerStep = Math.round((sampleRate * 60) / bpm / 4);
    const sr = sampleRate;
    const k = (tau: number) => Math.exp(-1 / (tau * sr));
    const a = (tau: number) => 1 - Math.exp(-1 / (tau * sr));
    this.gainCoef = a(0.02);
    this.duckCoef = a(0.06);
    this.keyDecay = k(1.1); this.keyRel = k(0.07); this.keyModDecay = k(0.22);
    this.padAtk = a(0.12); this.padAtkSlow = a(0.35); this.padRel = a(0.45);
    this.padLpA = 1 - Math.exp((-2 * Math.PI * 1800) / sr);
    this.bAtk = a(0.004); this.bRel = a(0.06);
    this.driveNorm = Math.tanh(this.drive);
    this.glideCoef = 1 - Math.exp(-32 / (0.04 * sr));
    for (let i = 0; i < 8; i++) this.pad.push(new PadVoice());

    const P = (o: Partial<PercParams>): PercParams => ({ f0: 0, f1: 0, pitchTau: 0, toneTau: 0, noiseTau: 0, tone: 0, noise: 0, hpHz: 0, lpHz: sr, gain: 1, ...o });
    this.perc = {
      kick: new PercVoice(sr, P({ f0: 160, f1: 45, pitchTau: 0.03, toneTau: 0.3, noiseTau: 0.004, tone: 1, noise: 0.5, hpHz: 1500, lpHz: 8000, gain: 0.85 })),
      snare: new PercVoice(sr, P({ f0: 210, f1: 180, pitchTau: 0.02, toneTau: 0.06, noiseTau: 0.13, tone: 0.45, noise: 1.6, hpHz: 900, lpHz: 7000, gain: 0.5 })),
      clap: new PercVoice(sr, P({ noiseTau: 0.09, noise: 2.2, hpHz: 700, lpHz: 3200, gain: 0.45, bursts: 2 })),
      chh: new PercVoice(sr, P({ noiseTau: 0.03, noise: 1.4, hpHz: 7000, lpHz: sr, gain: 0.2 })),
      ohh: new PercVoice(sr, P({ noiseTau: 0.25, noise: 1.2, hpHz: 6500, lpHz: sr, gain: 0.16 })),
      shaker: new PercVoice(sr, P({ noiseTau: 0.035, noise: 1.3, hpHz: 5000, lpHz: sr, gain: 0.16 })),
      congaL: new PercVoice(sr, P({ f0: 215, f1: 190, pitchTau: 0.05, toneTau: 0.17, tone: 1, gain: 0.32 })),
      congaH: new PercVoice(sr, P({ f0: 330, f1: 300, pitchTau: 0.04, toneTau: 0.13, tone: 1, gain: 0.28 })),
      clave: new PercVoice(sr, P({ f0: 2500, f1: 2500, toneTau: 0.025, tone: 1, gain: 0.2 })),
      tamb: new PercVoice(sr, P({ noiseTau: 0.08, noise: 1.4, hpHz: 7500, lpHz: sr, gain: 0.16 })),
      rim: new PercVoice(sr, P({ f0: 1700, f1: 1700, toneTau: 0.012, noiseTau: 0.01, tone: 0.6, noise: 0.8, hpHz: 2000, lpHz: 8000, gain: 0.25 })),
    };
    this.updateFilter();
  }

  // ----- progression + transport (same API as BassEngine) -----
  setProgression(bars: string[]): void { this.bars = bars.slice(); this.padChord = ""; }
  getProgression(): string[] { return this.bars.slice(); }
  play(): void { if (this.bars.length === 0) return; this.playing = true; this.sampleCount = 0; this.padChord = ""; this.applyPending(); }
  stop(): void {
    this.playing = false; this.bGate = 0; this.padGateLeft = 0;
    for (const v of this.keys) v.gateLeft = 0;
    for (const v of this.pad) v.target = 0;
  }
  isPlaying(): boolean { return this.playing; }

  // ----- tracks -----
  getPattern(track: TrackId): number { return this.pending[track] !== undefined ? this.pending[track] : this.pattern[track]; }
  setPattern(track: TrackId, index: number): void {
    const n = PATTERN_NAMES[track].length;
    const i = ((index % n) + n) % n;
    if (this.playing) this.pending[track] = i; else this.pattern[track] = i; // switch on the next bar while playing
  }
  cyclePattern(track: TrackId): number { this.setPattern(track, this.getPattern(track) + 1); return this.getPattern(track); }
  isMuted(track: TrackId): boolean { return this.muted[track]; }
  setMuted(track: TrackId, m: boolean): void { this.muted[track] = m; }
  toggleMute(track: TrackId): boolean { this.muted[track] = !this.muted[track]; return this.muted[track]; }
  trackLabel(track: TrackId): string {
    const names = PATTERN_NAMES[track];
    const i = this.getPattern(track);
    return names.length > 1 ? names[i] + " " + (i + 1) + "/" + names.length : names[i];
  }

  // ----- bass filter + misc (same API as BassEngine) -----
  setCutoff(norm: number): void { this.cutoffNorm = Math.max(0, Math.min(1, norm)); }
  getCutoff(): number { return this.cutoffNorm; }
  getGlidedCutoff(): number { return this.cutoffGlided; }
  setLfoRate(norm: number): void { this.lfoRateNorm = Math.max(0, Math.min(1, norm)); }
  setDucked(d: boolean): void { this.ducked = d; }
  testTone(seconds = 1): void { this.toneLeft = Math.round(seconds * this.sampleRate); }
  cutoffHz(): number { return 60 * Math.pow(2, this.cutoffNorm * 6); }
  lfoHz(): number { return 0.05 * Math.pow(2, this.lfoRateNorm * 7); }

  getPosition(): LoopPosition {
    const n = this.bars.length;
    if (!this.playing || n === 0) {
      return { playing: false, bar: n > 0 ? 1 : 0, barCount: n, beat: 1, step: 0,
        current: n > 0 ? this.bars[0] : "", next: n > 1 ? this.bars[1] : (n === 1 ? this.bars[0] : "") };
    }
    const total = Math.floor(this.sampleCount / this.samplesPerStep);
    const barIdx = Math.floor(total / STEPS) % n;
    const s16 = total % STEPS;
    return { playing: true, bar: barIdx + 1, barCount: n, beat: Math.floor(s16 / 4) + 1, step: Math.floor(s16 / 2),
      current: this.bars[barIdx], next: this.bars[(barIdx + 1) % n] };
  }

  // ----- internals -----
  private applyPending(): void {
    for (const t in this.pending) this.pattern[t] = this.pending[t];
    this.pending = {};
  }
  private white(): number {
    let x = this.seed;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    this.seed = x >>> 0;
    return (this.seed / 4294967296) * 2 - 1;
  }
  private updateFilter(): void {
    this.cutoffGlided += (this.cutoffNorm - this.cutoffGlided) * this.glideCoef;
    let fc = 60 * Math.pow(2, this.cutoffGlided * 6) * Math.pow(2, Math.sin(this.lfoPhase) * this.lfoDepthOct);
    const nyq = this.sampleRate * 0.45;
    if (fc > nyq) fc = nyq;
    const g = Math.tan((Math.PI * fc) / this.sampleRate);
    this.G = g / (1 + g);
  }

  private onStep(total: number): void {
    const n = this.bars.length;
    if (n === 0) return;
    const s16 = total % STEPS;
    const barIdx = Math.floor(total / STEPS) % n;
    if (s16 === 0) this.applyPending();
    const chord = this.bars[barIdx];

    // drums + perc
    const dg = DRUM_PATTERNS[this.pattern.drums];
    for (const inst in dg) {
      const v = vel(dg[inst].charAt(s16));
      if (v > 0) { if (inst === "chh") this.perc.ohh.choke(); this.perc[inst].trigger(v); }
    }
    const pg = PERC_PATTERNS[this.pattern.perc];
    for (const inst in pg) { const v = vel(pg[inst].charAt(s16)); if (v > 0) this.perc[inst].trigger(v); }

    // keys
    for (const h of KEYS_PATTERNS[this.pattern.keys]) {
      if (h.step !== s16) continue;
      const notes = keysVoicing(chord);
      for (let i = 0; i < this.keys.length; i++) {
        const kv = this.keys[i];
        if (i < notes.length) {
          kv.inc = midiHz(notes[i]) / this.sampleRate;
          kv.env = 1; kv.att = 0; kv.t = 1; kv.gateLeft = h.len * this.samplesPerStep;
        } else kv.gateLeft = 0;
      }
    }

    // pad: retrigger on a new chord, a new variant, or a pattern hit that restarts
    const pv = this.pattern.pad;
    for (const h of PAD_PATTERNS[pv]) {
      if (h.step !== s16) continue;
      const restart = pv === 2 || chord !== this.padChord || pv !== this.padVariant;
      if (restart) {
        for (const v of this.pad) v.target = 0; // release whatever is sounding
        const notes = padVoicing(chord, pv);
        const used: boolean[] = [false, false, false, false, false, false, false, false];
        for (const m of notes) {
          // take the quietest free slot so the old chord can ring out while the new one fades in
          let best = -1, bestEnv = 9;
          for (let j = 0; j < this.pad.length; j++) if (!used[j] && this.pad[j].env < bestEnv) { bestEnv = this.pad[j].env; best = j; }
          if (best < 0) break;
          used[best] = true;
          const v = this.pad[best];
          const f = midiHz(m);
          v.ia = (f * Math.pow(2, 6 / 1200)) / this.sampleRate;
          v.ib = (f * Math.pow(2, -6 / 1200)) / this.sampleRate;
          v.target = pv === 3 ? 0.6 : 1;
        }
        this.padChord = chord; this.padVariant = pv;
      }
      this.padGateLeft = h.len * this.samplesPerStep;
    }

    // bass
    for (const h of BASS_PATTERNS[this.pattern.bass]) {
      if (h.step !== s16) continue;
      const midi = 36 + rootPitchClass(chord) + (h.semis || 0);
      this.bFreq = midiHz(midi);
      this.bGate = Math.round(h.len * this.samplesPerStep);
    }
  }

  /** Fills out[0..n) with mono samples in -1..1 and advances the sequencer clock by n samples. */
  render(out: Float32Array, n: number): void {
    const sr = this.sampleRate;
    const lfoInc = (2 * Math.PI * this.lfoHz()) / sr;
    const tgt = (t: TrackId) => (this.muted[t] ? 0 : 1);
    const gK = tgt("keys"), gP = tgt("pad"), gB = tgt("bass"), gD = tgt("drums"), gC = tgt("perc");
    for (let i = 0; i < n; i++) {
      if (this.playing && this.sampleCount % this.samplesPerStep === 0) this.onStep(this.sampleCount / this.samplesPerStep);
      if ((i & 31) === 0) this.updateFilter();
      const w = this.white();

      // drums + perc buses
      const p = this.perc;
      const drums = p.kick.tick(w) + p.snare.tick(w) + p.clap.tick(w) + p.chh.tick(w) + p.ohh.tick(w);
      const percs = p.shaker.tick(w) + p.congaL.tick(w) + p.congaH.tick(w) + p.clave.tick(w) + p.tamb.tick(w) + p.rim.tick(w);

      // keys: FM electric piano (1:1 ratio, decaying index)
      let keys = 0;
      for (let k = 0; k < 4; k++) {
        const v = this.keys[k];
        if (v.env < 1e-4) continue;
        if (v.att < 1) v.att = Math.min(1, v.att + 1 / (0.003 * sr));
        const index = 0.25 + 1.6 * v.t;
        v.phase += v.inc; if (v.phase >= 1) v.phase -= 1;
        keys += sinC(v.phase + (index * sinC(v.phase)) / 6.2832) * v.env * v.att;
        v.t *= this.keyModDecay;
        if (v.gateLeft > 0) { v.gateLeft--; v.env *= this.keyDecay; } else v.env *= this.keyRel;
      }

      // pad: two detuned soft voices per note, then a gentle low-pass
      if (this.padGateLeft > 0) this.padGateLeft--; else if (this.pattern.pad === 2) for (const v of this.pad) v.target = 0;
      let pad = 0;
      for (let k = 0; k < 8; k++) {
        const v = this.pad[k];
        const coef = v.target > v.env ? (this.pattern.pad === 2 ? this.padAtkSlow : this.padAtk) : this.padRel;
        v.env += (v.target - v.env) * coef;
        if (v.env < 1e-4 && v.target === 0) continue;
        v.pa += v.ia; if (v.pa >= 1) v.pa -= 1;
        v.pb += v.ib; if (v.pb >= 1) v.pb -= 1;
        pad += (sinC(v.pa) + 0.22 * sinC(2 * v.pa) + sinC(v.pb) + 0.22 * sinC(2 * v.pb)) * v.env;
      }
      this.padLp += (pad - this.padLp) * this.padLpA;

      // bass
      const gateOpen = this.bGate > 0;
      if (gateOpen) this.bGate--;
      this.bEnv += ((gateOpen ? 1 : 0) - this.bEnv) * (gateOpen ? this.bAtk : this.bRel);
      let bx = 0;
      if (this.bEnv > 1e-5 && this.bFreq > 0) {
        this.bPhase += this.bFreq / sr; if (this.bPhase >= 1) this.bPhase -= 1;
        bx = Math.tanh(this.drive * sinC(this.bPhase) * this.bEnv) / this.driveNorm;
      }
      const v1 = (bx - this.s1) * this.G; const y1 = v1 + this.s1; this.s1 = y1 + v1;
      const v2 = (y1 - this.s2) * this.G; const y2 = v2 + this.s2; this.s2 = y2 + v2;

      // track gains (smoothed so mutes don't click)
      const gc = this.gainCoef, g = this.gain;
      g.keys += (gK - g.keys) * gc; g.pad += (gP - g.pad) * gc; g.bass += (gB - g.bass) * gc;
      g.drums += (gD - g.drums) * gc; g.perc += (gC - g.perc) * gc;
      this.duckGain += ((this.ducked ? 0.15 : 1) - this.duckGain) * this.duckCoef;

      let mix = (drums * g.drums + percs * g.perc + keys * 0.14 * g.keys + this.padLp * 0.05 * g.pad + y2 * 0.55 * g.bass) * this.duckGain;
      mix = Math.tanh(mix * 1.1) * 0.92; // gentle master limiter

      if (this.toneLeft > 0) {
        mix += Math.sin(this.tonePhase) * 0.3;
        this.tonePhase += (2 * Math.PI * 440) / sr; if (this.tonePhase > 2 * Math.PI) this.tonePhase -= 2 * Math.PI;
        this.toneLeft--;
      }
      out[i] = mix > 1 ? 1 : (mix < -1 ? -1 : mix);
      this.lfoPhase += lfoInc; if (this.lfoPhase > 2 * Math.PI) this.lfoPhase -= 2 * Math.PI;
      if (this.playing) this.sampleCount++;
    }
  }
}
