import { useEffect, useRef, useState } from "react";
import {
  Check,
  Lock,
  SmilePlus,
  Unlock,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  ANSWER_MAX_LENGTH,
  REACTIONS,
  type LobbySnapshot,
  type ReactionId,
} from "../domain/types";
import {
  ClientSession,
  HostSession,
  type ConnectionState,
} from "../network/session";
import { ReactionIcon } from "../resources/ReactionIcon";
function useCountdown(snapshot: LobbySnapshot) {
  const [offset, setOffset] = useState(snapshot.serverTime - Date.now()),
    [now, setNow] = useState(Date.now());
  useEffect(() => {
    setOffset((old) => old * 0.7 + (snapshot.serverTime - Date.now()) * 0.3);
  }, [snapshot.serverTime]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  return snapshot.phaseEndsAt
    ? Math.max(0, Math.ceil((snapshot.phaseEndsAt - (now + offset)) / 1000))
    : null;
}
const ping = (tone = 520) => {
  try {
    const c = new AudioContext(),
      o = c.createOscillator(),
      g = c.createGain();
    o.frequency.value = tone;
    g.gain.setValueAtTime(0.045, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.13);
    o.connect(g).connect(c.destination);
    o.start();
    o.stop(c.currentTime + 0.14);
    window.setTimeout(() => void c.close(), 180);
  } catch {
    /* sound is optional */
  }
};
export function GameView({
  snapshot,
  session,
  isHost,
  onLeave,
}: {
  snapshot: LobbySnapshot;
  session: HostSession | ClientSession;
  isHost: boolean;
  onLeave: () => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({}),
    [selected, setSelected] = useState<string[]>([]),
    [reactionMenuTarget, setReactionMenuTarget] = useState<string | null>(null),
    [connectionState, setConnectionState] =
      useState<ConnectionState>("connecting");
  const game = snapshot.game!,
    me = snapshot.players.find((p) => p.id === session.localPlayerId),
    round = snapshot.settings.rounds[game.roundIndex],
    seconds = useCountdown(snapshot);
  const current = game.assignments[game.voteIndex];
  useEffect(() => {
    const unsubscribe = session.onStatus(setConnectionState);
    return () => {
      unsubscribe();
    };
  }, [session]);
  useEffect(() => {
    setSelected([]);
    setReactionMenuTarget(null);
  }, [game.voteIndex]);
  useEffect(() => {
    if (snapshot.phase !== "reveal" || !current) return;
    const count = Object.keys(current.answers).length,
      timers = Array.from({ length: count }, (_, index) =>
        window.setTimeout(
          () => ping(520 + index * 90),
          round.revealStyle === "one-at-a-time"
            ? index * round.revealTimeSeconds * 1000
            : index * 80,
        ),
      );
    return () => timers.forEach((timer) => clearTimeout(timer));
  }, [snapshot.phase, current?.id, round.revealStyle, round.revealTimeSeconds]);
  const setAnswer = (id: string, value: string) => {
    setDrafts((d) => ({ ...d, [id]: value }));
    isHost
      ? (session as HostSession).setAnswer("host", id, value)
      : (session as ClientSession).setAnswer(id, value);
  };
  const setLock = (id: string, locked: boolean) => {
    ping(locked ? 660 : 400);
    isHost
      ? (session as HostSession).setLock("host", id, locked)
      : (session as ClientSession).setLock(id, locked);
  };
  const vote = () => {
    ping(760);
    isHost
      ? (session as HostSession).submitVote("host", selected)
      : (session as ClientSession).submitVote(selected);
  };
  const react = (answerPlayerId: string, reaction: ReactionId) => {
    ping(900);
    isHost
      ? (session as HostSession).react(
          "host",
          current.id,
          answerPlayerId,
          reaction,
        )
      : (session as ClientSession).react(current.id, answerPlayerId, reaction);
    setReactionMenuTarget(null);
  };
  const ranking = Object.entries(game.scores).sort((a, b) => b[1] - a[1]);
  if (snapshot.phase === "finished")
    return (
      <main className="center-page finish-page">
        <div className="winner-burst" aria-hidden>
          ✦ ★ ✦ ★ ✦
        </div>
        <span className="eyebrow">FINAL SCORES</span>
        <h1>Game over</h1>
        <div className="leaderboard">
          {ranking.map(([id, score], i) => (
            <div className={i === 0 ? "winner" : ""} key={id}>
              <span>{i + 1}</span>
              <div className="leaderboard-player">
                <b>
                  {snapshot.players.find((p) => p.id === id)?.name ?? "Player"}
                </b>
                <ReactionBreakdown totals={game.reactionTotals[id]} />
              </div>
              <strong>{score.toLocaleString()}</strong>
            </div>
          ))}
        </div>
        <button className="button secondary" onClick={onLeave}>
          Back home
        </button>
        {isHost && (
          <button
            className="button primary"
            onClick={() => (session as HostSession).playAgain()}
          >
            Play again
          </button>
        )}
      </main>
    );
  if (snapshot.phase === "scoreboard")
    return (
      <main className="game-page scoreboard-page">
        <GameHeader
          snapshot={snapshot}
          seconds={seconds}
          connectionState={connectionState}
        />
        <section className="play-card scoreboard-card">
          <span className="eyebrow">ROUND {game.roundIndex + 1} COMPLETE</span>
          <h1>Score update</h1>
          <div className="leaderboard">
            {ranking.map(([id, score], index) => (
              <div style={{ animationDelay: `${index * 100}ms` }} key={id}>
                <span>{index + 1}</span>
                <b>
                  {snapshot.players.find((player) => player.id === id)?.name ??
                    "Player"}
                </b>
                <strong>{score.toLocaleString()}</strong>
              </div>
            ))}
          </div>
          <p>Next round starts automatically.</p>
        </section>
      </main>
    );
  const statuses = snapshot.players
    .filter((p) => !p.spectator)
    .map((p) => ({
      p,
      done:
        snapshot.phase === "answering" &&
        game.assignments
          .filter((a) => a.playerIds.includes(p.id))
          .every((a) => a.lockedPlayerIds.includes(p.id)),
    }));
  if (snapshot.phase === "answering") {
    const mine = me
      ? game.assignments.filter((a) => a.playerIds.includes(me.id))
      : [];
    return (
      <main className="game-page">
        <GameHeader
          snapshot={snapshot}
          seconds={seconds}
          connectionState={connectionState}
        />
        <div className="player-progress">
          {statuses.map(({ p, done }) => (
            <span className={done ? "done" : ""} key={p.id}>
              <i style={{ background: p.avatarColor }}>{p.avatar}</i>
              {p.name}
              {done && <Check />}
            </span>
          ))}
        </div>
        <section className="play-card">
          <span className="eyebrow">ROUND {game.roundIndex + 1} · WRITE</span>
          <h1>
            {me?.spectator ? "Players are writing…" : "Write your answers"}
          </h1>
          {!me?.spectator &&
            mine.map((a) => {
              const locked = a.lockedPlayerIds.includes(me?.id ?? ""),
                value = a.answers[me?.id ?? ""] ?? drafts[a.id] ?? "";
              return (
                <div
                  className={`answer-box ${locked ? "is-locked" : ""}`}
                  key={a.id}
                >
                  <h2>{a.prompt.text}</h2>
                  <textarea
                    value={value}
                    disabled={locked}
                    maxLength={ANSWER_MAX_LENGTH}
                    placeholder="Your answer…"
                    onChange={(e) => setAnswer(a.id, e.target.value)}
                  />
                  <div className="answer-tools">
                    <small>
                      {value.length}/{ANSWER_MAX_LENGTH}
                    </small>
                    <button
                      className="text-button"
                      disabled={locked}
                      onClick={() => {
                        const choices = a.prompt.safetyQuips;
                        setAnswer(
                          a.id,
                          choices[Math.floor(Math.random() * choices.length)] ??
                            "No comment.",
                        );
                      }}
                    >
                      Safety quip
                    </button>
                    <button
                      className={`button ${locked ? "secondary" : "primary"}`}
                      onClick={() => setLock(a.id, !locked)}
                    >
                      {locked ? (
                        <>
                          <Unlock />
                          Edit again
                        </>
                      ) : (
                        <>
                          <Lock />
                          Lock it in
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
        </section>
      </main>
    );
  }
  const isReveal = snapshot.phase === "reveal",
    isVoting = snapshot.phase === "voting",
    isResults = snapshot.phase === "results",
    cannotVote = Boolean(
      me && !round.participantsCanVote && current.playerIds.includes(me.id),
    ),
    hasVoted = Boolean(me && game.votes[me.id]),
    myReaction = me ? current.reactions[me.id] : undefined,
    eligibleAnswers = Object.keys(current.answers).filter(
      (id) => id !== me?.id,
    ),
    perAnswerLimit =
      round.voteAllocation === "one-per-answer"
        ? 1
        : round.maxVotesPerAnswer === "unlimited"
          ? round.votesPerPlayer
          : round.maxVotesPerAnswer,
    maxVotes = Math.min(
      round.votesPerPlayer,
      eligibleAnswers.length * perAnswerLimit,
    ),
    counts: Record<string, number> = {},
    awards = Object.fromEntries(
      game.lastAwards.map((award) => [award.playerId, award]),
    );
  Object.values(game.votes)
    .flat()
    .forEach((id) => (counts[id] = (counts[id] ?? 0) + 1));
  const answers = Object.entries(current.answers),
    winningVotes = Math.max(0, ...Object.values(counts));
  return (
    <main
      className={`game-page voting-page matchup-page ${isReveal ? "showing-reveal" : ""} ${isResults ? "showing-results" : ""}`}
    >
      <GameHeader
        snapshot={snapshot}
        seconds={seconds}
        connectionState={connectionState}
      />
      <section className="play-card vote-stage matchup-stage">
        <span className="eyebrow">
          {isReveal
            ? "ANSWERS REVEAL"
            : isVoting
              ? `VOTE ${game.voteIndex + 1}/${game.assignments.length} · PICK ${maxVotes}`
              : "RESULTS"}
        </span>
        <h1>{current.prompt.text}</h1>
        <div className="answer-options matchup-answers">
          {answers.map(([id, answer], index) => {
            const allocated = selected.filter(
                (selectedId) => selectedId === id,
              ).length,
              award = awards[id],
              revealDelay =
                isReveal && round.revealStyle === "one-at-a-time"
                  ? index * round.revealTimeSeconds
                  : 0,
              reactionCounts = REACTIONS.map((reaction) => ({
                ...reaction,
                count: Object.values(current.reactions).filter(
                  (item) =>
                    item.targetPlayerId === id &&
                    item.reaction === reaction.id,
                ).length,
              })).filter((reaction) => reaction.count);
            const removeVote = () => {
              const removeAt = selected.lastIndexOf(id);
              if (removeAt >= 0)
                setSelected(selected.filter((_, i) => i !== removeAt));
            };
            return (
              <article
                className={`${allocated ? "selected" : ""} ${isReveal ? "revealing" : ""} ${isResults ? "has-results" : ""} ${isResults && winningVotes > 0 && (counts[id] ?? 0) === winningVotes ? "result-winner" : ""}`}
                style={{ animationDelay: `${revealDelay}s` }}
                key={id}
                onContextMenu={(event) => {
                  event.preventDefault();
                  if (isVoting && !hasVoted && !cannotVote) removeVote();
                }}
              >
                <button
                  className="answer-choice"
                  disabled={!isVoting || hasVoted || cannotVote || id === me?.id}
                  onClick={() => {
                    if (
                      selected.length < maxVotes &&
                      allocated < perAnswerLimit
                    )
                      setSelected([...selected, id]);
                  }}
                >
                  <span>{answer}</span>
                  {((!isResults && snapshot.settings.showAuthorsBeforeVoting) ||
                    (isResults &&
                      snapshot.settings.revealAuthorsAfterVoting)) && (
                    <b>
                      {snapshot.players.find((player) => player.id === id)
                        ?.name ?? "Player"}
                    </b>
                  )}
                  {isVoting && !hasVoted && !cannotVote && (
                    <small>
                      {allocated
                        ? `${allocated} vote${allocated === 1 ? "" : "s"} · right-click to remove`
                        : "Left-click to add"}
                    </small>
                  )}
                </button>
                {isResults && (
                  <div className="result-metadata">
                    <strong>
                      {counts[id] ?? 0} vote{counts[id] === 1 ? "" : "s"}
                    </strong>
                    {round.showPointAwards && award && (
                      <span
                        className={`point-award ${award.bonusPoints ? "has-bonus" : ""}`}
                      >
                        {award.total >= 0 ? "+" : ""}
                        {award.total.toLocaleString()}
                        {award.bonusPoints > 0 && (
                          <em>
                            ★ BONUS +{award.bonusPoints.toLocaleString()}
                          </em>
                        )}
                      </span>
                    )}
                  </div>
                )}
                {!isReveal && me && id !== me.id && !myReaction && (
                  <>
                    <button
                      className="reaction-trigger"
                      aria-expanded={reactionMenuTarget === id}
                      aria-label={`React to ${answer}`}
                      title="Add reaction"
                      onClick={() =>
                        setReactionMenuTarget((target) =>
                          target === id ? null : id,
                        )
                      }
                    >
                      <SmilePlus />
                    </button>
                    {reactionMenuTarget === id && (
                      <div
                        className="reaction-menu"
                        aria-label={`Choose a reaction for ${answer}`}
                      >
                        {REACTIONS.map((reaction) => (
                          <button
                            title={reaction.label}
                            aria-label={reaction.label}
                            key={reaction.id}
                            onClick={() => react(id, reaction.id)}
                          >
                            <ReactionIcon reaction={reaction.id} />
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
                {!isReveal && reactionCounts.length > 0 && (
                  <div className="reaction-summary">
                    {reactionCounts.map((reaction) => (
                      <span title={reaction.label} key={reaction.id}>
                        <ReactionIcon reaction={reaction.id} />
                        {reaction.count}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
        {isReveal && <p className="wait-message">Voting opens next…</p>}
        {isVoting && cannotVote && (
          <p className="wait-message">
            Your answer is in this matchup. Sit this vote out, but you can still
            add a reaction.
          </p>
        )}
        {isVoting && hasVoted && (
          <p className="wait-message">Vote locked. Waiting for the room…</p>
        )}
        {isVoting && !cannotVote && !hasVoted && (
          <button
            className="button primary big"
            disabled={selected.length !== maxVotes}
            onClick={vote}
          >
            Cast {maxVotes} vote{maxVotes === 1 ? "" : "s"}
          </button>
        )}
        {isResults && (
          <p className="wait-message">Next matchup starts automatically.</p>
        )}
      </section>
    </main>
  );
}
function ReactionBreakdown({
  totals = {},
}: {
  totals?: Partial<Record<ReactionId, number>>;
}) {
  const reactions = REACTIONS.filter((reaction) => totals[reaction.id]);
  return (
    <div className="final-reactions" aria-label="Reactions received">
      {reactions.length ? (
        reactions.map((reaction) => (
          <span title={reaction.label} key={reaction.id}>
            <ReactionIcon reaction={reaction.id} />
            <b>{totals[reaction.id]}</b>
          </span>
        ))
      ) : (
        <small>No reactions</small>
      )}
    </div>
  );
}
function GameHeader({
  snapshot,
  seconds,
  connectionState,
}: {
  snapshot: LobbySnapshot;
  seconds: number | null;
  connectionState: ConnectionState;
}) {
  return (
    <header className="game-header">
      <b>PARTY QUIPS</b>
      <span>{snapshot.settings.rounds[snapshot.game!.roundIndex].name}</span>
      <span className={`game-connection ${connectionState}`}>
        <i />
        {connectionState === "reconnecting"
          ? "REJOINING"
          : connectionState.toUpperCase()}
      </span>
      {seconds !== null && (
        <strong className={seconds <= 10 ? "timer urgent" : "timer"}>
          {seconds}
        </strong>
      )}
      <span>ROOM {snapshot.roomCode}</span>
      <SoundtrackButton phase={snapshot.phase} seconds={seconds} />
    </header>
  );
}

export function SoundtrackButton({
  phase,
  seconds,
}: {
  phase: LobbySnapshot["phase"];
  seconds: number | null;
}) {
  const [playing, setPlaying] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const loop = useRef<number | null>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const playTone = (frequency: number, duration = 0.45, volume = 0.018) => {
    const context = audio.current;
    if (!context) return;
    const oscillator = context.createOscillator(),
      gain = context.createGain();
    oscillator.type = phaseRef.current === "voting" ? "triangle" : "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      context.currentTime + duration,
    );
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
  };
  const stop = () => {
    if (loop.current) clearInterval(loop.current);
    loop.current = null;
    void audio.current?.close();
    audio.current = null;
    setPlaying(false);
  };
  useEffect(() => stop, []);
  useEffect(() => {
    if (playing && seconds !== null && seconds <= 10 && seconds > 0)
      playTone(seconds <= 3 ? 1040 : 820, 0.08, 0.04);
    // A tick should happen once per displayed second.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds, playing]);
  const start = () => {
    const context = new AudioContext();
    audio.current = context;
    let index = 0;
    const play = () => {
      const patterns: Partial<Record<LobbySnapshot["phase"], number[]>> = {
          lobby: [261.6, 329.6, 392, 329.6, 293.7, 349.2, 440, 349.2],
          answering: [220, 277.2, 329.6, 415.3, 329.6, 277.2],
          reveal: [392, 523.3, 659.3, 784],
          voting: [196, 233.1, 293.7, 233.1],
          results: [392, 493.9, 587.3, 784],
          scoreboard: [261.6, 329.6, 392, 523.3],
        },
        notes = patterns[phaseRef.current] ?? [261.6, 329.6, 392];
      playTone(notes[index++ % notes.length]);
    };
    play();
    loop.current = window.setInterval(play, 650);
    setPlaying(true);
  };
  return (
    <button
      className="sound-button"
      aria-label={playing ? "Mute music" : "Play music"}
      onClick={playing ? stop : start}
    >
      {playing ? <Volume2 /> : <VolumeX />}
    </button>
  );
}
