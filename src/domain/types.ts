export const AVATARS = [
  "✦",
  "★",
  "●",
  "◆",
  "■",
  "▲",
  "♥",
  "☀",
  "☾",
  "☁",
  "♬",
  "♠",
  "♣",
  "♦",
  "✿",
  "☂",
  "☃",
  "⌁",
  "◎",
  "◉",
  "⬢",
  "✈",
  "☯",
  "∞",
  "π",
  "λ",
  "?",
  "!",
] as const;
export type Avatar = string;
export const NAME_MAX_LENGTH = 20;
export const ANSWER_MAX_LENGTH = 180;
export const REACTIONS = [
  { id: "brilliant", label: "Brilliant", defaultPoints: 5 },
  { id: "great-move", label: "Great Move", defaultPoints: 5 },
  { id: "best-move", label: "Best Move", defaultPoints: 5 },
  { id: "excellent", label: "Excellent", defaultPoints: 5 },
  { id: "good", label: "Good", defaultPoints: 5 },
  { id: "book", label: "Book", defaultPoints: 5 },
  { id: "inaccuracy", label: "Inaccuracy", defaultPoints: -5 },
  { id: "mistake", label: "Mistake", defaultPoints: -5 },
  { id: "miss", label: "Miss", defaultPoints: -5 },
  { id: "blunder", label: "Blunder", defaultPoints: -5 },
] as const;
export type ReactionId = (typeof REACTIONS)[number]["id"];
export type Reaction = { targetPlayerId: string; reaction: ReactionId };
export type ReactionLimit = number | "unlimited";
export type Prompt = { id: string; text: string; safetyQuips: string[] };
export type PromptPack = {
  schemaVersion: 2;
  id: string;
  name: string;
  description: string;
  author: string;
  tags: string[];
  prompts: Prompt[];
  createdAt: string;
  updatedAt: string;
};
export type GroupingStrategy = "balanced" | "random" | "round-robin";
export type RevealStyle = "all-at-once" | "one-at-a-time";
export type VoteAllocation = "one-per-answer" | "stacked";
export type RoundSettings = {
  id: string;
  name: string;
  pointsPerVote: number;
  playerBonusThreshold: number;
  playerBonusPoints: number;
  spectatorVotePoints: number;
  spectatorBonusThreshold: number;
  spectatorBonusPoints: number;
  combineVotes: boolean;
  votesPerPlayer: number;
  voteAllocation: VoteAllocation;
  maxVotesPerAnswer: number | "unlimited";
  participantsCanVote: boolean;
  endVotingWhenAllVotesIn: boolean;
  packIds: string[];
  respondersPerPrompt: number | "all";
  promptsPerPlayer: number | "auto";
  groupingStrategy: GroupingStrategy;
  answerTimeSeconds: number;
  voteTimeSeconds: number;
  resultsTimeSeconds: number;
  revealStyle: RevealStyle;
  revealTimeSeconds: number;
  showPointAwards: boolean;
};
export type GameSettings = {
  id: string;
  name: string;
  maxPlayers: number;
  allowSpectators: boolean;
  lateJoin: boolean;
  takeoverDisconnectedPlayers: boolean;
  fullRoomFallback: "spectator" | "reject";
  showAuthorsBeforeVoting: boolean;
  revealAuthorsAfterVoting: boolean;
  scoreboardTimeSeconds: number;
  maxReactionsPerPlayer: ReactionLimit;
  maxReactionsPerTarget: ReactionLimit;
  reactionPoints: Record<ReactionId, number>;
  rounds: RoundSettings[];
};
export type Player = {
  id: string;
  name: string;
  avatar: Avatar;
  avatarColor: string;
  connected: boolean;
  spectator: boolean;
  isHost: boolean;
};
export type Assignment = {
  id: string;
  prompt: Prompt;
  playerIds: string[];
  answers: Record<string, string>;
  lockedPlayerIds: string[];
  reactions: Record<string, Reaction[]>;
};
export type GameRuntime = {
  roundIndex: number;
  assignments: Assignment[];
  voteIndex: number;
  votes: Record<string, string[]>;
  scores: Record<string, number>;
  reactionTotals: Record<string, Partial<Record<ReactionId, number>>>;
  scoredAssignmentIds: string[];
  lastAwards: ScoreAward[];
};
export type ScoreAward = {
  playerId: string;
  votePoints: number;
  bonusPoints: number;
  reactionPoints: number;
  total: number;
  playerBonus: boolean;
  spectatorBonus: boolean;
};
export type LobbySnapshot = {
  roomCode: string;
  players: Player[];
  settings: GameSettings;
  selectedPackIds: string[];
  phase:
    | "lobby"
    | "answering"
    | "reveal"
    | "voting"
    | "results"
    | "scoreboard"
    | "finished";
  game?: GameRuntime;
  phaseEndsAt?: number;
  serverTime: number;
};
export type ProfilePayload = {
  name: string;
  avatar: Avatar;
  avatarColor: string;
  spectator: boolean;
};
export type ClientCommand =
  | { type: "JOIN"; payload: ProfilePayload }
  | { type: "UPDATE_PROFILE"; payload: ProfilePayload }
  | { type: "LEAVE" }
  | { type: "SET_ANSWER"; payload: { assignmentId: string; answer: string } }
  | { type: "SET_LOCK"; payload: { assignmentId: string; locked: boolean } }
  | { type: "SUBMIT_VOTE"; payload: { answerPlayerIds: string[] } }
  | {
      type: "REACT";
      payload: {
        assignmentId: string;
        answerPlayerId: string;
        reaction: ReactionId;
      };
    }
  | { type: "REQUEST_SNAPSHOT" };
export type HostEvent =
  | { type: "SNAPSHOT"; payload: LobbySnapshot }
  | { type: "REJECTED"; payload: { reason: string } };
