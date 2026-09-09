import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  Copy,
  Download,
  Plus,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import { createGameSettings, createRound } from "../domain/defaults";
import type { GameSettings, PromptPack, RoundSettings } from "../domain/types";
import { SettingsValidator } from "../domain/validation";
import { downloadJson, TemplateRepository } from "../services/storage";

export const NumberField = ({
  label,
  value,
  onChange,
  min = 0,
  max,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}) => (
  <label className="mini-field">
    <span>{label}</span>
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  </label>
);
export const Toggle = ({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) => (
  <label className="toggle-row">
    <span>
      <b>{label}</b>
      {hint && <small>{hint}</small>}
    </span>
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
    />
  </label>
);

export function RoundEditor({
  round,
  index,
  packs,
  players,
  onChange,
  onRemove,
  onDuplicate,
}: {
  round: RoundSettings;
  index: number;
  packs: PromptPack[];
  players: number;
  onChange: (r: RoundSettings) => void;
  onRemove: () => void;
  onDuplicate: () => void;
}) {
  const issues = SettingsValidator.validateRound(round, players);
  const set = <K extends keyof RoundSettings>(
    key: K,
    value: RoundSettings[K],
  ) => onChange({ ...round, [key]: value });
  return (
    <details className="round-card" open={index === 0}>
      <summary>
        <span className="round-number">{index + 1}</span>
        <div>
          <b>{round.name}</b>
          <small>
            {round.respondersPerPrompt === "all"
              ? "All players"
              : `${round.respondersPerPrompt}-way`}{" "}
            ·{" "}
            {round.promptsPerPlayer === "auto"
              ? "Auto prompts"
              : `${round.promptsPerPlayer} prompts/player`}
          </small>
        </div>
        <span className="round-actions">
          <button
            onClick={(e) => {
              e.preventDefault();
              onDuplicate();
            }}
          >
            <Copy />
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              onRemove();
            }}
          >
            <Trash2 />
          </button>
          <ChevronDown className="chevron" />
        </span>
      </summary>
      <div className="round-body">
        <label className="field">
          <span>Round name</span>
          <input
            value={round.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </label>
        <details className="settings-subsection" open>
          <summary>Assignments</summary>
          <div className="settings-grid">
          <label className="mini-field">
            <span>Responders per prompt</span>
            <select
              value={round.respondersPerPrompt}
              onChange={(e) =>
                set(
                  "respondersPerPrompt",
                  e.target.value === "all" ? "all" : Number(e.target.value),
                )
              }
            >
              <option value="all">All players</option>
              {[2, 3, 4, 5, 6, 8, 10].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <label className="mini-field">
            <span>Prompts per player</span>
            <select
              value={round.promptsPerPlayer}
              onChange={(e) =>
                set(
                  "promptsPerPlayer",
                  e.target.value === "auto" ? "auto" : Number(e.target.value),
                )
              }
            >
              <option value="auto">Auto (fair)</option>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <label className="mini-field">
            <span>Grouping</span>
            <select
              value={round.groupingStrategy}
              onChange={(e) =>
                set(
                  "groupingStrategy",
                  e.target.value as RoundSettings["groupingStrategy"],
                )
              }
            >
              <option value="balanced">Balanced · avoid repeats</option>
              <option value="round-robin">Round robin</option>
              <option value="random">True random</option>
            </select>
          </label>
          </div>
        </details>
        <details className="settings-subsection">
          <summary>Scoring &amp; voting</summary>
          <div className="settings-grid">
          <NumberField
            label="Points per player vote"
            value={round.pointsPerVote}
            onChange={(v) => set("pointsPerVote", v)}
          />
          <NumberField
            label="Player bonus at %"
            value={round.playerBonusThreshold}
            max={100}
            onChange={(v) => set("playerBonusThreshold", v)}
          />
          <NumberField
            label="Player bonus points"
            value={round.playerBonusPoints}
            onChange={(v) => set("playerBonusPoints", v)}
          />
          <NumberField
            label="Points per spectator vote"
            value={round.spectatorVotePoints}
            onChange={(v) => set("spectatorVotePoints", v)}
          />
          <NumberField
            label="Spectator bonus at %"
            value={round.spectatorBonusThreshold}
            max={100}
            onChange={(v) => set("spectatorBonusThreshold", v)}
          />
          <NumberField
            label="Spectator bonus points"
            value={round.spectatorBonusPoints}
            onChange={(v) => set("spectatorBonusPoints", v)}
          />
          <NumberField
            label="Votes per player"
            value={round.votesPerPlayer}
            min={1}
            onChange={(v) => set("votesPerPlayer", v)}
          />
          <label className="mini-field">
            <span>Vote allocation</span>
            <select
              value={round.voteAllocation}
              onChange={(e) =>
                set(
                  "voteAllocation",
                  e.target.value as RoundSettings["voteAllocation"],
                )
              }
            >
              <option value="one-per-answer">One per answer</option>
              <option value="stacked">Allow stacked votes</option>
            </select>
          </label>
          {round.voteAllocation === "stacked" && (
            <label className="mini-field">
              <span>Maximum per answer</span>
              <select
                value={round.maxVotesPerAnswer}
                onChange={(e) =>
                  set(
                    "maxVotesPerAnswer",
                    e.target.value === "unlimited"
                      ? "unlimited"
                      : Number(e.target.value),
                  )
                }
              >
                <option value="unlimited">Unlimited</option>
                {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
          )}
          </div>
          <div className="toggles">
          <Toggle
            label="Combine player & spectator votes"
            checked={round.combineVotes}
            onChange={(v) => set("combineVotes", v)}
          />
          <Toggle
            label="Responders can vote on their prompt"
            checked={round.participantsCanVote}
            onChange={(v) => set("participantsCanVote", v)}
          />
          <Toggle
            label="End voting when all ballots are in"
            hint="Turn off to keep the full voting timer available for reactions."
            checked={round.endVotingWhenAllVotesIn}
            onChange={(v) => set("endVotingWhenAllVotesIn", v)}
          />
          </div>
        </details>
        <details className="settings-subsection">
          <summary>Timing &amp; reveal</summary>
          <div className="settings-grid">
          <NumberField
            label="Answer time (seconds)"
            value={round.answerTimeSeconds}
            min={10}
            onChange={(v) => set("answerTimeSeconds", v)}
          />
          <NumberField
            label="Vote time (seconds)"
            value={round.voteTimeSeconds}
            min={5}
            onChange={(v) => set("voteTimeSeconds", v)}
          />
          <NumberField
            label="Results time (seconds)"
            value={round.resultsTimeSeconds}
            min={2}
            onChange={(v) => set("resultsTimeSeconds", v)}
          />
          <label className="mini-field">
            <span>Answer reveal</span>
            <select
              value={round.revealStyle}
              onChange={(e) =>
                set(
                  "revealStyle",
                  e.target.value as RoundSettings["revealStyle"],
                )
              }
            >
              <option value="one-at-a-time">One at a time</option>
              <option value="all-at-once">All at once</option>
            </select>
          </label>
          <NumberField
            label={
              round.revealStyle === "one-at-a-time"
                ? "Seconds between reveals"
                : "Reveal duration (seconds)"
            }
            value={round.revealTimeSeconds}
            min={0.2}
            onChange={(v) => set("revealTimeSeconds", v)}
          />
          </div>
          <div className="toggles">
            <Toggle
              label="Display points earned"
              checked={round.showPointAwards}
              onChange={(v) => set("showPointAwards", v)}
            />
          </div>
        </details>
        <details className="settings-subsection">
          <summary>
            Pack pool <small>Empty uses all available packs</small>
          </summary>
          <div className="check-grid">
          {packs.map((pack) => (
            <label className="check-card" key={pack.id}>
              <input
                type="checkbox"
                checked={round.packIds.includes(pack.id)}
                onChange={() =>
                  set(
                    "packIds",
                    round.packIds.includes(pack.id)
                      ? round.packIds.filter((id) => id !== pack.id)
                      : [...round.packIds, pack.id],
                  )
                }
              />
              <span>
                <b>{pack.name}</b>
                <small>{pack.prompts.length} prompts</small>
              </span>
            </label>
          ))}
          </div>
        </details>
        {issues.map((issue, i) => (
          <div className={`validation ${issue.level}`} key={i}>
            <b>{issue.level === "error" ? "Fix needed" : "Fairness note"}</b>{" "}
            {issue.message} {issue.suggestion}
          </div>
        ))}
      </div>
    </details>
  );
}

export function HostSetup({
  packs,
  templatesRepo,
  onBack,
  onHost,
  editorOnly = false,
}: {
  packs: PromptPack[];
  templatesRepo: TemplateRepository;
  onBack: () => void;
  onHost?: (settings: GameSettings, selected: string[]) => void;
  editorOnly?: boolean;
}) {
  const [templates, setTemplates] = useState(templatesRepo.all());
  const [settings, setSettings] = useState<GameSettings>(() =>
    structuredClone(templates[0] ?? createGameSettings()),
  );
  const [selected, setSelected] = useState<string[]>(
    packs.map((pack) => pack.id),
  );
  const issues = useMemo(
    () =>
      SettingsValidator.validateGame(
        settings,
        Math.min(5, settings.maxPlayers),
        packs.filter((pack) => selected.includes(pack.id)),
      ),
    [settings, selected, packs],
  );
  const updateRound = (index: number, round: RoundSettings) =>
    setSettings((current) => ({
      ...current,
      rounds: current.rounds.map((item, i) => (i === index ? round : item)),
    }));
  return (
    <main className="page shell setup-page">
      <header className="topbar">
        <button className="icon-button" onClick={onBack}>
          <ArrowLeft />
        </button>
        <a className="brand" onClick={onBack}>
          PARTY QUIPS
        </a>
        <span className="status-pill">EDITOR</span>
      </header>
      <section className="setup-heading">
        <div>
          <span className="eyebrow">RULE EDITOR</span>
          <h1>{editorOnly ? "Game rules" : "Host a room"}</h1>
          <p>Create reusable saved settings and tune every round.</p>
        </div>
        <button
          className="button primary big"
          disabled={issues.some((issue) => issue.level === "error")}
          onClick={() => {
            if (editorOnly) {
              templatesRepo.save(settings);
              onBack();
            } else onHost?.(settings, selected);
          }}
        >
          {editorOnly ? "Save settings & close" : "Create room"} <span>→</span>
        </button>
      </section>
      <div className="setup-grid">
        <aside className="setup-sidebar">
          <section className="panel">
            <h2>Saved settings</h2>
            <select
              value={settings.id}
              onChange={(e) =>
                setSettings(
                  structuredClone(
                    templates.find((t) => t.id === e.target.value) ?? settings,
                  ),
                )
              }
            >
              {templates.map((template) => (
                <option value={template.id} key={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
            <button
              className="text-button"
              onClick={() => {
                const saved = templatesRepo.save(settings);
                setTemplates(templatesRepo.all());
                setSettings(saved);
              }}
            >
              <Save /> Save settings
            </button>
            <button
              className="text-button"
              onClick={() =>
                downloadJson(`${settings.name}.game.json`, settings)
              }
            >
              <Download /> Export settings
            </button>
            <label className="text-button">
              <Upload /> Import settings
              <input
                hidden
                type="file"
                accept=".json"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const imported = templatesRepo.import(await file.text());
                    setTemplates(templatesRepo.all());
                    setSettings(imported);
                  }
                }}
              />
            </label>
          </section>
          <section className="panel">
            <h2>Prompt packs</h2>
            <p className="muted">
              Included in this game. Rounds can narrow the pool.
            </p>
            {packs.map((pack) => (
              <label className="check-card" key={pack.id}>
                <input
                  type="checkbox"
                  checked={selected.includes(pack.id)}
                  onChange={() =>
                    setSelected(
                      selected.includes(pack.id)
                        ? selected.filter((id) => id !== pack.id)
                        : [...selected, pack.id],
                    )
                  }
                />
                <span>
                  <b>{pack.name}</b>
                  <small>{pack.prompts.length} prompts</small>
                </span>
              </label>
            ))}
          </section>
        </aside>
        <section className="settings-column">
          <section className="panel general-settings">
            <div className="panel-title">
              <div>
                <span className="eyebrow">GAME SETTINGS</span>
                <h2>{settings.name}</h2>
              </div>
            </div>
            <div className="form-grid">
              <label className="field">
                <span>Settings / game name</span>
                <input
                  maxLength={60}
                  value={settings.name}
                  onChange={(e) =>
                    setSettings({ ...settings, name: e.target.value })
                  }
                />
              </label>
              <NumberField
                label="Maximum players"
                value={settings.maxPlayers}
                min={2}
                onChange={(v) => setSettings({ ...settings, maxPlayers: v })}
              />
            </div>
            <div className="toggles">
              <Toggle
                label="Allow spectators"
                hint="Spectators can join and vote."
                checked={settings.allowSpectators}
                onChange={(v) =>
                  setSettings({ ...settings, allowSpectators: v })
                }
              />
              <Toggle
                label="Allow late joins"
                checked={settings.lateJoin}
                onChange={(v) => setSettings({ ...settings, lateJoin: v })}
              />
              <Toggle
                label="Show authors before voting"
                checked={settings.showAuthorsBeforeVoting}
                onChange={(v) =>
                  setSettings({ ...settings, showAuthorsBeforeVoting: v })
                }
              />
              <Toggle
                label="Reveal authors after voting"
                checked={settings.revealAuthorsAfterVoting}
                onChange={(v) =>
                  setSettings({ ...settings, revealAuthorsAfterVoting: v })
                }
              />
            </div>
          </section>
          <div className="section-heading">
            <div>
              <span className="eyebrow">ROUND STRUCTURE</span>
              <h2>{settings.rounds.length} rounds</h2>
            </div>
            <button
              className="button secondary compact"
              onClick={() =>
                setSettings({
                  ...settings,
                  rounds: [
                    ...settings.rounds,
                    createRound(`Round ${settings.rounds.length + 1}`),
                  ],
                })
              }
            >
              <Plus /> Add round
            </button>
          </div>
          {settings.rounds.map((round, index) => (
            <RoundEditor
              key={round.id}
              round={round}
              index={index}
              packs={packs.filter((pack) => selected.includes(pack.id))}
              players={Math.min(5, settings.maxPlayers)}
              onChange={(r) => updateRound(index, r)}
              onRemove={() =>
                setSettings({
                  ...settings,
                  rounds: settings.rounds.filter((_, i) => i !== index),
                })
              }
              onDuplicate={() =>
                setSettings({
                  ...settings,
                  rounds: [
                    ...settings.rounds.slice(0, index + 1),
                    {
                      ...structuredClone(round),
                      id: crypto.randomUUID(),
                      name: `${round.name} copy`,
                    },
                    ...settings.rounds.slice(index + 1),
                  ],
                })
              }
            />
          ))}
        </section>
      </div>
    </main>
  );
}
