// BassSynth.ts: plays the 5-track LoopEngine through an Audio Output asset.
// (Kept the BassSynth name so existing wiring keeps working; it now drives the whole band.)
// Each UpdateEvent: render getPreferredFrameSize() samples, then enqueueAudioFrame(data, shape),
// as in Snap's sine example. The sequencer clock lives inside LoopEngine.render() and counts
// samples, so tempo follows the audio, not the frame rate.

import { LoopEngine, LoopPosition, TrackId, TRACKS, TRACK_TITLES } from "./LoopEngine";

@component
export class BassSynth extends BaseScriptComponent {
  @input
  @hint("Audio Output asset (Asset Browser + > Audio Output)")
  audioOutput: AudioTrackAsset;

  @input
  @allowUndefined
  @hint("Audio component that plays the Audio Output asset. If set, it is started looping.")
  audioComponent: AudioComponent;

  @input
  sampleRate: number = 44100;

  static instance: BassSynth = null;

  public engine: LoopEngine;
  private provider: AudioOutputProvider;
  private buffer: Float32Array;
  private shape: vec3 = new vec3(0, 1, 1);

  onAwake(): void {
    BassSynth.instance = this;
    this.engine = new LoopEngine(this.sampleRate, 90);
    this.provider = this.audioOutput.control as AudioOutputProvider;
    this.provider.sampleRate = this.sampleRate;
    this.buffer = new Float32Array(this.sampleRate); // one second of headroom per frame
    if (this.audioComponent) {
      this.audioComponent.audioTrack = this.audioOutput;
      this.audioComponent.play(-1);
    }
    this.createEvent("UpdateEvent").bind(() => this.pump());
  }

  private pump(): void {
    let n = this.provider.getPreferredFrameSize();
    if (n <= 0) return;
    if (n > this.buffer.length) n = this.buffer.length;
    this.engine.render(this.buffer, n);
    this.shape.x = n;
    this.provider.enqueueAudioFrame(this.buffer, this.shape);
  }

  // Transport + filter API (unchanged)
  setProgression(bars: string[]): void { this.engine.setProgression(bars); }
  togglePlay(): boolean {
    if (this.engine.isPlaying()) this.engine.stop(); else this.engine.play();
    return this.engine.isPlaying();
  }
  play(): void { this.engine.play(); }
  stop(): void { this.engine.stop(); }
  setCutoff(norm: number): void { this.engine.setCutoff(norm); }
  setLfoRate(norm: number): void { this.engine.setLfoRate(norm); }
  setDucked(ducked: boolean): void { this.engine.setDucked(ducked); }
  testTone(seconds: number = 1): void { this.engine.testTone(seconds); }
  getPosition(): LoopPosition { return this.engine.getPosition(); }

  // Track API for the Mix card
  tracks(): TrackId[] { return TRACKS; }
  trackTitle(track: TrackId): string { return TRACK_TITLES[track]; }
  /** Next pattern for a track (switches on the next bar while playing). Returns the new label. */
  cyclePattern(track: TrackId): string { this.engine.cyclePattern(track); return this.engine.trackLabel(track); }
  toggleMute(track: TrackId): boolean { return this.engine.toggleMute(track); }
  isMuted(track: TrackId): boolean { return this.engine.isMuted(track); }
  trackLabel(track: TrackId): string { return this.engine.trackLabel(track); }
}
