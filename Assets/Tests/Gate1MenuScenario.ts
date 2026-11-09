import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {SoundizeLeafInteractor, PHRASE} from "./SoundizeLeafInteractor"
import {openChords, confirmPhrase} from "./SoundizeFlow"
import {SoundizeApp} from "../Scripts/SoundizeApp"
import {BassSynth} from "../Scripts/BassSynth"

@component
export class Gate1MenuScenario extends Scenario {
  async run(): Promise<void> {
    const ix = new SoundizeLeafInteractor()
    await sleep(1500)
    expect(findSceneObjectByName("Menu Card").enabled).toBe(true)
    expect(findSceneObjectByName("Chords Card").enabled).toBe(false)
    expect(findSceneObjectByName("Transport Card").enabled).toBe(false)
    await ix.pinch("Beat Button") // "next": must not leave the menu
    expect(findSceneObjectByName("Menu Card").enabled).toBe(true)
    await ix.pinch("Chords Button")
    expect(findSceneObjectByName("Menu Card").enabled).toBe(false)
    expect(findSceneObjectByName("Chords Card").enabled).toBe(true)
  }
}
