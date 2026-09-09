import defaultPackResource from "../resources/default-pack.json";
import defaultSettingsResource from "../resources/default-settings.json";
import type { GameSettings, PromptPack, RoundSettings } from "./types";

const clone = <T>(value: T): T => structuredClone(value);

export const starterPack = clone(defaultPackResource) as PromptPack;
export const defaultGameTemplate = clone(
  defaultSettingsResource,
) as GameSettings;

export function createRound(name = "Standard round"): RoundSettings {
  return {
    ...clone(defaultGameTemplate.rounds[0]),
    id: crypto.randomUUID(),
    name,
  };
}

export function createSpecialRound(): RoundSettings {
  return {
    ...clone(defaultGameTemplate.rounds.at(-1)!),
    id: crypto.randomUUID(),
  };
}

export function createGameSettings(name = "Default game"): GameSettings {
  return {
    ...clone(defaultGameTemplate),
    id: crypto.randomUUID(),
    name,
    rounds: defaultGameTemplate.rounds.map((round) => ({
      ...clone(round),
      id: crypto.randomUUID(),
    })),
  };
}
