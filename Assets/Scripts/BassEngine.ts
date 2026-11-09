// BassEngine.ts: the bass voice and sequencer, as pure DSP with no Lens Studio APIs.
// Voice: sine oscillator -> soft saturation (tanh drive) -> 2-pole low-pass, LFO on the cutoff.
// Sequencer: 90 BPM, 4/4, eighth-note grid, clocked ONLY by the running sample count
// inside render(), never by frame time. BassSynth.ts feeds render() from the
// AudioOutputProvider callback.

import { rootPitchClass } from "./ChordParser";

export interface BassPosition {
  playing: boolean;
  bar: number;      // 1-based bar within the progression
  barCount: number;
  beat: number;     // 1..4
  step: number;     // 0..7 eighth-note step in the bar
  current: string;  // chord in this bar
  next: string;     // chord in the next bar
}

interface Hit { step: number; octave: number; length: number } // length in eighth-note steps

// One bar of groove on the eighth-note grid: 1, &2, 3 (octave up), 4, &4
const GROOVE: Hit[] = [
  { step: 0, octave: 0, length: 2.5 },
  { step: 3, octave: 0, length: 0.8 },
  { step: 4, octave: 1, length: 1.5 },
  { step: 6, octave: 0, length: 0.8 },
  { step: 7, octave: 0, length: 0.6 },
];

const TWO_PI = Math.PI * 2;
const STEPS_PER_BAR = 8;
const CONTROL_BLOCK = 32; // recompute filter coefficients every 32 samples

export class BassEngine {
  readonly sampleRate: number;
  readonly bpm: number;
  readonly samplesPerStep: number; // one eighth note

  private bars: string[] = [];
  private rootMidi: number[] = [];
  private playing = false;
  private sampleCount = 0;         // samples since play() - the sequencer clock

  // voice
  private phase = 0;
  private freq = 0;
  private env = 0;
  private gateLeft = 0;            // samples the gate stays open
  private readonly atk: number;
  private readonly rel: number;
  private drive = 3.0;
  private readonly driveNorm: number;

  // filter: two cascaded TPT one-poles (12 dB/oct)
  private s1 = 0;
  private s2 = 0;
  private G = 0.5;
  private cutoffNorm = 0.5;        // 0..1 from the slider (target)
  private cutoffGlided = 0.5;      // what the filter actually uses: glides toward the target
  private readonly glideCoef: number; // ~40 ms glide, applied every CONTROL_BLOCK samples
  private lfoRateNorm = 0.3;       // 0..1 from the optional second slider
  private lfoPhase = 0;
  private readonly lfoDepthOct = 0.8;

  // ducking while ASR listens
  private ducked = false;
  private duckGain = 1;
  private readonly duckCoef: number;

  // test tone
  private toneLeft = 0;
  private tonePhase = 0;

  constructor(sampleRate = 44100, bpm = 90) {
    this.sampleRate = sampleRate;
    this.bpm = bpm;
    this.samplesPerStep = Math.round((sampleRate * 60) / bpm / 2);
    this.atk = 1 - Math.exp(-1 / (0.004 * sampleRate));
    this.rel = 1 - Math.exp(-1 / (0.06 * sampleRate));
    this.duckCoef = 1 - Math.exp(-1 / (0.06 * sampleRate));
    this.glideCoef = 1 - Math.exp(-CONTROL_BLOCK / (0.04 * sampleRate));
    this.driveNorm = Math.tanh(this.drive);
    this.updateFilter();
  }

  setProgression(bars: string[]): void {
    this.bars = bars.slice();
    this.rootMidi = bars.map((c) => 36 + rootPitchClass(c)); // C2..B2, octave 2-3 with the groove's octave hit
  }

  getProgression(): string[] { return this.bars.slice(); }

  play(): void {
    if (this.bars.length === 0) return;
    this.playing = true;
    this.sampleCount = 0;
  }

  stop(): void {
    this.playing = false;
    this.gateLeft = 0; // let the release tail finish
  }

  isPlaying(): boolean { return this.playing; }

  setCutoff(norm: number): void { this.cutoffNorm = Math.max(0, Math.min(1, norm)); }
  getCutoff(): number { return this.cutoffNorm; }
  setLfoRate(norm: number): void { this.lfoRateNorm = Math.max(0, Math.min(1, norm)); }
  setDucked(ducked: boolean): void { this.ducked = ducked; }

  /** Plays a 440 Hz tone for the given seconds, on top of whatever else is playing. */
  testTone(seconds = 1): void { this.toneLeft = Math.round(seconds * this.sampleRate); }

