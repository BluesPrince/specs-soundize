---
status: approved
approved_by: Dennison Blackett, from his written spec (Nov 9, 2026, 12:35 CT). Values he didn't choose are marked (default).
---

# Design brief: Specs Soundize

## The one spatial moment
A musician with their hands on an instrument says a progression out loud ("two bars of C minor, one bar of A flat, one bar of B flat"). The progression appears in big lit text, one chip per bar. They pinch Confirm, and a bass line synthesized inside the Lens starts looping it at 90 BPM, while a transport card shows "bar 2 of 4", the beat, and the current and next chord.

## Why it belongs on glasses
- Uses: leaves your body free; information where your eyes already are.
- Why it's better than the phone or laptop version: the player's hands stay on the instrument and their eyes stay up. A phone or laptop means stopping, looking down and typing.

## Product or overlay
- Type: product. The virtual thing is the experience: a voice-driven chord-and-bass sketchpad.
- What the real version would sense: the player's voice (AsrModule on Specs).
- Stand-in for the preview: if AsrModule doesn't transcribe in the preview, a text input feeds the same parser, labeled "Preview: typed. On Specs: voice."

## Where things live
- Where the user is looking during the main task: straight ahead, a little below eye level, as if at a music stand (default).
- At most three cards on screen at once: black backgrounds (black is clear glass), large lit text, few big targets, showing only the next step.
- Workflow menu card: centered, about 70 cm away, about 10 cm below eye level, about 40 cm wide (default).
- Chords card: same spot as the menu once Chords is chosen. Chord chips are about 8 cm tall, with text readable from where the user stands (default).
- Transport card: just below the Chords card, about 70 cm away (default).
- Filter slider: on the transport card or just beside it, at least 25 cm long (default).

## Hands and input
- Choose a workflow: pinch a big button on the launch menu ("Start with: Chords / Bass line / Beat / Sample"). Only Chords is live; the others show "next".
- Commit a progression: pinch Confirm on the Chords card.
- Play/stop: one big pinch target on the transport card.
- Filter cutoff: one big drag slider. Stretch: a second slider for LFO rate.
- Targets are big and highlight when aimed at.
- Voice and the button that does the same job: speak the progression (AsrModule). On a preview without ASR, type it into the labeled text input, then pinch Confirm.

## When things show
- Workflow menu: shows at launch, hides once a workflow is picked.
- Chords card: shows after Chords is picked. It shows the parsed chips live and stays as the reference while the loop plays.
- Transport card: shows after the first Confirm.
- Bass ducks while ASR is listening.
- If something needs attention out of view: none. Everything stays in view.

