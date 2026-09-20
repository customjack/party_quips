import { describe, expect, it } from "vitest";
import { createRound, defaultGameTemplate, starterPack } from "./defaults";
import { SettingsValidator } from "./validation";
import { GameEngine } from "./gameEngine";
import type { GameRuntime, LobbySnapshot } from "./types";
import { HostSession } from "../network/session";

describe("SettingsValidator", () => {
  it("loads built-ins from export-compatible resources", () => {
    expect(defaultGameTemplate.id).toBe("default-game");
    expect(defaultGameTemplate.rounds[0].playerBonusThreshold).toBe(100);
    expect(defaultGameTemplate.rounds[0].scoringMode).toBe("fixed-pool");
    expect(defaultGameTemplate.rounds[0].totalVotePoints).toBe(1000);
    expect(defaultGameTemplate.reactionPoints.brilliant).toBe(5);
    expect(defaultGameTemplate.reactionPoints.blunder).toBe(-5);
    expect(defaultGameTemplate.maxReactionsPerPlayer).toBe("unlimited");
    expect(defaultGameTemplate.maxReactionsPerTarget).toBe(1);
    expect(defaultGameTemplate.revealVotersAfterVoting).toBe(true);
    expect(
      defaultGameTemplate.rounds.every(
        (round) => round.endVotingWhenAllVotesIn,
      ),
    ).toBe(true);
    expect(starterPack.schemaVersion).toBe(2);
    expect(
      starterPack.prompts.every((prompt) => prompt.safetyQuips.length > 0),
    ).toBe(true);
  });

  it("hides voter identities until results and respects voter privacy", () => {
    const players = ["a", "b", "c"].map((id) => ({
        id,
        name: id.toUpperCase(),
        avatar: "✦",
        avatarColor: "#ffc83d",
        connected: true,
        spectator: false,
        isHost: id === "a",
      })),
      state: LobbySnapshot = {
        roomCode: "ABC123",
        players,
        settings: structuredClone(defaultGameTemplate),
        selectedPackIds: [starterPack.id],
        phase: "voting",
        serverTime: 0,
        game: {
          roundIndex: 0,
          voteIndex: 0,
          votes: { a: ["b"], c: ["b", "b"] },
          scores: { a: 0, b: 0, c: 0 },
          reactionTotals: { a: {}, b: {}, c: {} },
          scoredAssignmentIds: [],
          lastAwards: [],
          assignments: [
            {
              id: "matchup",
              prompt: { id: "prompt", text: "Prompt", safetyQuips: [] },
              playerIds: ["a", "b"],
              answers: { a: "A", b: "B" },
              lockedPlayerIds: ["a", "b"],
              reactions: {},
            },
          ],
        },
      },
      session = Object.create(HostSession.prototype) as {
        state: LobbySnapshot;
      },
      viewFor = (
        HostSession.prototype as unknown as {
          viewFor(playerId: string): LobbySnapshot;
        }
      ).viewFor;
    session.state = state;
    expect(viewFor.call(session, "a").game?.votes).toEqual({ a: ["b"] });

    state.phase = "results";
    expect(viewFor.call(session, "a").game?.votes).toEqual(state.game?.votes);

    state.settings.revealVotersAfterVoting = false;
    const privateVotes = viewFor.call(session, "a").game?.votes ?? {};
    expect(Object.keys(privateVotes).every((id) => id.startsWith("anonymous-")))
      .toBe(true);
    expect(Object.values(privateVotes).flat()).toHaveLength(3);
  });
  it("warns when assignments cannot be divided evenly", () => {
    const round = {
      ...createRound(),
      respondersPerPrompt: 2,
      promptsPerPlayer: 1 as const,
    };
    expect(
      SettingsValidator.validateRound(round, 5).some(
        (issue) => issue.level === "warning",
      ),
    ).toBe(true);
  });

  it("accepts an equal-opportunity configuration", () => {
    const round = {
      ...createRound(),
      respondersPerPrompt: 2,
      promptsPerPlayer: 2 as const,
    };
    expect(
      SettingsValidator.validateRound(round, 5).filter((issue) =>
        issue.message.includes("split evenly"),
      ),
    ).toHaveLength(0);
  });

  it("finds a nearby fair prompt count", () => {
    expect(SettingsValidator.nearestFairPromptCount(5, 2, 1)).toBe(2);
  });

  it("explains when a responder ballot will be cropped", () => {
    const round = {
      ...createRound(),
      respondersPerPrompt: 2,
      participantsCanVote: true,
      votesPerPlayer: 3,
      voteAllocation: "one-per-answer" as const,
    };
    expect(
      SettingsValidator.validateRound(round, 4).some((issue) =>
        issue.message.includes("cropped automatically"),
      ),
    ).toBe(true);
  });

  it("fills blank timed-out answers from prompt safety quips", () => {
    const game: GameRuntime = {
      roundIndex: 0,
      voteIndex: 0,
      votes: {},
      scores: { a: 0 },
      reactionTotals: { a: {} },
      scoredAssignmentIds: [],
      lastAwards: [],
      assignments: [
        {
          id: "a1",
          prompt: { id: "p1", text: "Prompt", safetyQuips: ["Fallback"] },
          playerIds: ["a"],
          answers: {},
          lockedPlayerIds: [],
          reactions: {},
        },
      ],
    };
    GameEngine.finalizeAnswers(game);
    expect(game.assignments[0].answers.a).toBe("Fallback");
    expect(game.assignments[0].lockedPlayerIds).toContain("a");
  });

  it("supports an all-player round", () => {
    const players = ["a", "b", "c", "d"].map((id) => ({
      id,
      name: id,
      avatar: "✦",
      avatarColor: "#ffffff",
      connected: true,
      spectator: false,
      isHost: false,
    }));
    const pack = {
      schemaVersion: 2 as const,
      id: "pack",
      name: "Pack",
      description: "",
      author: "",
      tags: [],
      prompts: [{ id: "p", text: "Prompt", safetyQuips: [] }],
      createdAt: "",
      updatedAt: "",
    };
    const game = GameEngine.createRound(
      { ...createRound(), respondersPerPrompt: "all" },
      players,
      [pack],
    );
    expect(game.assignments).toHaveLength(1);
    expect(game.assignments[0].playerIds).toHaveLength(4);
  });

  it("applies player and spectator vote points independently", () => {
    const round = {
      ...createRound(),
      scoringMode: "per-vote" as const,
      playerBonusThreshold: 101,
      spectatorBonusThreshold: 101,
    };
    const game = {
      roundIndex: 0,
      voteIndex: 0,
      scores: { a: 0, b: 0 },
      reactionTotals: { a: {}, b: {} },
      votes: { c: ["a"], s: ["a"] },
      scoredAssignmentIds: [],
      lastAwards: [],
      assignments: [
        {
          id: "q",
          prompt: { id: "p", text: "q", safetyQuips: [] },
          playerIds: ["a", "b"],
          answers: { a: "A", b: "B" },
          lockedPlayerIds: ["a", "b"],
          reactions: {
            c: [{ targetPlayerId: "a", reaction: "brilliant" as const }],
          },
        },
      ],
    };
    const players = [
      {
        id: "a",
        name: "A",
        avatar: "✦",
        avatarColor: "#ffffff",
        connected: true,
        spectator: false,
        isHost: false,
      },
      {
        id: "b",
        name: "B",
        avatar: "★",
        avatarColor: "#ffffff",
        connected: true,
        spectator: false,
        isHost: false,
      },
      {
        id: "c",
        name: "C",
        avatar: "●",
        avatarColor: "#ffffff",
        connected: true,
        spectator: false,
        isHost: false,
      },
      {
        id: "s",
        name: "S",
        avatar: "◆",
        avatarColor: "#ffffff",
        connected: true,
        spectator: true,
        isHost: false,
      },
    ];
    const awards = GameEngine.scoreCurrent(game, round, players, {
      brilliant: 5,
    });
    expect(game.scores.a).toBe(
      round.pointsPerVote + round.spectatorVotePoints + 5,
    );
    expect(awards.find((award) => award.playerId === "a")?.total).toBe(
      round.pointsPerVote + round.spectatorVotePoints + 5,
    );
    GameEngine.scoreCurrent(game, round, players);
    expect(game.scores.a).toBe(
      round.pointsPerVote + round.spectatorVotePoints + 5,
    );
  });

  it("splits a fixed point pool between player and spectator ballots", () => {
    const round = {
        ...createRound(),
        scoringMode: "fixed-pool" as const,
        totalVotePoints: 1000,
        spectatorPoolPercentage: 20,
        playerBonusThreshold: 101,
        spectatorBonusThreshold: 101,
      },
      game: GameRuntime = {
        roundIndex: 0,
        voteIndex: 0,
        scores: { a: 0, b: 0 },
        reactionTotals: { a: {}, b: {} },
        votes: { c: ["a"], d: ["b"], s1: ["a"], s2: ["a"] },
        scoredAssignmentIds: [],
        lastAwards: [],
        assignments: [
          {
            id: "fixed-pool",
            prompt: { id: "p", text: "q", safetyQuips: [] },
            playerIds: ["a", "b"],
            answers: { a: "A", b: "B" },
            lockedPlayerIds: ["a", "b"],
            reactions: {},
          },
        ],
      },
      players = [
        ...["a", "b", "c", "d"].map((id) => ({
          id,
          name: id,
          avatar: "✦",
          avatarColor: "#fff",
          connected: true,
          spectator: false,
          isHost: false,
        })),
        ...["s1", "s2"].map((id) => ({
          id,
          name: id,
          avatar: "★",
          avatarColor: "#fff",
          connected: true,
          spectator: true,
          isHost: false,
        })),
      ];
    const awards = GameEngine.scoreCurrent(game, round, players);
    expect(awards.find((award) => award.playerId === "a")?.votePoints).toBe(
      600,
    );
    expect(awards.find((award) => award.playerId === "b")?.votePoints).toBe(
      400,
    );
    expect(awards.reduce((sum, award) => sum + award.votePoints, 0)).toBe(
      1000,
    );
  });

  it("uses the full fixed pool when only one voter group casts ballots", () => {
    const round = {
        ...createRound(),
        scoringMode: "fixed-pool" as const,
        totalVotePoints: 999,
        playerBonusThreshold: 101,
        spectatorBonusThreshold: 101,
      },
      game: GameRuntime = {
        roundIndex: 0,
        voteIndex: 0,
        scores: { a: 0, b: 0 },
        reactionTotals: { a: {}, b: {} },
        votes: { c: ["a"], d: ["b"] },
        scoredAssignmentIds: [],
        lastAwards: [],
        assignments: [
          {
            id: "player-only-pool",
            prompt: { id: "p", text: "q", safetyQuips: [] },
            playerIds: ["a", "b"],
            answers: { a: "A", b: "B" },
            lockedPlayerIds: ["a", "b"],
            reactions: {},
          },
        ],
      },
      players = ["a", "b", "c", "d"].map((id) => ({
        id,
        name: id,
        avatar: "✦",
        avatarColor: "#fff",
        connected: true,
        spectator: false,
        isHost: false,
      }));
    const awards = GameEngine.scoreCurrent(game, round, players);
    expect(awards.reduce((sum, award) => sum + award.votePoints, 0)).toBe(999);
  });

  it("calculates percentage bonuses from the configured pool", () => {
    const round = {
        ...createRound(),
        scoringMode: "fixed-pool" as const,
        totalVotePoints: 1000,
        playerBonusThreshold: 100,
        playerBonusMode: "pool-percentage" as const,
        playerBonusPoints: 25,
        spectatorBonusThreshold: 101,
      },
      game: GameRuntime = {
        roundIndex: 0,
        voteIndex: 0,
        scores: { a: 0, b: 0 },
        reactionTotals: { a: {}, b: {} },
        votes: { c: ["a"], d: ["a"] },
        scoredAssignmentIds: [],
        lastAwards: [],
        assignments: [
          {
            id: "percentage-bonus",
            prompt: { id: "p", text: "q", safetyQuips: [] },
            playerIds: ["a", "b"],
            answers: { a: "A", b: "B" },
            lockedPlayerIds: ["a", "b"],
            reactions: {},
          },
        ],
      },
      players = ["a", "b", "c", "d"].map((id) => ({
        id,
        name: id,
        avatar: "✦",
        avatarColor: "#fff",
        connected: true,
        spectator: false,
        isHost: false,
      }));
    const winner = GameEngine.scoreCurrent(game, round, players).find(
      (award) => award.playerId === "a",
    );
    expect(winner?.votePoints).toBe(1000);
    expect(winner?.bonusPoints).toBe(250);
    expect(winner?.total).toBe(1250);
  });

  it("does not leave the matchup index past the final assignment", () => {
    const session = Object.create(HostSession.prototype) as {
      state: Record<string, unknown>;
      broadcast: () => void;
    };
    session.state = {
      roomCode: "TEST",
      players: [],
      settings: { ...defaultGameTemplate, rounds: [createRound()] },
      selectedPackIds: [],
      phase: "results",
      serverTime: Date.now(),
      game: {
        roundIndex: 0,
        voteIndex: 0,
        votes: {},
        scores: {},
        reactionTotals: {},
        scoredAssignmentIds: [],
        lastAwards: [],
        assignments: [
          {
            id: "last-matchup",
            prompt: { id: "p", text: "Prompt", safetyQuips: [] },
            playerIds: [],
            answers: {},
            lockedPlayerIds: [],
            reactions: {},
          },
        ],
      },
    };
    session.broadcast = () => undefined;

    HostSession.prototype.advance.call(session as unknown as HostSession);

    expect((session.state as { phase: string }).phase).toBe("finished");
    expect(
      (session.state as { game: { voteIndex: number } }).game.voteIndex,
    ).toBe(0);
  });

  it("keeps voting open after all ballots when configured to use the timer", () => {
    const round = {
        ...createRound(),
        endVotingWhenAllVotesIn: false,
        participantsCanVote: false,
      },
      players = [
        {
          id: "a",
          name: "A",
          avatar: "✦",
          avatarColor: "#fff",
          connected: true,
          spectator: false,
          isHost: false,
        },
        {
          id: "b",
          name: "B",
          avatar: "★",
          avatarColor: "#fff",
          connected: true,
          spectator: false,
          isHost: false,
        },
        {
          id: "c",
          name: "C",
          avatar: "●",
          avatarColor: "#fff",
          connected: true,
          spectator: false,
          isHost: false,
        },
      ],
      session = Object.create(HostSession.prototype) as {
        state: Record<string, unknown>;
        broadcast: () => void;
      };
    session.state = {
      roomCode: "TEST",
      players,
      settings: { ...defaultGameTemplate, rounds: [round] },
      selectedPackIds: [],
      phase: "voting",
      serverTime: Date.now(),
      game: {
        roundIndex: 0,
        voteIndex: 0,
        votes: {},
        scores: { a: 0, b: 0, c: 0 },
        reactionTotals: { a: {}, b: {}, c: {} },
        scoredAssignmentIds: [],
        lastAwards: [],
        assignments: [
          {
            id: "matchup",
            prompt: { id: "p", text: "Prompt", safetyQuips: [] },
            playerIds: ["a", "b"],
            answers: { a: "A", b: "B" },
            lockedPlayerIds: ["a", "b"],
            reactions: {},
          },
        ],
      },
    };
    session.broadcast = () => undefined;

    HostSession.prototype.submitVote.call(
      session as unknown as HostSession,
      "c",
      ["a"],
    );

    expect((session.state as { phase: string }).phase).toBe("voting");
  });

  it("stores typing without broadcasting a full snapshot per keystroke", () => {
    let broadcasts = 0;
    const session = Object.create(HostSession.prototype) as {
      state: Record<string, unknown>;
      broadcast: () => void;
    };
    session.state = {
      phase: "answering",
      game: {
        assignments: [
          {
            id: "prompt",
            playerIds: ["a"],
            answers: {},
            lockedPlayerIds: [],
          },
        ],
      },
    };
    session.broadcast = () => {
      broadcasts += 1;
    };
    HostSession.prototype.setAnswer.call(
      session as unknown as HostSession,
      "a",
      "prompt",
      "instant local typing",
    );
    expect(
      (
        session.state as {
          game: { assignments: Array<{ answers: Record<string, string> }> };
        }
      ).game.assignments[0].answers.a,
    ).toBe("instant local typing");
    expect(broadcasts).toBe(0);
  });

  it("allows reactions across quips while enforcing the per-quip limit", () => {
    const session = Object.create(HostSession.prototype) as {
      state: Record<string, unknown>;
      broadcast: () => void;
    };
    session.state = {
      players: [{ id: "a" }, { id: "b" }, { id: "c" }],
      settings: defaultGameTemplate,
      phase: "voting",
      game: {
        roundIndex: 0,
        voteIndex: 0,
        votes: {},
        scores: { a: 0, b: 0, c: 0 },
        reactionTotals: { a: {}, b: {}, c: {} },
        scoredAssignmentIds: [],
        lastAwards: [],
        assignments: [
          {
            id: "matchup",
            playerIds: ["a", "b"],
            answers: { a: "A", b: "B" },
            lockedPlayerIds: ["a", "b"],
            reactions: {},
          },
        ],
      },
    };
    session.broadcast = () => undefined;
    const react = HostSession.prototype.react;
    react.call(session as unknown as HostSession, "c", "matchup", "a", "good");
    react.call(session as unknown as HostSession, "c", "matchup", "a", "book");
    react.call(
      session as unknown as HostSession,
      "c",
      "matchup",
      "b",
      "brilliant",
    );
    const state = session.state as {
      game: { assignments: Array<{ reactions: Record<string, unknown[]> }> };
    };
    expect(state.game.assignments[0].reactions.c).toHaveLength(2);
  });
});
