import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Download,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { Prompt, PromptPack } from "../domain/types";
import { downloadJson, PackRepository } from "../services/storage";
const newPrompt = (): Prompt => ({
  id: crypto.randomUUID(),
  text: "",
  safetyQuips: ["", "", "", ""],
});
const blank = (): PromptPack => {
  const now = new Date().toISOString();
  return {
    schemaVersion: 2,
    id: crypto.randomUUID(),
    name: "Untitled pack",
    description: "",
    author: "",
    tags: [],
    prompts: [],
    createdAt: now,
    updatedAt: now,
  };
};
export function PackCreator({
  repository,
  onBack,
  onRules,
}: {
  repository: PackRepository;
  onBack: () => void;
  onRules?: () => void;
}) {
  const initial = useMemo(() => blank(), []);
  const [packs, setPacks] = useState(repository.all()),
    [pack, setPack] = useState(initial),
    [baseline, setBaseline] = useState(initial),
    [notice, setNotice] = useState("");
  const dirty = JSON.stringify(pack) !== JSON.stringify(baseline);
  const readOnly = pack.id === "default-pack";
  const switchTo = (next: PromptPack) => {
    if (dirty && !window.confirm("Discard your unsaved changes?")) return;
    const copy = structuredClone(next);
    setPack(copy);
    setBaseline(copy);
    setNotice("");
  };
  const update = (id: string, fn: (p: Prompt) => Prompt) =>
    setPack((p) => ({
      ...p,
      prompts: p.prompts.map((x) => (x.id === id ? fn(x) : x)),
    }));
  const save = () => {
    if (readOnly) return;
    const next = {
      ...pack,
      name: pack.name.trim().slice(0, 60),
      prompts: pack.prompts
        .filter((p) => p.text.trim())
        .map((prompt) => ({
          ...prompt,
          safetyQuips: prompt.safetyQuips.filter((quip) => quip.trim()).length
            ? prompt.safetyQuips.filter((quip) => quip.trim())
            : ["No comment."],
        })),
      updatedAt: new Date().toISOString(),
    };
    if (!next.name || !next.prompts.length)
      return setNotice("Add a name and at least one prompt.");
    repository.save(next);
    setPack(next);
    setBaseline(next);
    setPacks(repository.all());
    setNotice("Saved to this browser.");
  };
  const importFile = async (file?: File) => {
    if (!file) return;
    try {
      const p = repository.import(await file.text());
      setPack(p);
      setBaseline(p);
      setPacks(repository.all());
      setNotice("Pack imported.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Import failed.");
    }
  };
  return (
    <main className="page shell editor-page">
      <header className="topbar">
        <button
          className="icon-button"
          onClick={() => {
            if (!dirty || window.confirm("Discard your unsaved changes?"))
              onBack();
          }}
        >
          <ArrowLeft />
        </button>
        <a
          className="brand"
          onClick={() => {
            if (!dirty || window.confirm("Discard your unsaved changes?"))
              onBack();
          }}
        >
          PARTY QUIPS
        </a>
        <span className="status-pill">EDITOR</span>
      </header>
      <nav className="editor-tabs">
        <button className="active">Prompt packs</button>
        {onRules && (
          <button
            onClick={() => {
              if (!dirty || window.confirm("Discard your unsaved changes?"))
                onRules();
            }}
          >
            Game rules
          </button>
        )}
      </nav>
      <section className="editor-heading">
        <div>
          <span className="eyebrow">CONTENT EDITOR</span>
          <h1>Prompt packs</h1>
          <p>Add as many fallback answers as each prompt needs.</p>
        </div>
        <div className="button-row">
          <label className="button secondary">
            <Upload size={17} />
            Import
            <input
              hidden
              type="file"
              accept=".json"
              onChange={(e) => void importFile(e.target.files?.[0])}
            />
          </label>
          <button
            className="button secondary"
            onClick={() => downloadJson(`${pack.name}.pack.json`, pack)}
          >
            <Download size={17} />
            Export
          </button>
          <button
            className="button primary"
            disabled={readOnly || !dirty}
            onClick={save}
          >
            <Save size={17} />
            Save
          </button>
        </div>
      </section>
      <div className="editor-grid">
        <aside className="panel library">
          <div className="panel-title">
            <h2>Your packs</h2>
            <button
              className="icon-button small"
              onClick={() => switchTo(blank())}
            >
              <Plus />
            </button>
          </div>
          {packs.map((p) => (
            <div className="pack-library-row" key={p.id}>
              <button
                className={
                  p.id === pack.id ? "pack-list-item active" : "pack-list-item"
                }
                onClick={() => switchTo(p)}
              >
                <b>{p.name}</b>
                <span>
                  {p.prompts.length} prompts
                  {p.id === "default-pack" ? " · built in" : ""}
                </span>
              </button>
              {p.id !== "default-pack" && (
                <button
                  className="library-delete"
                  aria-label={`Delete ${p.name}`}
                  onClick={() => {
                    if (window.confirm(`Delete “${p.name}”?`)) {
                      repository.remove(p.id);
                      setPacks(repository.all());
                      if (pack.id === p.id) {
                        const next = blank();
                        setPack(next);
                        setBaseline(next);
                      }
                    }
                  }}
                >
                  <Trash2 />
                </button>
              )}
            </div>
          ))}
        </aside>
        <section className="panel pack-form">
          {readOnly && (
            <div className="validation warning">
              <b>Built-in pack.</b> Export it or create a new pack to make
              changes.
            </div>
          )}
          <div className="form-grid">
            <label className="field">
              <span>Pack name</span>
              <input
                disabled={readOnly}
                maxLength={60}
                value={pack.name}
                onChange={(e) => setPack({ ...pack, name: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Author</span>
              <input
                disabled={readOnly}
                maxLength={40}
                value={pack.author}
                onChange={(e) => setPack({ ...pack, author: e.target.value })}
              />
            </label>
          </div>
          <label className="field">
            <span>Description</span>
            <textarea
              disabled={readOnly}
              maxLength={240}
              rows={2}
              value={pack.description}
              onChange={(e) =>
                setPack({ ...pack, description: e.target.value })
              }
            />
          </label>
          <div className="prompt-heading">
            <div>
              <h2>Prompts</h2>
              <p>{pack.prompts.length} in this pack</p>
            </div>
            <button
              disabled={readOnly}
              className="button primary compact"
              onClick={() =>
                setPack({ ...pack, prompts: [...pack.prompts, newPrompt()] })
              }
            >
              <Plus />
              Add one prompt
            </button>
          </div>
          <div className="prompt-card-list">
            {pack.prompts.map((p, i) => (
              <details className="prompt-editor-card" key={p.id}>
                <summary>
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  <b>{p.text || "New prompt"}</b>
                  <button
                    disabled={readOnly}
                    onClick={(e) => {
                      e.preventDefault();
                      setPack({
                        ...pack,
                        prompts: pack.prompts.filter((x) => x.id !== p.id),
                      });
                    }}
                  >
                    <Trash2 />
                  </button>
                </summary>
                <div>
                  <label className="field">
                    <span>Prompt</span>
                    <textarea
                      disabled={readOnly}
                      maxLength={220}
                      value={p.text}
                      onChange={(e) =>
                        update(p.id, (x) => ({ ...x, text: e.target.value }))
                      }
                    />
                  </label>
                  <span className="safety-label">Safety quips</span>
                  {p.safetyQuips.map((q, j) => (
                    <div className="safety-row" key={j}>
                      <input
                        className="safety-input"
                        disabled={readOnly}
                        maxLength={180}
                        value={q}
                        placeholder={`Fallback answer ${j + 1}`}
                        onChange={(e) =>
                          update(p.id, (x) => ({
                            ...x,
                            safetyQuips: x.safetyQuips.map((v, k) =>
                              k === j ? e.target.value : v,
                            ),
                          }))
                        }
                      />
                      <button
                        disabled={readOnly}
                        onClick={() =>
                          update(p.id, (x) => ({
                            ...x,
                            safetyQuips: x.safetyQuips.filter(
                              (_, k) => k !== j,
                            ),
                          }))
                        }
                      >
                        <X />
                      </button>
                    </div>
                  ))}
                  <button
                    className="text-button"
                    disabled={readOnly}
                    onClick={() =>
                      update(p.id, (x) => ({
                        ...x,
                        safetyQuips: [...x.safetyQuips, ""],
                      }))
                    }
                  >
                    <Plus /> Add safety quip
                  </button>
                </div>
              </details>
            ))}
          </div>
          {!pack.prompts.length && (
            <div className="empty-editor">
              No prompts yet. Add one when you’re ready.
            </div>
          )}
          {notice && <p className="notice">{notice}</p>}
        </section>
      </div>
    </main>
  );
}
