// SoundizeApp.ts: the launch menu, the Chords card and the wiring between UI Kit controls,
// ChordParser, BassSynth and TransportCard. All interaction goes through SIK / UI Kit
// (Button, Slider, TextInputField), so it works with the mouse in Interactive Preview and with LEAF.
// Everything runs inside the Lens. The only external module is AsrModule (Snap's on-device
// speech API); if it can't transcribe (e.g. in the preview), the typed field feeds onPhrase() instead.

import { BackPlate } from "SpectaclesUIKit.lspkg/Scripts/BackPlate";
import { Button } from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button";
import { Slider } from "SpectaclesUIKit.lspkg/Scripts/Components/Slider/Slider";
import { TextInputField } from "SpectaclesUIKit.lspkg/Scripts/Components/TextInputField/TextInputField";
import { parseProgression } from "./ChordParser";
import { BassSynth } from "./BassSynth";
import { TransportCard } from "./TransportCard";
import type { TrackId } from "./LoopEngine";

const MIX_TRACKS: TrackId[] = ["vox", "keys", "pad", "bass", "drums", "perc"];
const MIX_TITLES: { [t: string]: string } = { vox: "Vox", keys: "Keys", pad: "Pad", bass: "Bass", drums: "Drums", perc: "Perc" };

const WHITE = new vec4(1, 1, 1, 1);
const DIM = new vec4(1, 1, 1, 0.55);
const ACCENT = new vec4(0.45, 0.9, 0.55, 1);
const WARN = new vec4(1, 0.6, 0.45, 1);
const CONTENT_Z = 0.6; // keeps text in front of the BackPlate (z-fighting)
const LABEL_Z = 0.5;   // label lift above a button face
const CHIP_SIZE = 210; // chord chips: about 4.8 cm em, readable from where the player stands
const BLACK = new vec4(0, 0, 0, 1);

@component
export class SoundizeApp extends BaseScriptComponent {
  @ui.label("Specs Soundize: menu + Chords card + transport wiring")
  @ui.separator
  @input
  @hint("TransportCard script on the Transport Card object")
  transportCard: TransportCard;

  @input
  @hint("Root object of the Transport card (hidden until the first Confirm)")
  transportRoot: SceneObject;

  @input
  @hint("Empty first child of the Transport card; the BackPlate goes here so it draws behind the texts")
  transportPlate: SceneObject;

  @input
  @hint("Where the menu and Chords card sit, relative to this object (cm)")
  cardPosition: vec3 = new vec3(0, -6, -80);

  @input
  @hint("Use ASCII b # * . instead of the music glyphs, if the font lacks them")
  asciiGlyphs: boolean = false;

  @input
  @hint("Where the Mix card sits (cm): to the player's right, so they turn to mix")
  mixPosition: vec3 = new vec3(46, -16, -62);

  @input
  @hint("Mix card yaw in degrees, so it faces the player")
  mixYaw: number = -36.6;

  static instance: SoundizeApp = null;

  // public state, read by LEAF scenarios
  public bars: string[] = [];
  public committed: string[] = [];
  public lastError = "";
  public cutoff = 0.5;
  public listening = false;
  public pinchCount = 0;

  private menuRoot: SceneObject;
  private chordsRoot: SceneObject;
  private chipsText: Text;
  private statusText: Text;
  private listenLabel: Text;
  private input: TextInputField;
  private slider: Slider;
  private asr: AsrModule = null;
  private hideQueue: SceneObject[] = [];
  private plates: BackPlate[] = [];
  private mixRoot: SceneObject;
  private mixPatternLabels: { [t: string]: Text } = {};
  private mixMuteLabels: { [t: string]: Text } = {};

  onAwake(): void {
    SoundizeApp.instance = this;
    this.buildMenu();
    this.buildChordsCard();
    this.buildTransportControls();
    this.buildMixCard();
    // Hide the not-yet-needed cards only after every UI Kit component has run OnStart
    // (disabling before OnStart stops BackPlate/Button from initializing).
    this.hideQueue = [this.chordsRoot, this.transportRoot, this.mixRoot];
    const once = this.createEvent("UpdateEvent");
    once.bind(() => {
      this.paintPlatesBlack();
      for (const so of this.hideQueue) if (so) so.enabled = false;
      this.hideQueue = [];
      once.enabled = false;
    });
    print("[Soundize] ready: menu shown");
  }

  // ---------- public API (buttons, ASR, typed field and LEAF all call these) ----------

