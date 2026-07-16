import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Seal, Wordmark } from "../components/Seal.js";

const CRYPTIC = [
  { who: "The Defendant", reason: "Penalty: failure to announce." },
  { who: "Juror 4", reason: "Penalty: improper address." },
  { who: "The Defendant", reason: "Penalty: prohibited speech." },
  { who: "The Clerk", reason: "Penalty: unlawful play." },
];

export function Landing() {
  return (
    <div className="landing">
      <header className="landing__nav">
        <Wordmark />
        <nav className="landing__navlinks">
          <a href="#how">How it works</a>
          <a href="#general">The General</a>
          <a href="#faq">Questions</a>
          <a
            className="btn btn--sm btn--ghost"
            href="https://github.com/KarthikSubramanian07/general-mao"
            target="_blank"
            rel="noreferrer"
          >
            Source
          </a>
          <Link className="btn btn--sm btn--primary" to="/play">
            Convene a table
          </Link>
        </nav>
      </header>

      {/* ---- hero ---- */}
      <section className="hero">
        <div className="hero__copy">
          <h1 className="hero__title">
            The house makes the rules.
            <span className="hero__title-2"> It won't tell you what they are.</span>
          </h1>
          <p className="hero__lede">
            Free online Mao, except the secret rules aren't invented by a smug winner. They're
            invented and enforced by the General: an AI that watches every play, issues penalties in
            cryptic form, and never, ever explains. Everyone sits down blind. You deduce the law one
            penalty card at a time.
          </p>
          <div className="hero__cta">
            <Link className="btn btn--primary btn--lg" to="/play">
              Convene a table
            </Link>
            <a className="btn btn--ghost btn--lg" href="#the-one-rule">
              Read the one rule
            </a>
          </div>
          <p className="hero__fineprint">
            No signup. No downloads. Free forever. 2 to 6 to a table.
          </p>
        </div>

        <aside className="hero__dossier" aria-label="A secret ruleset, redacted">
          <div className="dossier">
            <div className="dossier__head">
              <span className="gm-label">Secret ruleset</span>
              <span className="dossier__stamp">
                <Seal size={26} tone="penalty" /> sealed
              </span>
            </div>
            <ul className="dossier__rules">
              <li>
                Eights <Redact w="7ch" /> the direction of play.
              </li>
              <li>
                Never play a red card onto a <Redact w="5ch" /> face card.
              </li>
              <li>
                When you reach one card, say <Redact w="4ch" />.
              </li>
              <li>
                Do not <Redact w="6ch" /> anyone at the table.
              </li>
              <li className="dossier__win">
                To win, declare: <Redact w="10ch" penalty />.
              </li>
            </ul>
            <div className="dossier__strip">
              {CRYPTIC.slice(0, 3).map((c, i) => (
                <div key={c.reason} className="dossier__pen">
                  <span className="gm-mono">{String(i + 1).padStart(2, "0")}</span>
                  <span>{c.reason}</span>
                  <span className="dossier__seal">✦</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>

      {/* ---- the one rule ---- */}
      <section className="one-rule" id="the-one-rule">
        <Seal size={44} />
        <p className="one-rule__text gm-general">"The only rule I may tell you is this one."</p>
        <p className="one-rule__sub">
          Everything else is secret, generated fresh, and enforced in silence.
        </p>
      </section>

      {/* ---- how it works (a real sequence) ---- */}
      <section className="how" id="how">
        <h2 className="section-title gm-general">The loop is cruel and simple</h2>
        <ol className="steps">
          <li className="step">
            <span className="step__n gm-mono">01</span>
            <h3>Play a card</h3>
            <p>
              It looks like an ordinary shedding game: match the rank or the suit, empty your hand
              to win. That is the part you're allowed to know.
            </p>
          </li>
          <li className="step">
            <span className="step__n gm-mono">02</span>
            <h3>Take the penalty</h3>
            <p>
              Break a hidden law and a penalty card slides into your hand. The General names your
              sin, but only the category: "improper address," never what address was correct.
            </p>
          </li>
          <li className="step">
            <span className="step__n gm-mono">03</span>
            <h3>Crack the pattern</h3>
            <p>
              The ledger fills. You argue in chat. Slowly, together, you infer the laws you're being
              punished by, until someone goes out and the record is finally read aloud.
            </p>
          </li>
        </ol>
      </section>

      {/* ---- the General ---- */}
      <section className="general" id="general">
        <div className="general__copy">
          <h2 className="section-title gm-general">The General does not answer to you</h2>
          <p>
            A human rulemaster always already knows the rules, which spoils it for them and makes it
            nearly impossible to play cold with strangers. The General removes the human. It is
            consistent to a fault: the same play in the same state draws the same penalty, every
            time. Mystery comes from hidden-but-fixed laws, never from randomness.
          </p>
          <p className="general__aside">
            It congratulates no one. It occasionally says <strong>"Correct."</strong> and nothing
            else, which is somehow worse.
          </p>
        </div>
        <div className="general__ledger" role="group" aria-label="Sample ledger">
          <div className="ledger__head">
            <span className="ledger__title">The Ledger</span>
            <span className="ledger__count">4 entries</span>
          </div>
          {CRYPTIC.map((c, i) => (
            <div key={c.reason} className="ledger-row ledger-row--penalty">
              <span className="ledger-row__seq">{String(i + 1).padStart(2, "0")}</span>
              <span className="ledger-row__body">
                <span className="ledger-row__who">{c.who}</span>
                <span className="ledger-row__reason">{c.reason}</span>
              </span>
              <span className="ledger-row__stamp">+1 ✦</span>
            </div>
          ))}
        </div>
      </section>

      {/* ---- modes ---- */}
      <section className="modes">
        <h2 className="section-title gm-general">The General has moods</h2>
        <div className="modes__list">
          <div className="mode">
            <h3 className="gm-general">Classic</h3>
            <p>A complete, unknown ruleset. Nobody knows anything. Maximum Mao. The default.</p>
          </div>
          <div className="mode">
            <h3 className="gm-general">Themed decks</h3>
            <p>
              Victorian Court. Superstition. The Ministry. Pick the flavor; you still don't know the
              rules.
            </p>
          </div>
          <div className="mode">
            <h3 className="gm-general">Practice</h3>
            <p>
              The rules are shown. Not really Mao anymore, but the on-ramp for anyone who's never
              shed a card.
            </p>
          </div>
          <div className="mode">
            <h3 className="gm-general">Bring your own</h3>
            <p>
              Author a devious ruleset in plain English. The General structures and enforces it, and
              never reveals it. Watch your trap spring.
            </p>
          </div>
        </div>
      </section>

      {/* ---- FAQ ---- */}
      <section className="faq" id="faq">
        <h2 className="section-title gm-general">Questions the General will permit</h2>
        <div className="faq__list">
          <Faq q="Do I need an account?">
            No. The host convenes a table, shares a six-character code, and friends join on any
            device with a browser. An optional magic-link login is offered only after your first
            game, never before.
          </Faq>
          <Faq q="Is it actually fair, or does the AI just make things up?">
            Fair, by construction. The rules engine is deterministic and heavily tested: the same
            game state and the same secret ruleset always produce the same penalty. Before a match,
            the ruleset is validated for consistency, so the General is lawful evil, never chaotic.
          </Faq>
          <Faq q="Can a clever player read the rules out of the page?">
            No. The secret ruleset lives only on the server, inside the table's own process. It is
            never sent to any client, not in game state, not in error strings, not in penalty
            reasons. A test captures every outbound message across a full match and asserts the
            rules never appear.
          </Faq>
          <Faq q="Will it ever teach me the rules?">
            Not in a Classic match. That isn't a missing feature; that's the entire game.
          </Faq>
          <Faq q="What does it cost?">
            Nothing. It's a personal project, free forever, no ads during play, no paywalls. If you
            feel moved to it, you can{" "}
            <a
              href="https://buymeacoffee.com/winnerkarthik"
              target="_blank"
              rel="noreferrer"
              style={{ color: "var(--gm-penalty)" }}
            >
              buy the General a coffee
            </a>
            . The General does not drink coffee, but accepts the tribute.
          </Faq>
        </div>
      </section>

      <footer className="landing__footer">
        <div className="landing__footer-inner">
          <Wordmark compact />
          <p className="gm-general">"The only rule I may tell you is this one."</p>
          <div className="landing__footer-links">
            <Link to="/play">Convene a table</Link>
            <a
              href="https://github.com/KarthikSubramanian07/general-mao"
              target="_blank"
              rel="noreferrer"
            >
              Source
            </a>
            <a href="https://buymeacoffee.com/winnerkarthik" target="_blank" rel="noreferrer">
              Buy the General a coffee
            </a>
            <span>MIT. Free forever.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Redact({ w, penalty = false }: { w: string; penalty?: boolean }) {
  return (
    <span
      className={`redact ${penalty ? "redact--penalty" : ""}`}
      style={{ width: w }}
      role="img"
      aria-label="redacted"
    >
      ████
    </span>
  );
}

function Faq({ q, children }: { q: string; children: ReactNode }) {
  return (
    <details className="faq-item">
      <summary>
        <span>{q}</span>
        <span className="faq-item__mark" aria-hidden="true">
          +
        </span>
      </summary>
      <p>{children}</p>
    </details>
  );
}
