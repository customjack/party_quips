import { useMemo, useState } from "react";
import { ArrowRight, Gamepad2, PackagePlus, Radio } from "lucide-react";
import { RulesPage } from "./components/RulesEditor";
import { JoinCard, Lobby } from "./components/Lobby";
import { PackCreator } from "./components/PackCreator";
import type { Avatar, GameSettings } from "./domain/types";
import { ClientSession, HostSession } from "./network/session";
import { PackRepository, TemplateRepository } from "./services/storage";
import "./styles.css";
type Screen = "home" | "rules" | "join" | "editor" | "lobby";
export default function App() {
  const packs = useMemo(() => new PackRepository(), []),
    templates = useMemo(() => new TemplateRepository(), []);
  const [screen, setScreen] = useState<Screen>("home"),
    [session, setSession] = useState<HostSession | ClientSession>(),
    [isHost, setIsHost] = useState(false);
  const leave = () => {
    if (session instanceof ClientSession) session.leave();
    else session?.destroy();
    setSession(undefined);
    setScreen("home");
  };
  const host = (settings: GameSettings, selected: string[]) => {
    const next = new HostSession(
      { name: "Host", avatar: "✦", avatarColor: "#ffc83d", spectator: false },
      settings,
      packs.all().filter((p) => selected.includes(p.id)),
    );
    setSession(next);
    setIsHost(true);
    setScreen("lobby");
  };
  const quickHost = () =>
    host(
      { ...structuredClone(templates.all()[0]), id: crypto.randomUUID() },
      packs.all().map((p) => p.id),
    );
  const join = (
    code: string,
    name: string,
    avatar: Avatar,
    avatarColor: string,
    spectator: boolean,
  ) => {
    const next = new ClientSession(code, {
      name,
      avatar,
      avatarColor,
      spectator,
    });
    setSession(next);
    setIsHost(false);
    setScreen("lobby");
  };
  if (screen === "editor")
    return (
      <PackCreator
        repository={packs}
        onBack={() => setScreen("home")}
        onRules={() => setScreen("rules")}
      />
    );
  if (screen === "rules")
    return (
      <RulesPage
        packs={packs.all()}
        templatesRepo={templates}
        onBack={() => setScreen("home")}
        onPacks={() => setScreen("editor")}
      />
    );
  if (screen === "join")
    return <JoinCard onBack={() => setScreen("home")} onJoin={join} />;
  if (screen === "lobby" && session)
    return (
      <Lobby
        session={session}
        isHost={isHost}
        packs={packs.all()}
        templatesRepo={templates}
        onLeave={leave}
      />
    );
  return (
    <main className="home-page">
      <nav>
        <a className="brand">PARTY QUIPS</a>
      </nav>
      <section className="home-hero">
        <div className="hero-copy">
          <h1>
            PARTY
            <br />
            <em>QUIPS</em>
          </h1>
          <div className="home-actions">
            <button className="action-card host-action" onClick={quickHost}>
              <span className="action-icon">
                <Radio />
              </span>
              <span>
                <b>Host a game</b>
                <small>Create a room with your default settings.</small>
              </span>
              <ArrowRight />
            </button>
            <button className="action-card" onClick={() => setScreen("join")}>
              <span className="action-icon">
                <Gamepad2 />
              </span>
              <span>
                <b>Join a game</b>
                <small>Enter a room code.</small>
              </span>
              <ArrowRight />
            </button>
            <button className="action-card" onClick={() => setScreen("editor")}>
              <span className="action-icon">
                <PackagePlus />
              </span>
              <span>
                <b>Editor</b>
                <small>Manage prompt packs and game rules.</small>
              </span>
              <ArrowRight />
            </button>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <span className="shape shape-one">?</span>
          <span className="shape shape-two">!</span>
          <span className="shape shape-three">✦</span>
          <div className="quip-card card-one">
            <small>PROMPT</small>A terrible name for a pet store
          </div>
          <div className="quip-card card-two">
            <small>ANSWER</small>Pets Pets Pets
          </div>
        </div>
      </section>
    </main>
  );
}
