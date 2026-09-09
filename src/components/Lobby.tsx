import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  Copy,
  Crown,
  Eye,
  Settings2,
  Users,
  X,
} from "lucide-react";
import {
  AVATARS,
  NAME_MAX_LENGTH,
  type Avatar,
  type GameSettings,
  type LobbySnapshot,
  type PromptPack,
  type RoundSettings,
} from "../domain/types";
import { SettingsValidator } from "../domain/validation";
import {
  ClientSession,
  HostSession,
  type ConnectionState,
} from "../network/session";
import type { TemplateRepository } from "../services/storage";
import { Avatar as PlayerAvatar } from "./Avatar";
import { GameView, SoundtrackButton } from "./GameView";
import { createRound, createSpecialRound } from "../domain/defaults";
import { RulesEditor } from "./RulesEditor";
const Toggle = ({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) => (
  <label className="toggle-row">
    <span>
      <b>{label}</b>
    </span>
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
    />
  </label>
);
export function Lobby({
  session,
  isHost,
  packs,
  templatesRepo,
  onLeave,
}: {
  session: HostSession | ClientSession;
  isHost: boolean;
  packs: PromptPack[];
  templatesRepo: TemplateRepository;
  onLeave: () => void;
}) {
  const [snapshot, setSnapshot] = useState<LobbySnapshot | null>(
      isHost ? (session as HostSession).snapshot : null,
    ),
    [error, setError] = useState(""),
    [copied, setCopied] = useState(false),
    [editing, setEditing] = useState(false),
    [connectionState, setConnectionState] =
      useState<ConnectionState>("connecting");
  useEffect(() => {
    const a = session.onSnapshot(setSnapshot),
      b = session.onError(setError),
      c = session.onStatus(setConnectionState);
    return () => {
      a();
      b();
      c();
    };
  }, [session]);
  const players = snapshot?.players.filter((p) => !p.spectator) ?? [],
    spectators = snapshot?.players.filter((p) => p.spectator) ?? [],
    me = snapshot?.players.find((p) => p.id === session.localPlayerId);
  const issues = useMemo(
    () =>
      snapshot && isHost
        ? SettingsValidator.validateGame(
            snapshot.settings,
            players.length,
            packs.filter((p) => snapshot.selectedPackIds.includes(p.id)),
          )
        : [],
    [snapshot, players.length, packs, isHost],
  );
  if (error)
    return (
      <main className="center-page">
        <div className="join-card panel">
          <h1>Connection problem</h1>
          <p>{error}</p>
          <button className="button primary" onClick={onLeave}>
            Back home
          </button>
        </div>
      </main>
    );
  if (!snapshot)
    return (
      <main className="center-page">
        <div className="spinner" />
        Connecting…
      </main>
    );
  if (snapshot.phase !== "lobby")
    return (
      <GameView
        snapshot={snapshot}
        session={session}
        isHost={isHost}
        onLeave={onLeave}
      />
    );
  const update = (
    settings: GameSettings,
    selected = snapshot.selectedPackIds,
  ) => (session as HostSession).updateSettings(settings, selected);
  const profile = (changes: Partial<NonNullable<typeof me>>) => {
    if (!me) return;
    const p = {
      name: me.name,
      avatar: me.avatar,
      avatarColor: me.avatarColor,
      spectator: me.spectator,
      ...changes,
    };
    isHost
      ? (session as HostSession).updateHost(p)
      : (session as ClientSession).updateProfile(p);
  };
  return (
    <main className="page shell lobby-page">
      <header className="topbar">
        <button className="icon-button" onClick={onLeave}>
          <ArrowLeft />
        </button>
        <a className="brand">PARTY QUIPS</a>
        <span className={`connection ${connectionState}`}>
          <i />
          {connectionState.toUpperCase()}
        </span>
        <SoundtrackButton phase="lobby" seconds={null} />
      </header>
      <section className="room-hero">
        <div>
          <span className="eyebrow">ROOM CODE</span>
          <button
            className="room-code"
            onClick={() => {
              void navigator.clipboard.writeText(snapshot.roomCode);
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            }}
          >
            {snapshot.roomCode}
            {copied ? <Check /> : <Copy />}
          </button>
        </div>
        <div className="room-stats">
          <div>
            <Users />
            <span>
              <b>
                {players.length}/{snapshot.settings.maxPlayers}
              </b>{" "}
              players
            </span>
          </div>
          <div>
            <Eye />
            <span>
              <b>{spectators.length}</b> spectators
            </span>
          </div>
        </div>
      </section>
      <div className="lobby-grid">
        <section>
          <div className="section-heading">
            <div>
              <span className="eyebrow">LOBBY</span>
              <h2>Players</h2>
            </div>
          </div>
          <div className="player-grid">
            {players.map((p) => (
              <article
                className={`player-card ${p.connected ? "" : "offline"}`}
                key={p.id}
              >
                <PlayerAvatar name={p.avatar} color={p.avatarColor} />
                <div>
                  <b>{p.name}</b>
                  <span>
                    {!p.connected ? (
                      "Reconnecting…"
                    ) : p.isHost ? (
                      <>
                        <Crown />
                        Host
                      </>
                    ) : (
                      "Player"
                    )}
                  </span>
                </div>
              </article>
            ))}
            {Array.from(
              {
                length: Math.min(
                  4,
                  Math.max(0, snapshot.settings.maxPlayers - players.length),
                ),
              },
              (_, i) => (
                <article className="player-card empty" key={i}>
                  <div className="avatar">+</div>
                  <div>
                    <b>Open seat</b>
                  </div>
                </article>
              ),
            )}
          </div>
          {spectators.length > 0 && (
            <div className="spectator-list">
              {spectators.map((p) => (
                <span key={p.id}>
                  {p.avatar} {p.name}
                </span>
              ))}
            </div>
          )}
        </section>
        <aside className="lobby-sidebar">
          <section className="panel game-summary">
            <div className="panel-title">
              <div>
                <span className="eyebrow">GAME SETTINGS</span>
                <h2>{snapshot.settings.name}</h2>
              </div>
              {isHost && (
                <button
                  className="icon-button small"
                  onClick={() => setEditing(true)}
                >
                  <Settings2 />
                </button>
              )}
            </div>
            <dl>
              <div>
                <dt>Rounds</dt>
                <dd>{snapshot.settings.rounds.length}</dd>
              </div>
              <div>
                <dt>Packs</dt>
                <dd>{snapshot.selectedPackIds.length}</dd>
              </div>
            </dl>
          </section>
          {issues.length > 0 && (
            <section className="panel lobby-issues">
              {issues.map((x, i) => (
                <p key={i}>{x.message}</p>
              ))}
            </section>
          )}
          {me && (
            <section className="panel profile-panel">
              <span className="eyebrow">YOUR PROFILE</span>
              <input
                maxLength={NAME_MAX_LENGTH}
                value={me.name}
                onChange={(e) => profile({ name: e.target.value })}
              />
              <div className="mini-avatar-picker">
                {AVATARS.map((a) => (
                  <button
                    className="avatar"
                    style={{ backgroundColor: me.avatarColor }}
                    key={a}
                    onClick={() => profile({ avatar: a })}
                  >
                    {a}
                  </button>
                ))}
              </div>
              <label className="color-field">
                Icon color{" "}
                <input
                  type="color"
                  value={me.avatarColor}
                  onChange={(e) => profile({ avatarColor: e.target.value })}
                />
              </label>
              {!isHost && snapshot.settings.allowSpectators && (
                <button
                  className="text-button"
                  onClick={() => profile({ spectator: !me.spectator })}
                >
                  {me.spectator ? "Join as player" : "Switch to spectator"}
                </button>
              )}
            </section>
          )}
          {isHost ? (
            <button
              className="button primary start-button"
              disabled={
                players.length < 2 || issues.some((x) => x.level === "error")
              }
              onClick={() => (session as HostSession).start()}
            >
              {players.length < 2 ? "Waiting for players…" : "Start game"} →
            </button>
          ) : (
            <div className="ready-card">Waiting for the host…</div>
          )}
        </aside>
      </div>
      {editing && (
        <div className="modal-backdrop rules-modal">
          <section className="panel lobby-settings shared-rules-modal">
            <button
              className="modal-close icon-button"
              onClick={() => setEditing(false)}
            >
              <X />
            </button>
            <RulesEditor
              settings={snapshot.settings}
              selected={snapshot.selectedPackIds}
              packs={packs}
              templatesRepo={templatesRepo}
              onSettings={(settings) => update(settings)}
              onSelected={(ids) => update(snapshot.settings, ids)}
            />
          </section>
        </div>
      )}
    </main>
  );
}
function LobbySettings({
  snapshot,
  packs,
  templates,
  onUpdate,
  onClose,
}: {
  snapshot: LobbySnapshot;
  packs: PromptPack[];
  templates: TemplateRepository;
  onUpdate: (s: GameSettings, p?: string[]) => void;
  onClose: () => void;
}) {
  const s = snapshot.settings,
    set = <K extends keyof GameSettings>(k: K, v: GameSettings[K]) =>
      onUpdate({ ...s, [k]: v });
  const round = (i: number, changes: Partial<RoundSettings>) =>
    set(
      "rounds",
      s.rounds.map((r, j) => (j === i ? { ...r, ...changes } : r)),
    );
  return (
    <div className="modal-backdrop">
      <section className="panel lobby-settings">
        <div className="panel-title">
          <div>
            <span className="eyebrow">EDIT UNTIL START</span>
            <h2>Game settings</h2>
          </div>
          <button className="icon-button" onClick={onClose}>
            <X />
          </button>
        </div>
        <label className="field">
          <span>Load saved settings</span>
          <select
            onChange={(e) => {
              const t = templates.all().find((x) => x.id === e.target.value);
              if (t) onUpdate(structuredClone(t));
            }}
          >
            <option>Current settings</option>
            {templates.all().map((t) => (
              <option value={t.id} key={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <button className="text-button" onClick={() => templates.save(s)}>
          Save current settings
        </button>
        <div className="settings-grid">
          <label className="mini-field">
            <span>Maximum players</span>
            <input
              type="number"
              min="2"
              value={s.maxPlayers}
              onChange={(e) =>
                set("maxPlayers", Math.max(2, Number(e.target.value)))
              }
            />
          </label>
          <label className="mini-field">
            <span>Scoreboard seconds</span>
            <input
              type="number"
              min="2"
              value={s.scoreboardTimeSeconds}
              onChange={(e) =>
                set("scoreboardTimeSeconds", Number(e.target.value))
              }
            />
          </label>
        </div>
        <div className="toggles">
          <Toggle
            label="Allow spectators"
            checked={s.allowSpectators}
            onChange={(v) => set("allowSpectators", v)}
          />
          <Toggle
            label="Allow late join"
            checked={s.lateJoin}
            onChange={(v) => set("lateJoin", v)}
          />
          <Toggle
            label="Show authors before voting"
            checked={s.showAuthorsBeforeVoting}
            onChange={(v) => set("showAuthorsBeforeVoting", v)}
          />
          <Toggle
            label="Reveal authors after voting"
            checked={s.revealAuthorsAfterVoting}
            onChange={(v) => set("revealAuthorsAfterVoting", v)}
          />
        </div>
        <h3>Prompt packs</h3>
        <div className="check-grid">
          {packs.map((p) => (
            <label className="check-card" key={p.id}>
              <input
                type="checkbox"
                checked={snapshot.selectedPackIds.includes(p.id)}
                onChange={() =>
                  onUpdate(
                    s,
                    snapshot.selectedPackIds.includes(p.id)
                      ? snapshot.selectedPackIds.filter((id) => id !== p.id)
                      : [...snapshot.selectedPackIds, p.id],
                  )
                }
              />
              {p.name}
            </label>
          ))}
        </div>
        <div className="panel-title round-manager-title">
          <h3>Rounds</h3>
          <div className="button-row">
            <button
              className="button secondary compact"
              onClick={() =>
                set("rounds", [
                  ...s.rounds,
                  createRound(`Round ${s.rounds.length + 1}`),
                ])
              }
            >
              + Standard
            </button>
            <button
              className="button secondary compact"
              onClick={() => set("rounds", [...s.rounds, createSpecialRound()])}
            >
              + All-play
            </button>
          </div>
        </div>
        {s.rounds.map((r, i) => (
          <details className="compact-round" key={r.id}>
            <summary>
              {i + 1}. {r.name}
            </summary>
            <button
              className="text-button danger"
              onClick={() =>
                set(
                  "rounds",
                  s.rounds.filter((_, index) => index !== i),
                )
              }
            >
              Remove round
            </button>
            <div className="settings-grid">
              <label className="mini-field">
                <span>Responders</span>
                <select
                  value={r.respondersPerPrompt}
                  onChange={(e) =>
                    round(i, {
                      respondersPerPrompt:
                        e.target.value === "all"
                          ? "all"
                          : Number(e.target.value),
                    })
                  }
                >
                  <option value="all">All players</option>
                  {[2, 3, 4, 5, 6, 8, 10].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
              <label className="mini-field">
                <span>Votes/player</span>
                <input
                  type="number"
                  min="1"
                  value={r.votesPerPlayer}
                  onChange={(e) =>
                    round(i, { votesPerPlayer: Number(e.target.value) })
                  }
                />
              </label>
              <label className="mini-field">
                <span>Answer seconds</span>
                <input
                  type="number"
                  min="10"
                  value={r.answerTimeSeconds}
                  onChange={(e) =>
                    round(i, { answerTimeSeconds: Number(e.target.value) })
                  }
                />
              </label>
              <label className="mini-field">
                <span>Vote seconds</span>
                <input
                  type="number"
                  min="5"
                  value={r.voteTimeSeconds}
                  onChange={(e) =>
                    round(i, { voteTimeSeconds: Number(e.target.value) })
                  }
                />
              </label>
              <label className="mini-field">
                <span>Results seconds</span>
                <input
                  type="number"
                  min="2"
                  value={r.resultsTimeSeconds}
                  onChange={(e) =>
                    round(i, { resultsTimeSeconds: Number(e.target.value) })
                  }
                />
              </label>
              <label className="mini-field">
                <span>Points per vote</span>
                <input
                  type="number"
                  min="0"
                  value={r.pointsPerVote}
                  onChange={(e) =>
                    round(i, { pointsPerVote: Number(e.target.value) })
                  }
                />
              </label>
              <label className="mini-field">
                <span>Prompts per player</span>
                <select
                  value={r.promptsPerPlayer}
                  onChange={(e) =>
                    round(i, {
                      promptsPerPlayer:
                        e.target.value === "auto"
                          ? "auto"
                          : Number(e.target.value),
                    })
                  }
                >
                  <option value="auto">Auto</option>
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
              <label className="mini-field">
                <span>Grouping</span>
                <select
                  value={r.groupingStrategy}
                  onChange={(e) =>
                    round(i, {
                      groupingStrategy: e.target
                        .value as RoundSettings["groupingStrategy"],
                    })
                  }
                >
                  <option value="balanced">Balanced</option>
                  <option value="round-robin">Round robin</option>
                  <option value="random">Random</option>
                </select>
              </label>
              <label className="mini-field">
                <span>Player bonus at %</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={r.playerBonusThreshold}
                  onChange={(e) =>
                    round(i, { playerBonusThreshold: Number(e.target.value) })
                  }
                />
              </label>
              <label className="mini-field">
                <span>Player bonus points</span>
                <input
                  type="number"
                  min="0"
                  value={r.playerBonusPoints}
                  onChange={(e) =>
                    round(i, { playerBonusPoints: Number(e.target.value) })
                  }
                />
              </label>
              <label className="mini-field">
                <span>Spectator vote points</span>
                <input
                  type="number"
                  min="0"
                  value={r.spectatorVotePoints}
                  onChange={(e) =>
                    round(i, { spectatorVotePoints: Number(e.target.value) })
                  }
                />
              </label>
            </div>
            <div className="toggles">
              <Toggle
                label="Responders may vote"
                checked={r.participantsCanVote}
                onChange={(value) => round(i, { participantsCanVote: value })}
              />
              <Toggle
                label="End voting when all ballots are in"
                checked={r.endVotingWhenAllVotesIn}
                onChange={(value) =>
                  round(i, { endVotingWhenAllVotesIn: value })
                }
              />
              <Toggle
                label="Combine vote groups"
                checked={r.combineVotes}
                onChange={(value) => round(i, { combineVotes: value })}
              />
            </div>
            <h4>
              Round pack pool <small>Empty uses all available packs</small>
            </h4>
            <div className="check-grid">
              {packs
                .filter((pack) => snapshot.selectedPackIds.includes(pack.id))
                .map((pack) => (
                  <label className="check-card" key={pack.id}>
                    <input
                      type="checkbox"
                      checked={r.packIds.includes(pack.id)}
                      onChange={() =>
                        round(i, {
                          packIds: r.packIds.includes(pack.id)
                            ? r.packIds.filter((id) => id !== pack.id)
                            : [...r.packIds, pack.id],
                        })
                      }
                    />
                    {pack.name}
                  </label>
                ))}
            </div>
          </details>
        ))}
      </section>
    </div>
  );
}
export function JoinCard({
  onBack,
  onJoin,
}: {
  onBack: () => void;
  onJoin: (
    code: string,
    name: string,
    avatar: Avatar,
    color: string,
    spectator: boolean,
  ) => void;
}) {
  const [code, setCode] = useState(""),
    [name, setName] = useState(""),
    [avatar, setAvatar] = useState<Avatar>("✦"),
    [color, setColor] = useState("#ffc83d"),
    [spectator, setSpectator] = useState(false);
  return (
    <main className="center-page join-page">
      <button className="back-float icon-button" onClick={onBack}>
        <ArrowLeft />
      </button>
      <div className="join-card panel">
        <h1>Join a game</h1>
        <label className="field">
          <span>Room code</span>
          <input
            className="code-input"
            maxLength={6}
            value={code}
            onChange={(e) =>
              setCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ""))
            }
          />
        </label>
        <label className="field">
          <span>
            Name · {name.length}/{NAME_MAX_LENGTH}
          </span>
          <input
            maxLength={NAME_MAX_LENGTH}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <div className="avatar-picker">
          {AVATARS.map((a) => (
            <button
              className="avatar"
              style={{ backgroundColor: color }}
              key={a}
              onClick={() => setAvatar(a)}
            >
              {a}
            </button>
          ))}
        </div>
        <label className="color-field">
          Icon color{" "}
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
          />
        </label>
        <Toggle
          label="Join as spectator"
          checked={spectator}
          onChange={setSpectator}
        />
        <button
          className="button primary big full"
          disabled={code.length !== 6 || !name.trim()}
          onClick={() => onJoin(code, name, avatar, color, spectator)}
        >
          Join room →
        </button>
      </div>
    </main>
  );
}
