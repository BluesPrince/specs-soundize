# Specs Soundize

Say a chord progression, see it as big chips, pinch Confirm, and press Play: a five-piece band synthesized inside the Lens loops your chords at 90 BPM. Turn your head to the Mix card on your right to switch each part's pattern or mute it, building the track up and down while your hands go back to your instrument. Built for Snap Specs with Lens Studio, for Devpost's **Learn AR with SPECS**.

A musician's hands are on the instrument and their eyes are up, so the Lens keeps to three cards with black backgrounds (black is clear glass on Specs), large lit text and a few big targets, and shows only the next step.

## What it does

- **Launch menu:** "Start with: Chords / Bass line / Beat / Sample". Only Chords is live; the others show "next".
- **Chords card:** speak a progression (AsrModule on Specs) or, in the preview, type it into the field labeled "Preview: typed. On Specs: voice." For example, "two bars of C minor, one bar of A flat, one bar of B flat" becomes Cm, Cm, A♭, B♭, one chip per bar. Shortcut: "two five one in F" expands to Gm7, C7, Fmaj7. Pinch **Confirm** to commit.
- **Transport card:** one big Play/Stop target, "bar 2 of 4", beat dots, the current and next chord, and a filter cutoff slider for the bass (with a 40 ms glide, so a drag sweeps smoothly).
- **Mix card,** to the player's right and angled toward them: one row per track. Each row has a big pattern button (pinch for the next pattern; it switches on the next bar) and a big On/Muted toggle (mutes fade in about 20 ms, so they don't click).

| Track | Patterns | Follows your chords |
|---|---|---|
| Vox (live) | Your voice or horn. On Specs that's the mic; this version only shows a mute toggle and doesn't route audio | — |
| Keys | Whole, Quarters, Charleston, Offbeats (FM electric piano) | Yes |
| Pad | Sustain, Open voicing, Swell, High | Yes |
| Bass | Groove, Root-5th, Octaves, Halves (sine → tanh drive → low-pass, LFO on the cutoff) | Yes (roots) |
| Drums | Boom bap, House, Half-time, Funk | — |
| Perc | Shaker, Congas, Clave, Tambourine | — |

**Audio:** every sound is synthesized in the Lens and mixed into one Audio Output asset through `AudioOutputProvider.enqueueAudioFrame`, following Snap's sine example. There are no samples, so there's no sample licensing. One sequencer, clocked by the running sample count inside the audio callback rather than frame time, drives all five tracks, so they stay locked together. The band ducks while ASR is listening.

## Status (Nov 9, 2026)

| Gate / feature | In Lens Studio's preview | How it was checked |
|---|---|---|
| Launch menu (only Chords live) | Works | LEAF `gate1-menu` |
| Audio Output test tone | Works | LEAF `gate2-test-tone` + logs |
| Speech | Typed fallback in the preview | LEAF `gate3-speech`: Listen starts AsrModule and ducks the band; ASR needs a Snap login, so it doesn't transcribe in the preview |
| Pinch and drag (SIK / UI Kit) | Works | LEAF + logs |
| Chords → chips → Confirm | Works | LEAF `feature1-chords-confirm` + screenshot |
| Band + transport ("bar 2 of 4, Cm, next: A♭") | Works, about 4 s of playback with no errors | LEAF `feature3-transport` |
| Cutoff slider | Works | LEAF `feature4-cutoff` |
| Mix card: pattern switch + mute | Works ("Drums → House 2/4", "Keys muted / on") | LEAF `feature5-mix` + screenshot `devpost/preview-mix.png` |
| Engine: tempo, every track and pattern, click-free mutes, next-bar switching, voicings | Works | 10 unit tests outside Lens Studio |
| LFO rate slider, routing the live vocal | Not built | Cut |

**Known rough edges:** viewed at a steep angle, the Mix card's middle column can drop out (it's fine head-on), and the Chords title shows a faint ghost copy. Feel on real glasses is unproven: hand tracking, voice recognition, comfort and audio latency. On Specs, AsrModule uses Snap's speech service; that's the only part that isn't fully inside the Lens.

## Run it in the Lens Studio preview

1. Open `Specs Soundize Live.esproj` in Lens Studio 5.24.1 (built there; 5.22 or later should work).
2. In the Preview panel, set the device type to **Spectacles** and use Interactive Preview. A click acts as a pinch; WASD moves, right-drag looks around.
3. Pinch **Chords**, type (or say) a progression, and pinch **Confirm**.
4. Pinch **Play**: the full band starts. Look right to the **Mix** card to change patterns or mute tracks. Drag the cutoff slider to sweep the bass filter.

No glasses, network, accounts or keys are needed. Everything runs inside the Lens.

## Tools used

- **Lens Studio 5.24.1** (Intel macOS), with Spectacles Interaction Kit (SIK), UI Kit and LEAF 2.0.2.
- **CLAD** (Snap's `ls-clad` plugin for Claude Code, commit 8adedd5) and the **Lens Studio MCP**: the scene, UI, audio wiring and LEAF tests were built through them, with CLAD's skills as reference.
- **Devpost Learn skill pack** (`challengepost/learn-specs`, `plan-lens` skill): the planning docs, with the 5-track addendum and screenshots, are in `devpost/`.
- **Claude Code** (Claude Opus 5.5) as the coding agent.

## Disclosure

- **Reused from the pre-existing Specs Studio prototype** (Blues Prince Media, Nov 8, 2026, a separate local repo): design ideas only, not code. Those ideas are the eyes-up three-card layout, black backgrounds as clear glass, big targets for a player whose hands are busy, and showing the current and next chord (the prototype's "Changes Ahead" card). No code, scenes or assets from that prototype are in this project. Its chord-naming logic reads MIDI notes and isn't used here; this Lens's parser reads spoken or typed text and was written new.
- **Two projects, same day:** this Lens grew out of a first version built earlier in this round (chords, bass and transport only; kept as a fallback). This project is a copy of it, extended into the five-track band.
- **Written by the coding agent outside CLAD, during this round:** `Assets/Scripts/ChordParser.ts`, `BassEngine.ts` (the first version's engine, now unused), `LoopEngine.ts` (the five-track band), `BassSynth.ts` and `TransportCard.ts`, all by Claude Code on Nov 9, 2026, with unit tests run outside Lens Studio. The Mix card in `SoundizeApp.ts` and two small fixes (the cutoff glide and a throttled slider log) were script edits made the same way.
- **Built through the Lens Studio MCP with CLAD's skills:** the rest of `Assets/Scripts/SoundizeApp.ts` (menu, Chords card, ASR, buttons, slider and wiring), the scene objects, the Audio Output asset, and the LEAF tests in `Assets/Tests`. Sign-in and timing ruled out a full CLAD build, so this was done as targeted Lens Studio MCP edits.
- **Sign-in:** Lens Studio sign-in failed, so the project owner chose to skip it, and CLAD's router sign-in check was bypassed. The Lens uses no Snap AI or cloud services.
- **Packages:** SIK, UI Kit and LEAF 2.0.2 come from Snap's Asset Library. Packages swapped out during the build sit in `agent/`, which is kept out of the repo.
- **Planning:** the design brief in `devpost/design-brief.md` follows the skill pack's template, filled in from the owner's written spec and a later spoken addendum instead of the interactive interview. Values he didn't choose are marked "(default)".