  pickWorkflow(name: string): void {
    this.pinchCount++;
    print("[Pinch] menu: " + name);
    if (name !== "Chords") {
      print("[Soundize] " + name + " is next, not live yet");
      return;
    }
    this.menuRoot.enabled = false;
    this.chordsRoot.enabled = true;
    print("[Soundize] Chords card shown");
  }

  onPhrase(text: string): void {
    print("[Phrase] \"" + text + "\"");
    const r = parseProgression(text);
    if (r.bars.length === 0) {
      this.bars = [];
      this.lastError = r.error || "Could not parse";
      this.chipsText.text = "";
      this.setStatus(this.lastError, WARN);
      print("[Parse] error: " + this.lastError);
      return;
    }
    this.bars = r.bars;
    this.lastError = r.error || "";
    const chips = this.display(r.bars.join("  "));
    this.chipsText.size = Math.min(CHIP_SIZE, Math.floor(CHIP_SIZE * 15 / Math.max(15, chips.length)));
    this.chipsText.text = chips;
    this.setStatus(this.lastError ? this.lastError : r.bars.length + " bars. Pinch Confirm to loop it.", this.lastError ? WARN : ACCENT);
    print("[Parse] " + r.bars.join(" "));
  }

  confirm(): void {
    this.pinchCount++;
    print("[Pinch] Confirm");
    if (this.bars.length === 0) {
      this.setStatus("Nothing to confirm yet. Say or type a progression.", WARN);
      return;
    }
    this.committed = this.bars.slice();
    const s = BassSynth.instance;
    if (s) s.setProgression(this.committed);
    this.transportRoot.enabled = true;
    this.mixRoot.enabled = true;
    this.refreshMix();
    this.setStatus("Committed " + this.committed.length + " bars. Press Play below.", ACCENT);
    print("[Soundize] committed: " + this.committed.join(" "));
  }

  testTone(): void {
    this.pinchCount++;
    print("[Pinch] Test tone");
    if (BassSynth.instance) BassSynth.instance.testTone(1);
    else print("[Soundize] BassSynth missing");
  }

  togglePlay(): void {
    this.pinchCount++;
    print("[Pinch] Play/Stop");
    this.transportCard.togglePlay();
  }

  private lastLoggedCutoff = -1;

  setCutoff(v: number): void {
    this.cutoff = v;
    this.transportCard.setCutoff(v);
    // Log only every 0.1 of travel (and the ends), so a drag doesn't flood the Logger
    if (Math.abs(v - this.lastLoggedCutoff) >= 0.1 || v <= 0 || v >= 1) {
      this.lastLoggedCutoff = v;
      print("[Slider] cutoff " + v.toFixed(2));
    }
  }

  // ---------- mix (5-track band) ----------

  trackLabel(t: TrackId): string {
    return BassSynth.instance ? BassSynth.instance.trackLabel(t) : "";
  }

  /** Next pattern for a track; while playing it switches on the next bar. */
  cycleTrack(t: TrackId): string {
    this.pinchCount++;
    print("[Pinch] mix pattern " + t);
    const s = BassSynth.instance;
    if (!s || t === "vox") return "";
    const label = s.cyclePattern(t);
    if (this.mixPatternLabels[t]) this.mixPatternLabels[t].text = label;
    print("[Mix] " + t + " -> " + label);
    return label;
  }

  toggleTrackMute(t: TrackId): boolean {
    this.pinchCount++;
    print("[Pinch] mix mute " + t);
    const s = BassSynth.instance;
    if (!s) return false;
    const m = s.toggleMute(t);
    const ml = this.mixMuteLabels[t];
    if (ml) { ml.text = m ? "Muted" : "On"; ml.textFill.color = m ? DIM : ACCENT; }
    const pl = this.mixPatternLabels[t];
    if (pl) pl.textFill.color = m ? DIM : WHITE;
    print("[Mix] " + t + (m ? " muted" : " on"));
    return m;
  }

  private refreshMix(): void {
    for (const t of MIX_TRACKS) {
      const pl = this.mixPatternLabels[t];
      if (pl) pl.text = this.trackLabel(t);
    }
  }

  toggleListen(): void {
    this.pinchCount++;
    print("[Pinch] Listen");
    if (this.listening) this.stopListening();
    else this.startListening();
  }

  display(s: string): string {
    if (!this.asciiGlyphs) return s;
    return s.replace(/♭/g, "b").replace(/♯/g, "#").replace(/●/g, "*").replace(/○/g, ".");
  }

  // ---------- speech ----------

