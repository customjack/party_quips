import { useMemo, useState } from "react";
import { ArrowLeft, Download, Plus, Save, Trash2, Upload } from "lucide-react";
import { createGameSettings, createRound } from "../domain/defaults";
import {
  REACTIONS,
  type GameSettings,
  type PromptPack,
  type ReactionLimit,
  type RoundSettings,
} from "../domain/types";
import { ReactionIcon } from "../resources/ReactionIcon";
import { SettingsValidator } from "../domain/validation";
import { downloadJson, type TemplateRepository } from "../services/storage";
import { NumberField, RoundEditor, Toggle } from "./HostSetup";

const ReactionLimitField = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: ReactionLimit;
  onChange: (value: ReactionLimit) => void;
}) => (
  <label className="mini-field">
    <span>
      {label} <small>0 = unlimited</small>
    </span>
    <input
      type="number"
      min="0"
      value={value === "unlimited" ? 0 : value}
      onChange={(event) => {
        const next = Math.max(0, Number(event.target.value) || 0);
        onChange(next === 0 ? "unlimited" : next);
      }}
    />
  </label>
);

export function RulesEditor({
  settings,
  selected,
  packs,
  templatesRepo,
  onSettings,
  onSelected,
  protectDefault = false,
  heading = true,
}: {
  settings: GameSettings;
  selected: string[];
  packs: PromptPack[];
  templatesRepo: TemplateRepository;
  onSettings: (value: GameSettings) => void;
  onSelected: (ids: string[]) => void;
  protectDefault?: boolean;
  heading?: boolean;
}) {
  const [templates, setTemplates] = useState(templatesRepo.all());
  const [baseline, setBaseline] = useState(settings);
  const readOnly = protectDefault && settings.id === "default-game";
  const dirty = JSON.stringify(settings) !== JSON.stringify(baseline);
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
    onSettings({
      ...settings,
      rounds: settings.rounds.map((item, i) => (i === index ? round : item)),
    });
  const saveSettings = () => {
    const saved = templatesRepo.save(settings);
    setTemplates(templatesRepo.all());
    onSettings(saved);
    setBaseline(saved);
  };
  const chooseTemplate = (template: GameSettings) => {
    if (dirty && !window.confirm("Discard your unsaved rule changes?")) return;
    const copy = structuredClone(template);
    onSettings(copy);
    setBaseline(copy);
  };
  const addSettings = () =>
    chooseTemplate(createGameSettings("Untitled settings"));
  return (
    <div className={`rules-editor ${readOnly ? "read-only" : ""}`}>
      {heading && (
        <section className="editor-heading">
          <div>
            <span className="eyebrow">RULE EDITOR</span>
            <h1>Game rules</h1>
            <p>
              Build reusable saved settings. The built-in default stays
              unchanged.
            </p>
          </div>
          <div className="button-row">
            <label className="button secondary">
              <Upload size={17} />
              Import
              <input
                hidden
                type="file"
                accept=".json"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const imported = templatesRepo.import(await file.text());
                    setTemplates(templatesRepo.all());
                    onSettings(imported);
                    setBaseline(imported);
                  }
                }}
              />
            </label>
            <button
              className="button secondary"
              onClick={() =>
                downloadJson(`${settings.name}.game.json`, settings)
              }
            >
              <Download size={17} />
              Export
            </button>
            <button
              className="button primary"
              disabled={readOnly || !dirty}
              onClick={saveSettings}
            >
              <Save size={17} />
              Save
            </button>
          </div>
        </section>
      )}
      <div className="setup-grid">
        <aside className="setup-sidebar rules-sidebar">
          <section className="panel">
            <div className="panel-title">
              <h2>Saved settings</h2>
              <button className="icon-button small" onClick={addSettings}>
                <Plus />
              </button>
            </div>
            {templates.map((template) => (
              <div className="pack-library-row" key={template.id}>
                <button
                  className={
                    template.id === settings.id
                      ? "pack-list-item active"
                      : "pack-list-item"
                  }
                  onClick={() => chooseTemplate(template)}
                >
                  <b>{template.name}</b>
                  <span>
                    {template.rounds.length} rounds
                    {template.id === "default-game" ? " · built in" : ""}
                  </span>
                </button>
                {template.id !== "default-game" && (
                  <button
                    className="library-delete"
                    aria-label={`Delete ${template.name}`}
                    onClick={() => {
                      if (!window.confirm(`Delete “${template.name}”?`)) return;
                      templatesRepo.remove(template.id);
                      const next = templatesRepo.all();
                      setTemplates(next);
                      if (settings.id === template.id) {
                        const replacement = structuredClone(next[0]);
                        onSettings(replacement);
                        setBaseline(replacement);
                      }
                    }}
                  >
                    <Trash2 />
                  </button>
                )}
              </div>
            ))}
          </section>
          <section className="panel">
            <h2>Prompt packs</h2>
            {packs.map((pack) => (
              <label className="check-card" key={pack.id}>
                <input
                  disabled={readOnly}
                  type="checkbox"
                  checked={selected.includes(pack.id)}
                  onChange={() =>
                    onSelected(
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
          {readOnly && (
            <div className="validation warning">
              <b>Built-in settings.</b> Use + to create editable settings.
            </div>
          )}
          <fieldset disabled={readOnly} className="rules-fieldset">
            <section className="panel general-settings">
              <div className="panel-title">
                <div>
                  <span className="eyebrow">GAME SETTINGS</span>
                  <h2>{settings.name}</h2>
                </div>
              </div>
              <div className="form-grid">
                <label className="field">
                  <span>Settings name</span>
                  <input
                    maxLength={60}
                    value={settings.name}
                    onChange={(e) =>
                      onSettings({ ...settings, name: e.target.value })
                    }
                  />
                </label>
                <NumberField
                  label="Maximum players"
                  value={settings.maxPlayers}
                  min={2}
                  onChange={(maxPlayers) =>
                    onSettings({ ...settings, maxPlayers })
                  }
                />
                <NumberField
                  label="Scoreboard seconds"
                  value={settings.scoreboardTimeSeconds}
                  min={2}
                  onChange={(scoreboardTimeSeconds) =>
                    onSettings({ ...settings, scoreboardTimeSeconds })
                  }
                />
              </div>
              <div className="toggles">
                <Toggle
                  label="Allow spectators"
                  checked={settings.allowSpectators}
                  onChange={(allowSpectators) =>
                    onSettings({ ...settings, allowSpectators })
                  }
                />
                <Toggle
                  label="Allow players to join active games"
                  hint="Late players can vote immediately and answer starting next round."
                  checked={settings.lateJoin}
                  onChange={(lateJoin) => onSettings({ ...settings, lateJoin })}
                />
                <Toggle
                  label="Allow disconnected-player takeover"
                  checked={settings.takeoverDisconnectedPlayers}
                  onChange={(takeoverDisconnectedPlayers) =>
                    onSettings({
                      ...settings,
                      takeoverDisconnectedPlayers,
                    })
                  }
                />
                <label className="toggle-row">
                  <span>
                    <b>When a player cannot join</b>
                  </span>
                  <select
                    value={settings.fullRoomFallback}
                    onChange={(e) =>
                      onSettings({
                        ...settings,
                        fullRoomFallback: e.target
                          .value as GameSettings["fullRoomFallback"],
                      })
                    }
                  >
                    <option value="spectator">Join as spectator</option>
                    <option value="reject">Reject connection</option>
                  </select>
                </label>
                <Toggle
                  label="Show authors before voting"
                  checked={settings.showAuthorsBeforeVoting}
                  onChange={(showAuthorsBeforeVoting) =>
                    onSettings({ ...settings, showAuthorsBeforeVoting })
                  }
                />
                <Toggle
                  label="Reveal authors after voting"
                  checked={settings.revealAuthorsAfterVoting}
                  onChange={(revealAuthorsAfterVoting) =>
                    onSettings({ ...settings, revealAuthorsAfterVoting })
                  }
                />
                <Toggle
                  label="Reveal who voted for each answer"
                  hint="Voter choices appear only after the result is revealed."
                  checked={settings.revealVotersAfterVoting}
                  onChange={(revealVotersAfterVoting) =>
                    onSettings({ ...settings, revealVotersAfterVoting })
                  }
                />
              </div>
              <details className="settings-subsection">
                <summary>Reaction scoring</summary>
                <p>
                  Limits reset for each matchup. Reactions are locked after they
                  are sent.
                </p>
                <div className="settings-grid">
                  <ReactionLimitField
                    label="Total reactions per player"
                    value={settings.maxReactionsPerPlayer}
                    onChange={(maxReactionsPerPlayer) =>
                      onSettings({ ...settings, maxReactionsPerPlayer })
                    }
                  />
                  <ReactionLimitField
                    label="Reactions per quip"
                    value={settings.maxReactionsPerTarget}
                    onChange={(maxReactionsPerTarget) =>
                      onSettings({ ...settings, maxReactionsPerTarget })
                    }
                  />
                </div>
                <div className="reaction-settings-grid">
                  {REACTIONS.map((reaction) => (
                    <div className="reaction-setting" key={reaction.id}>
                      <ReactionIcon reaction={reaction.id} />
                      <NumberField
                        label={reaction.label}
                        value={settings.reactionPoints[reaction.id]}
                        onChange={(points) =>
                          onSettings({
                            ...settings,
                            reactionPoints: {
                              ...settings.reactionPoints,
                              [reaction.id]: points,
                            },
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              </details>
            </section>
            <div className="section-heading">
              <div>
                <span className="eyebrow">ROUND STRUCTURE</span>
                <h2>{settings.rounds.length} rounds</h2>
              </div>
              <div className="button-row">
                <button
                  className="button secondary compact"
                  onClick={() =>
                    onSettings({
                      ...settings,
                      rounds: [
                        ...settings.rounds,
                        createRound(`Round ${settings.rounds.length + 1}`),
                      ],
                    })
                  }
                >
                  <Plus />
                  Add round
                </button>
              </div>
            </div>
            {settings.rounds.map((round, index) => (
              <RoundEditor
                key={round.id}
                round={round}
                index={index}
                packs={packs.filter((pack) => selected.includes(pack.id))}
                players={Math.min(5, settings.maxPlayers)}
                onChange={(value) => updateRound(index, value)}
                onRemove={() =>
                  onSettings({
                    ...settings,
                    rounds: settings.rounds.filter((_, i) => i !== index),
                  })
                }
                onDuplicate={() =>
                  onSettings({
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
          </fieldset>
          {issues.map((issue, index) => (
            <div className={`validation ${issue.level}`} key={index}>
              {issue.message}
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

export function RulesPage({
  packs,
  templatesRepo,
  onBack,
  onPacks,
}: {
  packs: PromptPack[];
  templatesRepo: TemplateRepository;
  onBack: () => void;
  onPacks: () => void;
}) {
  const [settings, setSettings] = useState(() =>
    structuredClone(templatesRepo.all()[0]),
  );
  const [selected, setSelected] = useState(packs.map((pack) => pack.id));
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
      <nav className="editor-tabs">
        <button onClick={onPacks}>Prompt packs</button>
        <button className="active">Game rules</button>
      </nav>
      <RulesEditor
        settings={settings}
        selected={selected}
        packs={packs}
        templatesRepo={templatesRepo}
        onSettings={setSettings}
        onSelected={setSelected}
        protectDefault
      />
    </main>
  );
}
