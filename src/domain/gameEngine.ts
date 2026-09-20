import { SettingsValidator } from "./validation";
import type {
  GameRuntime,
  Player,
  PromptPack,
  RoundSettings,
  ReactionId,
  ScoreAward,
} from "./types";
export class GameEngine {
  static responderCount(round: RoundSettings, count: number) {
    return round.respondersPerPrompt === "all"
      ? count
      : round.respondersPerPrompt;
  }
  static createRound(
    round: RoundSettings,
    players: Player[],
    packs: PromptPack[],
    previousScores: Record<string, number> = {},
    previousReactionTotals: GameRuntime["reactionTotals"] = {},
  ): GameRuntime {
    const active = players.filter((p) => !p.spectator);
    const responders = this.responderCount(round, active.length);
    const per =
      round.promptsPerPlayer === "auto"
        ? SettingsValidator.autoPromptsPerPlayer(active.length, responders)
        : round.promptsPerPlayer;
    const count =
      round.respondersPerPrompt === "all"
        ? 1
        : Math.max(1, Math.floor((active.length * per) / responders));
    const pool = packs
      .filter((p) => !round.packIds.length || round.packIds.includes(p.id))
      .flatMap((p) => p.prompts);
    const prompts = this.shuffle(pool);
    const ids = this.shuffle(active.map((p) => p.id));
    const assignments = Array.from({ length: count }, (_, index) => ({
      id: crypto.randomUUID(),
      prompt: prompts[index % prompts.length] ?? {
        id: "fallback",
        text: "Write the funniest answer you can.",
        safetyQuips: ["A wizard did it."],
      },
      playerIds: Array.from(
        { length: responders },
        (_, offset) => ids[(index * responders + offset) % ids.length],
      ),
      answers: {},
      lockedPlayerIds: [],
      reactions: {},
    }));
    return {
      roundIndex: 0,
      assignments,
      voteIndex: 0,
      votes: {},
      scoredAssignmentIds: [],
      lastAwards: [],
      scores: Object.fromEntries(
        active.map((p) => [p.id, previousScores[p.id] ?? 0]),
      ),
      reactionTotals: Object.fromEntries(
        active.map((p) => [p.id, { ...(previousReactionTotals[p.id] ?? {}) }]),
      ),
    };
  }
  static allLocked(game: GameRuntime) {
    return game.assignments.every((a) =>
      a.playerIds.every((id) => a.lockedPlayerIds.includes(id)),
    );
  }
  static finalizeAnswers(game: GameRuntime) {
    game.assignments.forEach((a) =>
      a.playerIds.forEach((id) => {
        if (!a.answers[id]?.trim()) {
          const options = a.prompt.safetyQuips.filter(Boolean);
          a.answers[id] =
            options[Math.floor(Math.random() * options.length)] ??
            "No comment.";
        }
        if (!a.lockedPlayerIds.includes(id)) a.lockedPlayerIds.push(id);
      }),
    );
  }
  static scoreCurrent(
    game: GameRuntime,
    round: RoundSettings,
    players: Player[],
    reactionPointValues: Partial<Record<ReactionId, number>> = {},
  ): ScoreAward[] {
    const a = game.assignments[game.voteIndex];
    if (game.scoredAssignmentIds.includes(a.id)) return game.lastAwards;
    const playerVotes: Record<string, number> = {},
      spectatorVotes: Record<string, number> = {};
    Object.entries(game.votes).forEach(([voter, answers]) =>
      answers.forEach((answer) => {
        const bucket = players.find((p) => p.id === voter)?.spectator
          ? spectatorVotes
          : playerVotes;
        bucket[answer] = (bucket[answer] ?? 0) + 1;
      }),
    );
    const playerVoteTotal = Object.values(playerVotes).reduce(
        (sum, count) => sum + count,
        0,
      ),
      spectatorVoteTotal = Object.values(spectatorVotes).reduce(
        (sum, count) => sum + count,
        0,
      ),
      totalVotes = playerVoteTotal + spectatorVoteTotal;
    const fixedVotePoints: Record<string, number> = {};
    if (round.scoringMode === "fixed-pool") {
      const pointPool = Math.max(0, Math.round(round.totalVotePoints));
      if (round.combineVotes) {
        const combinedVotes = Object.fromEntries(
          a.playerIds.map((id) => [
            id,
            (playerVotes[id] ?? 0) + (spectatorVotes[id] ?? 0),
          ]),
        );
        Object.assign(
          fixedVotePoints,
          this.allocateVotePool(a.playerIds, combinedVotes, pointPool),
        );
      } else {
        const playerPool =
            playerVoteTotal && spectatorVoteTotal
              ? pointPool -
                Math.round(
                  (pointPool *
                    Math.min(100, Math.max(0, round.spectatorPoolPercentage))) /
                    100,
                )
              : playerVoteTotal
                ? pointPool
                : 0,
          spectatorPool =
            playerVoteTotal && spectatorVoteTotal
              ? pointPool - playerPool
              : spectatorVoteTotal
                ? pointPool
                : 0,
          playerPoints = this.allocateVotePool(
            a.playerIds,
            playerVotes,
            playerPool,
          ),
          spectatorPoints = this.allocateVotePool(
            a.playerIds,
            spectatorVotes,
            spectatorPool,
          );
        a.playerIds.forEach((id) => {
          fixedVotePoints[id] =
            (playerPoints[id] ?? 0) + (spectatorPoints[id] ?? 0);
        });
      }
    }
    const bonusValue = (
      mode: RoundSettings["playerBonusMode"],
      value: number,
    ) =>
      mode === "pool-percentage"
        ? Math.round((Math.max(0, round.totalVotePoints) * value) / 100)
        : value;
    const awards = a.playerIds.map((id) => {
      const pv = playerVotes[id] ?? 0,
        sv = spectatorVotes[id] ?? 0,
        combinedBonus =
          round.combineVotes &&
          totalVotes > 0 &&
          ((pv + sv) / totalVotes) * 100 >= round.playerBonusThreshold;
      const pb =
        combinedBonus ||
        (!round.combineVotes &&
          playerVoteTotal > 0 &&
          (pv / playerVoteTotal) * 100 >= round.playerBonusThreshold)
          ? bonusValue(round.playerBonusMode, round.playerBonusPoints)
          : 0;
      const sb =
        !round.combineVotes &&
        spectatorVoteTotal > 0 &&
        (sv / spectatorVoteTotal) * 100 >= round.spectatorBonusThreshold
          ? bonusValue(round.spectatorBonusMode, round.spectatorBonusPoints)
          : 0;
      const votePoints =
          round.scoringMode === "fixed-pool"
            ? (fixedVotePoints[id] ?? 0)
            : pv * round.pointsPerVote + sv * round.spectatorVotePoints,
        bonusPoints = pb + sb,
        reactionPoints = Object.values(a.reactions)
          .flat()
          .filter((reaction) => reaction.targetPlayerId === id)
          .reduce(
            (sum, reaction) =>
              sum + (reactionPointValues[reaction.reaction] ?? 0),
            0,
          ),
        total = votePoints + bonusPoints + reactionPoints;
      game.scores[id] = (game.scores[id] ?? 0) + total;
      return {
        playerId: id,
        votePoints,
        bonusPoints,
        reactionPoints,
        total,
        playerBonus: pb > 0,
        spectatorBonus: sb > 0,
      };
    });
    game.scoredAssignmentIds.push(a.id);
    game.lastAwards = awards;
    return awards;
  }
  private static allocateVotePool(
    playerIds: string[],
    votes: Record<string, number>,
    pointPool: number,
  ) {
    const totalVotes = playerIds.reduce((sum, id) => sum + (votes[id] ?? 0), 0),
      points = Object.fromEntries(playerIds.map((id) => [id, 0]));
    if (!totalVotes || pointPool <= 0) return points;
    const shares = playerIds.map((id, index) => {
      const exact = (pointPool * (votes[id] ?? 0)) / totalVotes;
      return { id, index, points: Math.floor(exact), remainder: exact % 1 };
    });
    let remaining = pointPool - shares.reduce((sum, share) => sum + share.points, 0);
    [...shares]
      .sort((a, b) => b.remainder - a.remainder || a.index - b.index)
      .forEach((share) => {
        if (remaining > 0 && (votes[share.id] ?? 0) > 0) {
          share.points += 1;
          remaining -= 1;
        }
      });
    shares.forEach((share) => {
      points[share.id] = share.points;
    });
    return points;
  }
  private static shuffle<T>(items: T[]) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
}