  private startListening(): void {
    try {
      if (!this.asr) this.asr = require("LensStudio:AsrModule") as AsrModule;
      const opts = AsrModule.AsrTranscriptionOptions.create();
      opts.silenceUntilTerminationMs = 1200;
      opts.mode = AsrModule.AsrMode.HighAccuracy;
      opts.onTranscriptionUpdateEvent.add((e: AsrModule.TranscriptionUpdateEvent) => {
        if (!e.isFinal) { this.setStatus("Hearing: " + e.text, DIM); return; }
        this.stopListening();
        if (e.text && e.text.trim().length > 0) this.onPhrase(e.text);
      });
      opts.onTranscriptionErrorEvent.add((code: AsrModule.AsrStatusCode) => {
        print("[ASR] error code " + code);
        this.stopListening();
        this.setStatus("Voice not available here. Type the progression instead.", WARN);
      });
      this.asr.startTranscribing(opts);
      this.listening = true;
      if (BassSynth.instance) BassSynth.instance.setDucked(true);
      this.listenLabel.text = "Stop";
      this.setStatus("Listening... say a progression", ACCENT);
      print("[ASR] listening (bass ducked)");
    } catch (err) {
      print("[ASR] could not start: " + err);
      this.listening = false;
      this.setStatus("Voice not available here. Type the progression instead.", WARN);
    }
  }

  private stopListening(): void {
    if (this.listening && this.asr) {
      try { this.asr.stopTranscribing(); } catch (err) { print("[ASR] stop failed: " + err); }
    }
    this.listening = false;
    if (BassSynth.instance) BassSynth.instance.setDucked(false);
    this.listenLabel.text = "Listen";
    print("[ASR] stopped (bass unducked)");
  }

  // ---------- UI building ----------

  private buildMenu(): void {
    this.menuRoot = this.card("Menu Card", this.cardPosition, 40, 27);
    const c = this.content(this.menuRoot);
    this.text(c, "Title", "Start with:", 80, new vec3(0, 10, 0), WHITE);
    const items = ["Chords", "Bass line", "Beat", "Sample"];
    for (let i = 0; i < items.length; i++) {
      const name = items[i];
      const live = name === "Chords";
      const label = live ? "Chords" : name + "  (next)";
      this.button(c, name + " Button", label, 34, 4.4, new vec3(0, 4.5 - i * 5, 0),
        () => this.pickWorkflow(name), live ? WHITE : DIM, 70);
    }
  }

  private buildChordsCard(): void {
    this.chordsRoot = this.card("Chords Card", this.cardPosition, 40, 27);
    const c = this.content(this.chordsRoot);
    this.text(c, "Title", "Chords", 72, new vec3(-12, 10.5, 0), WHITE);
    this.text(c, "Stand-in Label", "Preview: typed. On Specs: voice.", 38, new vec3(6, 10.5, 0), DIM);

    const fieldSO = this.obj(c, "Typed Phrase Field", new vec3(0, 6, 0));
    this.input = fieldSO.createComponent(TextInputField.getTypeName()) as TextInputField;
    this.input.size = new vec3(36, 4, 1);
    this.input.onReturnKeyPressed.add((t: string) => this.onPhrase(t));
    this.input.onTextChanged.add((t: string) => { if (t && t.trim().length > 0) this.onPhrase(t); });

    this.chipsText = this.text(c, "Chord Chips", "", CHIP_SIZE, new vec3(0, -0.3, 0), WHITE);
    this.statusText = this.text(c, "Status", "Say or type: two bars of C minor, one bar of A flat", 38, new vec3(0, -5.6, 0), DIM);

    const y = -10;
    const listen = this.button(c, "Listen Button", "Listen", 11.5, 4.8, new vec3(-13, y, 0), () => this.toggleListen(), WHITE, 62);
    this.listenLabel = listen.label;
    this.button(c, "Test Tone Button", "Test tone", 11.5, 4.8, new vec3(0, y, 0), () => this.testTone(), WHITE, 62);
    this.button(c, "Confirm Button", "Confirm", 11.5, 4.8, new vec3(13, y, 0), () => this.confirm(), ACCENT, 62);
  }

