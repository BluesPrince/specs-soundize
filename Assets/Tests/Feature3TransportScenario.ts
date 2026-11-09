import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {SoundizeLeafInteractor, PHRASE} from "./SoundizeLeafInteractor"
import {openChords, confirmPhrase} from "./SoundizeFlow"
import {SoundizeApp} from "../Scripts/SoundizeApp"
import {BassSynth} from "../Scripts/BassSynth"

@component
export class Feature3TransportScenario extends Scenario {
  async run(): Promise<void> {
    const ix = new SoundizeLeafInteractor()
    await confirmPhrase(ix)
    const engine = BassSynth.instance.engine
    await ix.pinch("Play Stop Button")
    expect(engine.isPlaying()).toBe(true)
    await sleep(3000) // 90 BPM: a bar is 2.67 s
    const bar = (findSceneObjectByName("Bar Text").getComponent("Component.Text") as Text).text
    const cur = (findSceneObjectByName("Current Chord Text").getComponent("Component.Text") as Text).text
    const nxt = (findSceneObjectByName("Next Chord Text").getComponent("Component.Text") as Text).text
    const p = engine.getPosition()
    print("[LEAF] transport: " + bar + " | " + cur + " | " + nxt + " | engine bar " + p.bar)
    expect(bar).toBe("bar " + p.bar + " of 4")
    expect(cur).toBe(p.current)
    expect(nxt).toBe("next: " + p.next)
    await ix.pinch("Play Stop Button")
    expect(engine.isPlaying()).toBe(false)
  }
}
