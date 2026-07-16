import type { Difficulty, RulesetMode } from "@mao/protocol";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Wordmark } from "../components/Seal.js";
import { createTable, fetchThemes, type ThemeCard } from "../lib/api.js";
import { getName, setName } from "../lib/identity.js";

export function Play() {
  const nav = useNavigate();
  const [name, setNameState] = useState(getName());
  const [mode, setMode] = useState<RulesetMode>("classic");
  const [difficulty, setDifficulty] = useState<Difficulty>("standard");
  const [themeId, setThemeId] = useState<string | null>(null);
  const [themes, setThemes] = useState<ThemeCard[]>([]);
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchThemes()
      .then(setThemes)
      .catch(() => setThemes([]));
  }, []);

  const commitName = () => {
    const n = name.trim();
    if (n) setName(n);
    return n;
  };

  const convene = async () => {
    const n = commitName();
    if (!n) {
      setError("The General requires a name.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const code = await createTable({
        mode,
        difficulty,
        themeId: mode === "themed" ? themeId : null,
      });
      nav(`/t/${code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  };

  const join = () => {
    const n = commitName();
    if (!n) {
      setError("The General requires a name.");
      return;
    }
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) {
      setError("A table code is six characters.");
      return;
    }
    setName(n);
    nav(`/t/${code}`);
  };

  return (
    <main className="play">
      <header className="play__top">
        <Link to="/" aria-label="General Mao home">
          <Wordmark compact />
        </Link>
      </header>

      <div className="play__grid">
        <section className="gm-panel play__card">
          <h1 className="gm-general">Convene a table</h1>
          <p className="play__lede">
            You invent nothing. The General invents the rules and keeps them. You will learn them
            the hard way, or not at all.
          </p>

          <label className="field">
            <span>Your name at the bench</span>
            <input
              className="input"
              value={name}
              onChange={(e) => setNameState(e.target.value)}
              placeholder="e.g. The Defendant"
              maxLength={24}
            />
          </label>

          <label className="field">
            <span>Ruleset</span>
            <select
              className="input"
              value={mode}
              onChange={(e) => setMode(e.target.value as RulesetMode)}
            >
              <option value="classic">Classic, fully secret rules</option>
              <option value="themed">Themed deck, pick a flavor, not the rules</option>
              <option value="practice">Practice, the rules are shown (not really Mao)</option>
            </select>
          </label>

          {mode === "themed" && (
            <div className="theme-grid">
              {themes.map((th) => (
                <button
                  key={th.id}
                  type="button"
                  className={`theme-card ${themeId === th.id ? "theme-card--on" : ""}`}
                  onClick={() => setThemeId(themeId === th.id ? null : th.id)}
                >
                  <span className="theme-card__name gm-general">{th.name}</span>
                  <span className="theme-card__diff">{th.difficulty}</span>
                  <span className="theme-card__blurb">{th.blurb}</span>
                </button>
              ))}
            </div>
          )}

          {mode !== "themed" && (
            <label className="field">
              <span>Severity</span>
              <select
                className="input"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as Difficulty)}
              >
                <option value="gentle">Gentle, a few discoverable laws</option>
                <option value="standard">Standard, the house norm</option>
                <option value="brutal">Brutal, a dozen interlocking cruelties</option>
              </select>
            </label>
          )}

          <button
            type="button"
            className="btn btn--primary btn--lg"
            onClick={convene}
            disabled={busy}
          >
            {busy ? "Convening…" : "Convene the table"}
          </button>
        </section>

        <section className="gm-panel play__card">
          <h2 className="gm-general">Answer a summons</h2>
          <p className="play__lede">Someone has a table waiting. Enter the six-character code.</p>
          <label className="field">
            <span>Table code</span>
            <input
              className="input input--code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
              placeholder="••••••"
              maxLength={6}
              inputMode="text"
              autoCapitalize="characters"
            />
          </label>
          <button type="button" className="btn btn--lg" onClick={join}>
            Take my seat
          </button>
        </section>
      </div>

      {error && <p className="play__error">{error}</p>}
    </main>
  );
}