  private buildTransportControls(): void {
    // Card surface on the pre-made first child so it draws behind the editor-made Text objects.
    this.transportRoot.createComponent("Component.Canvas");
    const plate = this.transportPlate.createComponent(BackPlate.getTypeName()) as BackPlate;
    plate.style = "simple";
    plate.size = new vec2(40, 20);
    this.plates.push(plate);

    const controls = this.obj(this.transportRoot, "Controls", new vec3(0, 0, CONTENT_Z));
    const play = this.button(controls, "Play Stop Button", "Play", 12, 5, new vec3(-12.5, -5.8, 0), () => this.togglePlay(), ACCENT, 66);
    // TransportCard sits lower in the hierarchy, so hand it the label once it has awoken.
    this.createEvent("OnStartEvent").bind(() => { this.transportCard.playLabel = play.label; });

    this.text(controls, "Cutoff Label", "Filter cutoff", 36, new vec3(6.5, -3.2, 0), DIM);
    const sSO = this.obj(controls, "Cutoff Slider", new vec3(6.5, -6.6, 0));
    this.slider = sSO.createComponent(Slider.getTypeName()) as Slider;
    this.slider.size = new vec3(25, 3, 1); // before init, or the fill/knob draw wrong until dragged
    this.slider.currentValue = 0.5;
    this.slider.onValueChange.add((v: number) => this.setCutoff(v));
  }

  private buildMixCard(): void {
    this.mixRoot = this.card("Mix Card", this.mixPosition, 40, 36);
    this.mixRoot.getTransform().setLocalRotation(quat.angleAxis((this.mixYaw * Math.PI) / 180, vec3.up()));
    const c = this.content(this.mixRoot);
    this.text(c, "Title", "Mix", 72, new vec3(-14, 14.5, 0), WHITE);
    this.text(c, "Hint", "Pinch a pattern: it changes on the next bar", 30, new vec3(5, 14.5, 0), DIM);
    for (let i = 0; i < MIX_TRACKS.length; i++) {
      const t = MIX_TRACKS[i];
      const name = MIX_TITLES[t];
      const y = 9.5 - i * 4.8;
      this.text(c, name + " Name", name, 44, new vec3(-15, y, 0), WHITE);
      if (t === "vox") {
        this.text(c, "Vox Live", "Live mic on Specs", 32, new vec3(2.5, y, 0), DIM);
      } else {
        const pb = this.button(c, name + " Pattern Button", this.trackLabel(t), 17, 4, new vec3(2.5, y, 0), () => this.cycleTrack(t), WHITE, 36);
        this.mixPatternLabels[t] = pb.label;
      }
      const mb = this.button(c, name + " Mute Button", "On", 7.5, 4, new vec3(15.5, y, 0), () => this.toggleTrackMute(t), ACCENT, 36);
      this.mixMuteLabels[t] = mb.label;
    }
  }

  // ---------- helpers ----------

  // Black is clear glass on Specs: paint every card surface black once UI Kit has initialized it.
  private paintPlatesBlack(): void {
    for (const p of this.plates) {
      const rr = (p as any).roundedRectangle;
      if (rr) rr.backgroundColor = BLACK;
    }
  }

  private setStatus(s: string, color: vec4): void {
    this.statusText.text = this.display(s);
    this.statusText.textFill.color = color;
  }

  private obj(parent: SceneObject, name: string, pos?: vec3): SceneObject {
    const so = global.scene.createSceneObject(name);
    so.setParent(parent);
    if (pos) so.getTransform().setLocalPosition(pos);
    return so;
  }

  private card(name: string, pos: vec3, w: number, h: number): SceneObject {
    const root = this.obj(this.sceneObject, name, pos);
    root.createComponent("Component.Canvas");
    const plateSO = this.obj(root, "Plate");
    const plate = plateSO.createComponent(BackPlate.getTypeName()) as BackPlate;
    plate.style = "simple";
    plate.size = new vec2(w, h);
    this.plates.push(plate);
    return root;
  }

  private content(card: SceneObject): SceneObject {
    return this.obj(card, "Content", new vec3(0, 0, CONTENT_Z));
  }

  private text(parent: SceneObject, name: string, s: string, size: number, pos: vec3, color: vec4): Text {
    const so = this.obj(parent, name, pos);
    const t = so.createComponent("Component.Text") as Text;
    t.text = this.display(s);
    t.size = size;
    t.depthTest = true;
    t.horizontalAlignment = HorizontalAlignment.Center;
    t.verticalAlignment = VerticalAlignment.Center;
    t.horizontalOverflow = HorizontalOverflow.Overflow;
    t.textFill.color = color;
    return t;
  }

  private button(parent: SceneObject, name: string, label: string, w: number, h: number, pos: vec3,
      onPress: () => void, color: vec4, labelSize: number): { button: Button; label: Text } {
    const so = this.obj(parent, name, pos);
    const b = so.createComponent(Button.getTypeName()) as Button;
    b.size = new vec3(w, h, 1);
    b.onTriggerUp.add(() => onPress());
    const t = this.text(so, "Label", label, labelSize, new vec3(0, 0, LABEL_Z), color);
    return { button: b, label: t };
  }
}
