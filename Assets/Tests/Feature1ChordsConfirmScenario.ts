import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {SoundizeLeafInteractor, PHRASE} from "./SoundizeLeafInteractor"
import {openChords, confirmPhrase} from "./SoundizeFlow"
import {SoundizeApp} from "../Scripts/SoundizeApp"
import {BassSynth} from "../Scripts/BassSynth"

@component
export class Feature1ChordsConfirmScenario extends Scenario {
  async run(): Promise<void> {
    const ix = new SoundizeLeafInteractor()
    const app = await openChords(ix)
    const pinches = app.pinchCount
    app.onPhrase(PHRASE)
    const chips = (findSceneObjectByName("Chord Chips").getComponent("Component.Text") as Text).text
    print("[LEAF] chips: " + chips)
    expect(chips.split(/\s+/).length).toBe(4)
    await ix.pinch("Confirm Button")
    expect(app.pinchCount - pinches).toBe(1)
    expect(app.committed.join(" ")).toBe("Cm Cm A♭ B♭")
    expect(BassSynth.instance.engine.getProgression().join(" ")).toBe("Cm Cm A♭ B♭")
    expect(findSceneObjectByName("Transport Card").enabled).toBe(true)
  }
}