## Done criteria
Each one can be checked in Lens Studio's preview (device type Spectacles).
1. The Lens opens and runs in the preview, and the launch menu shows "Start with: Chords / Bass line / Beat / Sample", with only Chords live.
2. A test tone plays in the preview through an Audio Output asset and AudioOutputProvider.enqueueAudioFrame (Snap's sine example).
3. Speaking a progression (or typing it, if ASR doesn't run in the preview) into the Chords card turns "two bars of C minor, one bar of A flat, one bar of B flat" into chips Cm, Cm, A♭, B♭, one chip per bar. Pinching Confirm commits it.
4. Pinch and drag register in the preview: pinching Confirm and play/stop works, and dragging the cutoff slider changes its value.
5. After Confirm and play, a bass line plays each chord's root (octave 2–3) at 90 BPM in 4/4, looping the progression. The transport card shows "bar N of 4", beat dots, and the current and next chord in time with the audio.

## Out of scope
- Bass line, Beat and Sample workflows (they show "next").
- Any network call, bridge, Ableton, THIRI API, keys or secrets. Everything runs inside the Lens.
- Recording audio, saving loops between sessions, more than one user.

## Risks and open questions
- AsrModule may not transcribe in the preview, which is why there's a typed fallback feeding the same parser.
- How Audio Output behaves in the preview (latency, buffer underruns) is unproven until gate 2.
- The sequencer is clocked from the sample count inside the audio callback, not frame time, so timing follows the audio. Feel unproven on glasses.
- Additive display: black backgrounds read as clear glass by design, so all text and targets must be lit (light on black).

## Build notes for CLAD
- Build for SPECS so it runs and can be demonstrated in Lens Studio's preview. No SPECS device is available. Preview device type: Spectacles.
- Use Spectacles Interaction Kit (SIK) and UI Kit for all interactions, so they work with the mouse in Interactive Preview and with LEAF.
- Build any stand-in exactly as described above, and keep it obvious in the scene.
- Use real-world scale in centimeters. Keep content inside the user's view during the main task.
- The display is additive: black renders as transparent. Don't rely on black or very dark content to be seen; keep text light and readable from where the user stands.
- Get the basic flow working first, then add detail.
- Write LEAF scenarios for each done criterion, run them in preview, and report which pass. Say which criteria have no test.
- Don't record, identify, or follow people.
- No network calls, no remote services, no API keys anywhere in the project.
- Audio: one Audio Output asset on an Audio component (Autoplay Loop). Each UpdateEvent, write `getPreferredFrameSize()` samples and call `enqueueAudioFrame(data, shape)`, as in Snap's sine example. The bass voice is sine oscillator → soft saturation (tanh drive) → low-pass filter, with an LFO on the cutoff. Clock the sequencer from a running sample count inside that callback, never from frame time.
- Chord grammar for the parser: bar counts in words or digits ("a bar", "one bar", "two bars", "2 bars"); notes A–G with flat/sharp; qualities minor, major, seven, major seven, minor seven, diminished, half diminished, sus. Homophones: "be flat" = B♭, "see" = C. "minor" and "major" are always chord qualities. Stretch: "two five one in F" expands to Gm7, C7, Fmaj7.

## After the build: judge it
This part is for you, after CLAD finishes.

1. **Does it work?** Ask your agent which LEAF tests passed and which done criteria have no test.
2. **Walk around it.** Open the preview in Interactive Preview. Use WASD to move, Q and E to go down and up, and right-drag (or hold Shift) to look around. Clicking acts as a pinch. Stand where a user would and look at the task.
3. **Ask the three questions.**
   - Does it use what I'm looking at?
   - Does it put something in my space, where it belongs?
   - Does it free my hands or let me keep my eyes up?
   - Would it be just as good on a phone? If so, what would make it need the glasses?
4. **Check comfort.**
   - Everything I need is in view while I do the task. Nothing sits at the edges, behind me, or stuck to my face.
   - Every control is within reach of someone standing there.
   - Text reads easily from where I stand. No dark UI disappearing.
   - Things show when needed and get out of the way.
5. **Label what you know.** Write "logic proven" next to anything the tests and preview show working, and "feel unproven" next to anything only real glasses could tell you (comfort over time, real hand tracking, real recognition).
6. **Fix with design notes, not code.** Tell your agent what to change in design terms, for example: "Move the step card 15 cm lower and next to the pan. Make the Next button twice as big. Re-run the tests." If a fix takes under a minute, like nudging a panel, do it yourself in the scene.
7. **Submit.** Record a video under 3 minutes of your Lens in the preview, public on YouTube. Make your repo public with your Lens Studio project and this `devpost/` folder. Details are on the hackathon site: https://learn-specs.devpost.com/resources

## Addendum: the 5-track loop performer (Nov 9, 2026, 2:00 pm)

Approved by Dennison in conversation: "the real MVP" is a band you can build and perform with from the glasses, ending on a full track as the wow moment. This addendum extends the brief above. It was built in a second project, so the first version stays as a safety net.

### The one spatial moment (updated)
After confirming the progression, the player presses Play and hears a full band (keys, pad, bass, drums, percussion) looping their chords at 90 BPM. From a Mix card they switch each part's pattern or mute it, building the loop up or down while their hands return to the instrument.

### Tracks
- **Vox (live):** the player's own voice or horn. On Specs that's the mic; this version only shows a mute toggle and doesn't route audio.
- **Keys:** a chordal electric-piano part following the progression. 4 patterns: Whole, Quarters, Charleston, Offbeats.
- **Pad:** sustained chords. 4 patterns: Sustain, Open voicing, Swell (half notes), High.
- **Bass:** the root-based bass from the first version. 4 patterns: Groove, Root-5th, Octaves, Halves.
- **Drums:** 4 patterns: Boom bap, House, Half-time, Funk.
- **Perc:** 4 patterns: Shaker, Congas, Clave, Tambourine.
- Every sound is synthesized inside the Lens on the same sample-counted clock (no samples, no network). Pattern changes wait for the next bar; mutes fade in about 20 ms.

### Where things live and hands
- A Mix card with one row per track: the track name, one big button showing the current pattern (pinch for the next one), and a big Mute toggle.
- At most three cards in view: Chords (chips), Transport and Mix (default placement).

### Done criteria (added)
6. After Confirm and Play, a full band plays the progression: keys, pad, bass, drums and percussion are all audible and in time.
7. Pinching a track's pattern button changes its label (for example Drums "Boom bap 1/4" → "House 2/4") and the pattern switches on the next bar.
8. Pinching Mute silences that track and pinching again brings it back, with no clicks.
