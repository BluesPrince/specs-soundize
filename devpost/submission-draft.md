# Specs Soundize: Devpost submission draft

Paste each section into the matching Devpost field. Edit the voice to taste; the facts are checked against the build.

---

## Elevator pitch (Devpost tagline, under 200 characters)

Say your chords, hear your band. Specs Soundize turns one spoken progression into a five-piece band synthesized inside Snap Specs, mixed with a turn of your head. Your hands stay on your instrument.

---

## Inspiration

I'm a working saxophonist. When I practice or play a gig, my hands are on the horn. Changing a backing track means stopping, putting the horn down, looking at a phone or laptop and tapping through menus. Loop pedals need your feet, DAWs need a mouse, and backing-track apps need your eyes. I wanted a band that I could set up by talking to it, and mix by looking at it, without ever taking my hands off the instrument.

## What it does

1. **Start with: Chords.** A small launch menu shows only the next step. (Bass line, Beat and Sample are marked "next".)
2. **Say a progression.** "Two bars of C minor, one bar of A flat, one bar of B flat" becomes four big chord chips, one per bar: Cm, Cm, A♭, B♭. The parser understands bar counts in words or digits, sharps and flats, nine chord qualities, and speech homophones like "be flat" and "see". "Two five one in F" expands to Gm7, C7, Fmaj7. (In Lens Studio's preview, voice needs a Snap login, so a typed field labeled "Preview: typed. On Specs: voice." feeds the same parser.)
3. **Pinch Confirm, then Play.** A five-piece band starts looping your chords at 90 BPM: electric-piano keys, a pad, bass, drums and percussion. Keys, pad and bass follow your chord changes. A transport card shows "bar 2 of 4", the beat, and the current and next chord, so you always know what's coming.
4. **Turn your head to mix.** A Mix card sits to your right, angled toward you. Each track has one big pattern button (Keys: Whole, Quarters, Charleston, Offbeats; Drums: Boom bap, House, Half-time, Funk; and so on) and one big mute toggle. Pattern changes land on the next bar, so you can build the track up and strip it down in time, like a live arranger. A slider sweeps the bass filter.

Everything runs inside the Lens: no network, no accounts, no keys and no samples. Every sound is synthesized live.

## How we built it

- **Planning:** we ran Devpost's Learn skill pack (`plan-lens`) and wrote the design brief in `devpost/design-brief.md`. It includes the spatial moment, card placement, hands and input, a voice stand-in for the preview, and testable done criteria. A later addendum covers the five-track band.
- **Lens Studio 5.24.1, Specs Base Template**, with Spectacles Interaction Kit and UI Kit for every interaction, so everything works with the mouse in Interactive Preview and with LEAF.
- **CLAD and the Lens Studio MCP:** Claude Code with Snap's `ls-clad` plugin built the Lens through the Lens Studio MCP in a closed loop:
  - **Build:** scene objects and UI through `ExecuteEditorCode` and `scene-graphql`, packages through `InstallLensStudioPackage`.
  - **Compile:** `RecompileTypeScriptTool`.
  - **Run:** the preview and its logs through `RunAndCollectLogsTool`.
  - **Look:** screenshots through `CapturePanelScreenshotTool`.
  - **Test:** LEAF scenarios.

  CLAD's skills (`specs-build-ui`, `specs-asr`, `editor-api`, `lens-api`) were the reference for UI Kit, AsrModule and Editor API patterns.
- **Real-time audio:** one Audio Output asset fed by `AudioOutputProvider.enqueueAudioFrame`, following Snap's sine example. The `LoopEngine` synthesizes all five tracks:
  - **Keys:** an FM electric piano.
  - **Pad:** a detuned pad.
  - **Bass:** sine through tanh saturation into a low-pass filter, with an LFO and a 40 ms glide on the cutoff.
  - **Drums and percussion:** a synthesized kit and percussion.

  A single sequencer drives every track. It's clocked by the running sample count inside the audio callback, never by frame time, so the band stays sample-locked however the frame rate moves.
- **Tests:** 7 LEAF scenarios cover each gate and feature (menu, test tone, speech, chords to Confirm, transport, cutoff, Mix card patterns and mutes), and all pass in the preview. A fresh preview reset runs clean. Separately, 10 unit tests cover the engine (tempo grid, every track and pattern, click-free mutes, next-bar switching, chord voicings, ducking) and 9 cover the chord parser.
- **A safety net:** we finished and tested a first version (chords, bass, transport) first, kept it as a fallback, and extended a copy into the full band.

## Challenges we ran into

- **Sign-in:** Lens Studio's new developer sign-in failed for us, and 5.23.2 only offered a Snapchat login. CLAD's router won't start a full build without sign-in, so we skipped sign-in and built through targeted Lens Studio MCP edits, using CLAD's skills as reference. The Lens uses no Snap AI or cloud services, so nothing needed an account.
- **Voice in the preview:** AsrModule needs a Snap login in the preview. Every voice action got a typed stand-in that feeds the same parser.
- **Unsaved scene edits:** MCP scene edits live in memory until the project is saved. Our first copy of the project lost its wiring until we restored the saved scene. Now we always save before we copy.
- **Tooling mismatch:** a preview-inspection helper quietly installed a package built for a newer Lens Studio and broke the compile. We archived it and drove every check with LEAF instead.
- **Timing:** five synthesized tracks have to stay locked together. Counting samples inside the audio callback, instead of trusting frame time, solved it.

## Accomplishments that we're proud of

- A full band from one spoken sentence, synthesized entirely inside the Lens, with no samples to license.
- Mixing as a place in the room: you turn to the Mix card the way you'd turn to a bandmate.
- A complete flow, from launch to chords to band to mix, with every step verified by LEAF in the preview.
- Built and tested inside the round in one afternoon, with a working fallback the whole way.

## What we learned

- On glasses, the design work is mostly deciding what not to show: three cards at most, black as clear glass, big targets, only the next step.
- A closed build-run-test loop through the Lens Studio MCP, plus LEAF, makes an agent's work checkable.
- Sample-accurate audio on Specs is possible with `AudioOutputProvider` if the music clock lives inside the audio callback.

## What's next for Specs Soundize

- Route the live vocal or horn mic into the mix, with monitoring and a feedback guard, and record loops.
- Voice commands for the mix ("drums: house", "mute keys", "add the pad").
- Song sections (verse, chorus, bridge), tempo control and more patterns.
- Stage mode: ear-safe "more me" in-ear faders, and effects you steer with where the bell points.

## Built with

lens-studio, specs, spectacles-interaction-kit, ui-kit, typescript, clad, lens-studio-mcp, claude-code, leaf, asrmodule, audio-output

## Try it out

- Repo: https://github.com/BluesPrince/specs-soundize
- Video: (your YouTube link)

---

# Video shot list (target 2:50, hard limit 3:00)

Before recording: open `Specs Soundize Live.esproj`, set the preview device to Spectacles in Interactive Preview, and **restart the preview** so the green LEAF "PASSED" text is gone. Have the progression ready to type. Record the preview window plus your face or horn in a corner if you can.

| Time | Shot | Criterion it serves |
|---|---|---|
| 0:00–0:10 | **Hook:** the band already playing; quick turn to the Mix card, mute and unmute the drums. On-screen text: "Say your chords. Hear your band. Hands stay on the horn." | Presentation: it works in the first 10 seconds |
| 0:10–0:30 | **Problem and who it's for:** you with the sax: "When I play, my hands are on the horn. To change a backing track, I stop, look down and tap a screen." Name the user: gigging musicians, singers, horn and keyboard players. | Presentation: problem, who, why it matters |
| 0:30–1:35 | **End to end, one uncut take:** restart the preview → Start with: Chords → type (and say) "two bars of C minor, one bar of A flat, one bar of B flat" → chips appear → Confirm → Play → transport "bar 2 of 4, next: A♭" → turn right to Mix → Drums "Boom bap → House" lands on the next bar → mute Keys and Pad, leaving drums and bass → bring them back → sweep the filter. | Design: a complete, coherent product; the judges asked for uncut footage |
| 1:35–1:50 | **Shortcut:** type "two five one in F" → Gm7 C7 Fmaj7 → Confirm → the band follows the new chords. | Innovation: the band follows your harmony |
| 1:50–2:25 | **How it's built:** `devpost/design-brief.md` from the plan-lens skill pack; Claude Code with CLAD building through the Lens Studio MCP (the tool calls scrolling by); the LEAF panel showing 7 scenarios passing; one line on the engine: "one sample-counted clock, five synthesized tracks, no samples." | Technical implementation: CLAD, Lens Studio, MCP |
| 2:25–2:40 | **Design choices:** three cards, black backgrounds read as clear glass, big pinch targets, mixing as a place in the room; "Preview: typed. On Specs: voice." | Design |
| 2:40–2:50 | **Why it matters and what's next:** "A band that follows you while your hands stay on your instrument. Next: your live mic in the mix, and voice commands." End card: repo URL. | Presentation |
