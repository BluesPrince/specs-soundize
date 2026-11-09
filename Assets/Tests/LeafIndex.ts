import {scenariosIndex} from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator"
import {ScenarioMetadata} from "Leaf.lspkg/Scenarios/scenario/ScenarioMetadata"
import {Gate1MenuScenario} from "./Gate1MenuScenario"
import {Gate2TestToneScenario} from "./Gate2TestToneScenario"
import {Gate3SpeechScenario} from "./Gate3SpeechScenario"
import {Feature1ChordsConfirmScenario} from "./Feature1ChordsConfirmScenario"
import {Feature3TransportScenario} from "./Feature3TransportScenario"
import {Feature4CutoffScenario} from "./Feature4CutoffScenario"
import {Feature5MixScenario} from "./Feature5MixScenario"

@component
export class LeafIndex extends BaseScriptComponent {
  @scenariosIndex
  static scenariosIndex: ScenarioMetadata[] = [
    {id: "gate1-menu", typename: Gate1MenuScenario.getTypeName()},
    {id: "gate2-test-tone", typename: Gate2TestToneScenario.getTypeName()},
    {id: "gate3-speech", typename: Gate3SpeechScenario.getTypeName()},
    {id: "feature1-chords-confirm", typename: Feature1ChordsConfirmScenario.getTypeName()},
    {id: "feature3-transport", typename: Feature3TransportScenario.getTypeName()},
    {id: "feature4-cutoff", typename: Feature4CutoffScenario.getTypeName()},
    {id: "feature5-mix", typename: Feature5MixScenario.getTypeName()},
  ]
}
