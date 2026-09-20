import { defaultGameTemplate, starterPack } from "../domain/defaults";
import {
  REACTIONS,
  type GameSettings,
  type Prompt,
  type PromptPack,
} from "../domain/types";

class JsonStore<T> {
  constructor(
    private key: string,
    private fallback: T,
    private legacyKey?: string,
  ) {}
  read(): T {
    try {
      const raw =
        localStorage.getItem(this.key) ??
        (this.legacyKey ? localStorage.getItem(this.legacyKey) : null);
      return raw ? (JSON.parse(raw) as T) : structuredClone(this.fallback);
    } catch {
      return structuredClone(this.fallback);
    }
  }
  write(value: T) {
    localStorage.setItem(this.key, JSON.stringify(value));
  }
}

const normalizePrompt = (value: unknown): Prompt => {
  const source: Partial<Prompt> =
      typeof value === "string" ? { text: value } : (value as Prompt),
    safetyQuips = Array.isArray(source.safetyQuips)
      ? source.safetyQuips.map(String).filter((quip) => quip.trim())
      : [];
  return {
    id: String(source.id || crypto.randomUUID()),
    text: String(source.text || ""),
    safetyQuips: safetyQuips.length ? safetyQuips : ["No comment."],
  };
};

const normalizePack = (
  candidate: Partial<PromptPack> & { prompts?: unknown[] },
): PromptPack => {
  if (
    candidate.id === "default-pack" ||
    (candidate.id === "starter-pack" && candidate.name === "House Favorites")
  )
    return structuredClone(starterPack);
  const now = new Date().toISOString();
  return {
    schemaVersion: 2,
    id: String(candidate.id || crypto.randomUUID()),
    name: String(candidate.name || "Untitled pack").slice(0, 60),
    description: String(candidate.description || "").slice(0, 240),
    author: String(candidate.author || "").slice(0, 40),
    tags: Array.isArray(candidate.tags)
      ? candidate.tags.map(String).slice(0, 12)
      : [],
    prompts: (candidate.prompts || [])
      .map(normalizePrompt)
      .filter((prompt) => prompt.text.trim()),
    createdAt: candidate.createdAt || now,
    updatedAt: now,
  };
};

const normalizeGame = (
  value: GameSettings & { anonymousAnswers?: boolean },
): GameSettings => {
  if (value.id === "default-game" || value.name === "Classic-ish")
    return structuredClone(defaultGameTemplate);
  return {
    ...structuredClone(defaultGameTemplate),
    ...value,
    id: value.id || crypto.randomUUID(),
    name: value.name || "Imported game",
    maxPlayers: Math.max(2, value.maxPlayers || 8),
    lateJoin: value.lateJoin ?? true,
    takeoverDisconnectedPlayers: value.takeoverDisconnectedPlayers ?? true,
    fullRoomFallback: value.fullRoomFallback ?? "spectator",
    showAuthorsBeforeVoting: value.showAuthorsBeforeVoting ?? false,
    revealAuthorsAfterVoting: value.revealAuthorsAfterVoting ?? true,
    revealVotersAfterVoting: value.revealVotersAfterVoting ?? true,
    scoreboardTimeSeconds: value.scoreboardTimeSeconds ?? 10,
    maxReactionsPerPlayer:
      value.maxReactionsPerPlayer == null
        ? defaultGameTemplate.maxReactionsPerPlayer
        : value.maxReactionsPerPlayer === "unlimited" ||
            Number(value.maxReactionsPerPlayer) <= 0
          ? "unlimited"
          : Math.max(1, Number(value.maxReactionsPerPlayer)),
    maxReactionsPerTarget:
      value.maxReactionsPerTarget == null
        ? defaultGameTemplate.maxReactionsPerTarget
        : value.maxReactionsPerTarget === "unlimited" ||
            Number(value.maxReactionsPerTarget) <= 0
          ? "unlimited"
          : Math.max(1, Number(value.maxReactionsPerTarget)),
    reactionPoints: Object.fromEntries(
      REACTIONS.map((reaction) => [
        reaction.id,
        value.reactionPoints?.[reaction.id] ?? reaction.defaultPoints,
      ]),
    ) as GameSettings["reactionPoints"],
    rounds: Array.isArray(value.rounds)
      ? value.rounds.map((round) => ({
          ...structuredClone(defaultGameTemplate.rounds[0]),
          ...round,
          id: round.id || crypto.randomUUID(),
          scoringMode: round.scoringMode ?? "per-vote",
          totalVotePoints: Math.max(0, round.totalVotePoints ?? 1000),
          spectatorPoolPercentage: Math.min(
            100,
            Math.max(0, round.spectatorPoolPercentage ?? 20),
          ),
          playerBonusMode: round.playerBonusMode ?? "fixed",
          spectatorBonusMode: round.spectatorBonusMode ?? "fixed",
          resultsTimeSeconds: round.resultsTimeSeconds ?? 8,
          revealStyle: round.revealStyle ?? "one-at-a-time",
          revealTimeSeconds: round.revealTimeSeconds ?? 1.2,
          showPointAwards: round.showPointAwards ?? true,
          endVotingWhenAllVotesIn: round.endVotingWhenAllVotesIn ?? true,
          voteAllocation: round.voteAllocation ?? "one-per-answer",
          maxVotesPerAnswer: round.maxVotesPerAnswer ?? 1,
        }))
      : [],
  };
};

export class PackRepository {
  private store = new JsonStore<PromptPack[]>(
    "quip-kit:packs:v2",
    [starterPack],
    "quip-kit:packs:v1",
  );
  all() {
    return this.store.read().map(normalizePack);
  }
  save(pack: PromptPack) {
    if (pack.id === "default-pack") return;
    const packs = this.all();
    const index = packs.findIndex((item) => item.id === pack.id);
    if (index >= 0) packs[index] = normalizePack(pack);
    else packs.push(normalizePack(pack));
    this.store.write(packs);
  }
  remove(id: string) {
    if (id === "default-pack") return;
    this.store.write(this.all().filter((pack) => pack.id !== id));
  }
  import(raw: string) {
    const value = JSON.parse(raw) as Partial<PromptPack> & {
      prompts?: unknown[];
    };
    if (!value.name || !Array.isArray(value.prompts))
      throw new Error("That file is not a valid Party Quips pack.");
    const pack = normalizePack({ ...value, id: crypto.randomUUID() });
    this.save(pack);
    return pack;
  }
}

export class TemplateRepository {
  private store = new JsonStore<GameSettings[]>(
    "quip-kit:templates:v2",
    [defaultGameTemplate],
    "quip-kit:templates:v1",
  );
  all() {
    return this.store.read().map((item) => normalizeGame(item));
  }
  save(template: GameSettings) {
    const templates = this.all();
    const copy = {
      ...structuredClone(template),
      id: template.id === "default-game" ? crypto.randomUUID() : template.id,
    };
    const index = templates.findIndex((item) => item.id === copy.id);
    if (index >= 0) templates[index] = copy;
    else templates.push(copy);
    this.store.write(templates);
    return copy;
  }
  remove(id: string) {
    if (id === "default-game") return;
    this.store.write(this.all().filter((template) => template.id !== id));
  }
  import(raw: string) {
    const value = JSON.parse(raw) as GameSettings;
    if (!value.name || !Array.isArray(value.rounds))
      throw new Error("That file is not valid Party Quips settings.");
    const imported = normalizeGame({ ...value, id: crypto.randomUUID() });
    this.store.write([...this.all(), imported]);
    return imported;
  }
}

export function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
