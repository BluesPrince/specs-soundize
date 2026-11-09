import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {SoundizeLeafInteractor} from "./SoundizeLeafInteractor"
import {confirmPhrase} from "./SoundizeFlow"
import {BassSynth} from "../Scripts/BassSynth"

// Text of the "Label" child that SoundizeApp.button() puts under each button object.
function buttonLabel(buttonName: string): string {
  const so = findSceneObjectByName(buttonName)
  if (!so) throw new Error(`Button "${buttonName}" not found`)
  for (let i = 0; i < so.getChildrenCount(); i++) {
    const ch = so.getChild(i)
    if (ch.name === "Label") return (ch.getComponent("Component.Text") as Text).text
  }
  throw new Error(`Button "${buttonName}" has no Label`)
}

@component
export class Feature5MixScenario extends Scenario {
  async run(): Promise<void> {
    const ix = new SoundizeLeafInteractor()
    await confirmPhrase(ix)
    expect(findSceneObjectByName("Mix Card").enabled).toBe(true)
    await ix.pinch("Play Stop Button")
    expect(BassSynth.instance.engine.isPlaying()).toBe(true)
    await sleep(500)

    await ix.pinch("Drums Pattern Button")
    const drums = buttonLabel("Drums Pattern Button")
    print("[LEAF] drums pattern: " + drums)
    expect(drums).toBe("House 2/4")

    await ix.pinch("Keys Mute Button")
    print("[LEAF] keys mute: " + BassSynth.instance.isMuted("keys") + " / " + buttonLabel("Keys Mute Button"))
    expect(BassSynth.instance.isMuted("keys")).toBe(true)
    expect(buttonLabel("Keys Mute Button")).toBe("Muted")

    await ix.pinch("Keys Mute Button")
    print("[LEAF] keys mute: " + BassSynth.instance.isMuted("keys") + " / " + buttonLabel("Keys Mute Button"))
    expect(BassSynth.instance.isMuted("keys")).toBe(false)
    expect(buttonLabel("Keys Mute Button")).toBe("On")

    await ix.pinch("Play Stop Button")
    expect(BassSynth.instance.engine.isPlaying()).toBe(false)
  }
}
