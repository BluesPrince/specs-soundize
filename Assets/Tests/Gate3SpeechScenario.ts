import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {SoundizeLeafInteractor, PHRASE} from "./SoundizeLeafInteractor"
import {openChords, confirmPhrase} from "./SoundizeFlow"
import {SoundizeApp} from "../Scripts/SoundizeApp"
import {BassSynth} from "../Scripts/BassSynth"

@component
export class Gate3SpeechScenario extends Scenario {
  async run(): Promise<void> {
    const ix = new SoundizeLeafInteractor()
    const app = await openChords(ix)
    const engine: any = BassSynth.instance.engine
    await ix.pinch("Listen Button")
    print("[LEAF] after Listen: listening=" + app.listening + " ducked=" + engine.ducked)
    expect(engine.ducked).toBe(app.listening) // ducked exactly while ASR listens
    if (app.listening) await ix.pinch("Listen Button")
    expect(app.listening).toBe(false)
    expect(engine.ducked).toBe(false)
    // typed stand-in path feeds the same onPhrase()
    app.onPhrase(PHRASE)
    expect(app.bars.join(" ")).toBe("Cm Cm A♭ B♭")
    app.onPhrase("purple monkey")
    expect(app.bars.length).toBe(0)
    expect(app.lastError.length).toBeGreaterThan(0)
  }
}
