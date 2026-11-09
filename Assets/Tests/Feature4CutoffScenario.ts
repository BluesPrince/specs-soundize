import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {SoundizeLeafInteractor, PHRASE} from "./SoundizeLeafInteractor"
import {openChords, confirmPhrase} from "./SoundizeFlow"
import {SoundizeApp} from "../Scripts/SoundizeApp"
import {BassSynth} from "../Scripts/BassSynth"

@component
export class Feature4CutoffScenario extends Scenario {
  async run(): Promise<void> {
    const ix = new SoundizeLeafInteractor()
    const app = await confirmPhrase(ix)
    const engine = BassSynth.instance.engine
    const before = engine.getCutoff()
    await ix.dragSlider("Cutoff Slider", new vec3(8, 0, 0), 600)
    print("[LEAF] cutoff " + before + " -> " + engine.getCutoff())
    expect(engine.getCutoff()).toBeGreaterThan(before)
    expect(engine.getCutoff()).toBeCloseTo(app.cutoff, 3)
  }
}
