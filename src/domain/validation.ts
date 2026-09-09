import type { GameSettings, PromptPack, RoundSettings } from "./types";

export type ValidationIssue = {
  level: "error" | "warning";
  message: string;
  suggestion?: string;
};

export class SettingsValidator {
  static validateRound(
    round: RoundSettings,
    playerCount: number,
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const responders =
      round.respondersPerPrompt === "all"
        ? playerCount
        : round.respondersPerPrompt;
    if (responders > playerCount && playerCount > 0) {
      issues.push({
        level: "error",
        message: `${round.respondersPerPrompt} responders need at least that many players.`,
      });
    }
    if (typeof round.promptsPerPlayer === "number") {
      const assignments = playerCount * round.promptsPerPlayer;
      if (responders && assignments % responders !== 0) {
        const nearest = SettingsValidator.nearestFairPromptCount(
          playerCount,
          responders,
          round.promptsPerPlayer,
        );
        issues.push({
          level: "warning",
          message: `${assignments} player assignments cannot split evenly across groups of ${responders}.`,
          suggestion: `Use Auto or ${nearest} prompt${nearest === 1 ? "" : "s"} per player for equal opportunity.`,
        });
      }
    }
    const perAnswerLimit =
        round.voteAllocation === "one-per-answer"
          ? 1
          : round.maxVotesPerAnswer === "unlimited"
            ? round.votesPerPlayer
            : Math.max(1, round.maxVotesPerAnswer),
      responderChoices = Math.max(0, responders - 1),
      responderCapacity = responderChoices * perAnswerLimit;
    if (
      round.participantsCanVote &&
      round.votesPerPlayer > responderCapacity
    ) {
      issues.push({
        level: "warning",
        message: `Responders can allocate only ${responderCapacity} of ${round.votesPerPlayer} configured votes; their ballot will be cropped automatically.`,
      });
    }
    if (round.revealStyle === "one-at-a-time" && round.revealTimeSeconds <= 0)
      issues.push({
        level: "error",
        message: "One-at-a-time reveals need a positive reveal interval.",
      });
    return issues;
  }

  static nearestFairPromptCount(
    players: number,
    responders: number,
    from: number,
  ): number {
    for (let distance = 0; distance < Math.max(20, responders); distance += 1) {
      for (const value of [Math.max(1, from - distance), from + distance]) {
        if ((players * value) % responders === 0) return value;
      }
    }
    return from;
  }

  static autoPromptsPerPlayer(players: number, responders: number): number {
    if (!players || !responders) return 1;
    return SettingsValidator.nearestFairPromptCount(players, responders, 2);
  }

  static validateGame(
    settings: GameSettings,
    players: number,
    packs: PromptPack[],
  ): ValidationIssue[] {
    const issues = settings.rounds.flatMap((round, index) =>
      SettingsValidator.validateRound(round, players).map((issue) => ({
        ...issue,
        message: `Round ${index + 1}: ${issue.message}`,
      })),
    );
    const available = new Set(packs.map((pack) => pack.id));
    if (players > settings.maxPlayers)
      issues.push({
        level: "error",
        message: `The lobby has ${players} players but the current maximum is ${settings.maxPlayers}.`,
      });
    if (!settings.rounds.length)
      issues.push({ level: "error", message: "Add at least one round." });
    if (!packs.length)
      issues.push({
        level: "error",
        message: "Select at least one prompt pack.",
      });
    settings.rounds.forEach((round, index) => {
      if (
        round.packIds.length &&
        !round.packIds.some((packId) => available.has(packId))
      ) {
        issues.push({
          level: "error",
          message: `Round ${index + 1} has no available pack.`,
        });
      }
    });
    return issues;
  }
}
