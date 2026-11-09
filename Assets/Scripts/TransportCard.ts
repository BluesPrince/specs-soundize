// TransportCard.ts: shows "bar 2 of 4", beat dots, and the current and next chord,
// read every frame from BassSynth's sample-clocked position. Wire a big button's pinch
// to togglePlay() and the cutoff slider's value change to setCutoff(value).

import { BassSynth } from "./BassSynth";

@component
export class TransportCard extends BaseScriptComponent {
  @input
  @allowUndefined
  bassSynth: BassSynth;

  @input
  @hint("Text: 'bar 2 of 4'")
  barText: Text;

  @input
  @hint("Text: beat dots, e.g. '● ○ ○ ○'")
  beatText: Text;

  @input
  @hint("Text: current chord, large")
  currentText: Text;

  @input
  @hint("Text: next chord, smaller")
  nextText: Text;

  @input
  @allowUndefined
  @hint("Text on the play/stop button")
  playLabel: Text;

  private lastKey = "";

  onAwake(): void {
    this.createEvent("UpdateEvent").bind(() => this.refresh());
  }

  private synth(): BassSynth {
    return this.bassSynth ? this.bassSynth : BassSynth.instance;
  }

  togglePlay(): void {
    const s = this.synth();
    if (!s) return;
    const playing = s.togglePlay();
    print("[Transport] " + (playing ? "play" : "stop"));
  }

  setCutoff(value: number): void {
    const s = this.synth();
    if (s) s.setCutoff(value);
  }

  setLfoRate(value: number): void {
    const s = this.synth();
    if (s) s.setLfoRate(value);
  }

  private refresh(): void {
    const s = this.synth();
    if (!s) return;
    const p = s.getPosition();
    const key = p.playing + "|" + p.bar + "|" + p.beat + "|" + p.current + "|" + p.next + "|" + p.barCount;
    if (key === this.lastKey) return;
    this.lastKey = key;
    if (p.barCount === 0) {
      this.barText.text = "no chords yet";
      this.beatText.text = "○ ○ ○ ○";
      this.currentText.text = "";
      this.nextText.text = "";
    } else {
      this.barText.text = "bar " + p.bar + " of " + p.barCount;
      let dots = "";
      for (let b = 1; b <= 4; b++) dots += (b === p.beat && p.playing ? "●" : "○") + (b < 4 ? " " : "");
      this.beatText.text = dots;
      this.currentText.text = p.current;
      this.nextText.text = "next: " + p.next;
    }
    if (this.playLabel) this.playLabel.text = p.playing ? "Stop" : "Play";
  }
}