  cutoffHz(): number { return 60 * Math.pow(2, this.cutoffNorm * 6); } // 60 Hz .. 3.84 kHz (target)
  /** The cutoff the filter is using right now, after the glide (0..1). */
  getGlidedCutoff(): number { return this.cutoffGlided; }
  lfoHz(): number { return 0.05 * Math.pow(2, this.lfoRateNorm * 7); } // 0.05 .. 6.4 Hz

  getPosition(): BassPosition {
    const n = this.bars.length;
    if (!this.playing || n === 0) {
      return { playing: false, bar: n > 0 ? 1 : 0, barCount: n, beat: 1, step: 0,
        current: n > 0 ? this.bars[0] : "", next: n > 1 ? this.bars[1] : (n === 1 ? this.bars[0] : "") };
    }
    const totalSteps = Math.floor(this.sampleCount / this.samplesPerStep);
    const barIdx = Math.floor(totalSteps / STEPS_PER_BAR) % n;
    const step = totalSteps % STEPS_PER_BAR;
    return { playing: true, bar: barIdx + 1, barCount: n, beat: Math.floor(step / 2) + 1, step,
      current: this.bars[barIdx], next: this.bars[(barIdx + 1) % n] };
  }

  private updateFilter(): void {
    // Glide in the log-frequency domain, so a slider jump becomes a smooth exponential sweep
    this.cutoffGlided += (this.cutoffNorm - this.cutoffGlided) * this.glideCoef;
    const lfo = Math.sin(this.lfoPhase) * this.lfoDepthOct;
    let fc = 60 * Math.pow(2, this.cutoffGlided * 6) * Math.pow(2, lfo);
    const nyq = this.sampleRate * 0.45;
    if (fc > nyq) fc = nyq;
    const g = Math.tan((Math.PI * fc) / this.sampleRate);
    this.G = g / (1 + g);
  }

  private onStep(totalSteps: number): void {
    const n = this.rootMidi.length;
    if (n === 0) return;
    const barIdx = Math.floor(totalSteps / STEPS_PER_BAR) % n;
    const step = totalSteps % STEPS_PER_BAR;
    for (let k = 0; k < GROOVE.length; k++) {
      const h = GROOVE[k];
      if (h.step === step) {
        const midi = this.rootMidi[barIdx] + 12 * h.octave;
        this.freq = 440 * Math.pow(2, (midi - 69) / 12);
        this.gateLeft = Math.round(h.length * this.samplesPerStep);
        return;
      }
    }
  }

  /** Fills out[0..n) with mono samples in -1..1 and advances the sequencer clock by n samples. */
  render(out: Float32Array, n: number): void {
    const sr = this.sampleRate;
    const lfoInc = (TWO_PI * this.lfoHz()) / sr;
    for (let i = 0; i < n; i++) {
      if (this.playing && this.sampleCount % this.samplesPerStep === 0) {
        this.onStep(this.sampleCount / this.samplesPerStep);
      }
      if ((i & (CONTROL_BLOCK - 1)) === 0) this.updateFilter();

      // envelope
      const gateOpen = this.gateLeft > 0;
      if (gateOpen) this.gateLeft--;
      this.env += ((gateOpen ? 1 : 0) - this.env) * (gateOpen ? this.atk : this.rel);

      // oscillator -> saturation
      let x = 0;
      if (this.env > 1e-5 && this.freq > 0) {
        x = Math.sin(this.phase) * this.env;
        x = Math.tanh(this.drive * x) / this.driveNorm;
        this.phase += (TWO_PI * this.freq) / sr;
        if (this.phase > TWO_PI) this.phase -= TWO_PI;
      }

      // 2-pole low-pass
      const v1 = (x - this.s1) * this.G; const y1 = v1 + this.s1; this.s1 = y1 + v1;
      const v2 = (y1 - this.s2) * this.G; const y2 = v2 + this.s2; this.s2 = y2 + v2;

      // ducking
      this.duckGain += ((this.ducked ? 0.15 : 1) - this.duckGain) * this.duckCoef;
      let y = y2 * 0.6 * this.duckGain;

      // test tone
      if (this.toneLeft > 0) {
        y += Math.sin(this.tonePhase) * 0.3;
        this.tonePhase += (TWO_PI * 440) / sr;
        if (this.tonePhase > TWO_PI) this.tonePhase -= TWO_PI;
        this.toneLeft--;
      }

      out[i] = y > 1 ? 1 : (y < -1 ? -1 : y);
      this.lfoPhase += lfoInc;
      if (this.lfoPhase > TWO_PI) this.lfoPhase -= TWO_PI;
      if (this.playing) this.sampleCount++;
    }
  }
}
