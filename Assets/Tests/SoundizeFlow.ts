// Shared flow steps for the Soundize LEAF scenarios.
import {SoundizeLeafInteractor, PHRASE} from "./SoundizeLeafInteractor"
import {SoundizeApp} from "../Scripts/SoundizeApp"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"

export async function openChords(ix: SoundizeLeafInteractor): Promise<SoundizeApp> {
  await sleep(1500)
  await ix.pinch("Chords Button")
  return SoundizeApp.instance
}

export async function confirmPhrase(ix: SoundizeLeafInteractor): Promise<SoundizeApp> {
  const app = await openChords(ix)
  app.onPhrase(PHRASE)
  await ix.pinch("Confirm Button")
  return app
}
