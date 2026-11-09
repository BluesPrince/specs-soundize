// Shared LEAF actions for Specs Soundize: pinch UI Kit buttons by object name, drag the cutoff slider.
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {findInteractablesByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"

export const PHRASE = "two bars of C minor, one bar of A flat, one bar of B flat"

export class SoundizeLeafInteractor extends DefaultLeafInteractor {
  async pinch(name: string): Promise<void> {
    const it = findInteractablesByName(name, undefined, true)[0]
    if (!it) throw new Error(`Interactable "${name}" not found or not enabled`)
    await this.trigger(it)
    await sleep(300)
  }

  async dragSlider(name: string, delta: vec3, ms: number): Promise<void> {
    const it = findInteractablesByName(name, undefined, true)[0]
    if (!it) throw new Error(`Slider "${name}" not found or not enabled`)
    await this.drag(it, delta, ms)
    await sleep(300)
  }
}
