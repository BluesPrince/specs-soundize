import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {SoundizeLeafInteractor, PHRASE} from "./SoundizeLeafInteractor"
import {openChords, confirmPhrase} from "./SoundizeFlow"
import {SoundizeApp} from "../Scripts/SoundizeApp"
import {BassSynth} from "../Scripts/BassSynth"

@component
export class Gate2TestToneScenario extends Scenario {
  async run(): Promise<void> {
    const ix = new SoundizeLeafInteractor()
    await openChords(ix)
    expect(BassSynth.instance).toBeTruthy()
    const engine: any = BassSynth.instance.engine
    await ix.pinch("Test Tone Button")
    expect(engine.toneLeft).toBeGreaterThan(0) // tone queued, being rendered
    await sleep(1500)
    expect(engine.toneLeft).toBe(0) // 1 s tone fully rendered through enqueueAudioFrame
  }
}
