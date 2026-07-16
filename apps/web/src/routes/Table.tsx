import type { Card, Difficulty, PublicGameState, RulesetMode, SelfView, Suit } from "@mao/protocol";
import { cardId, SUITS } from "@mao/protocol";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { CardBack, CardStack, PlayingCard } from "../components/Card.js";
import { Chat } from "../components/Chat.js";
import { Ledger } from "../components/Ledger.js";
import { Seal, Wordmark } from "../components/Seal.js";
import { Toasts } from "../components/Toasts.js";
import { getName, setName as persistName } from "../lib/identity.js";
import { useTable } from "../lib/useTable.js";

const SUIT_GLYPH: Record<Suit, string> = { clubs: "♣", diamonds: "♦", hearts: "♥", spades: "♠" };

function isBaseLegal(state: PublicGameState, card: Card): boolean {
  if (!state.topCard) return true;
  return card.rank === state.topCard.rank || card.suit === state.activeSuit;
}

export function Table({ spectate = false }: { spectate?: boolean }) {
  const { code = "" } = useParams();
  const t = useTable(code.toUpperCase(), spectate);
  const { state, you, feed, toasts, send, dismissToast } = t;
  const [armedSuit, setArmedSuit] = useState<Suit | null>(null);
  const [railOpen, setRailOpen] = useState(false);
  const [freshCards, setFreshCards] = useState<Set<string>>(new Set());
  const prevIds = useRef<Set<string> | null>(null);

  // Mark newly-arrived cards so they play the deal/penalty slide. On first load
  // the whole opening hand is treated as already present (no mass animation).
  const handKey = you?.hand.map(cardId).join(",");
  // biome-ignore lint/correctness/useExhaustiveDependencies: handKey captures hand
  useEffect(() => {
    if (!you) return;
    const ids = new Set(you.hand.map(cardId));
    if (prevIds.current === null) {
      prevIds.current = ids;
      return;
    }
    const added = [...ids].filter((id) => !prevIds.current?.has(id));
    prevIds.current = ids;
    if (added.length === 0) return;
    setFreshCards(new Set(added));
    const timer = setTimeout(() => setFreshCards(new Set()), 440);
    return () => clearTimeout(timer);
  }, [handKey]);

  const nameMissing = !getName();
  useEffect(() => {
    if (nameMissing) {
      const n = window.prompt("How shall the General address you?", "")?.trim();
      if (n) {
        persistName(n);
        send({ t: "set-name", name: n });
      }
    }
  }, [nameMissing, send]);

  if (!state || !you) {
    return (
      <div className="table-loading">
        <Seal size={52} />
        <p className="gm-general" style={{ fontSize: "1.25rem" }}>
          Approaching the bench…
        </p>
        {t.status === "closed" && <p style={{ color: "var(--gm-text-muted)" }}>Reconnecting.</p>}
      </div>
    );
  }

  const phase = state.phase;
  const mySeat = you.seat;
  const isSeated = mySeat !== null;
  const isHost = you.isHost;
  const yourTurn = you.isYourTurn;

  const playCard = (card: Card) => {
    send({ t: "play", card: cardId(card), ...(armedSuit ? { declaredSuit: armedSuit } : {}) });
    setArmedSuit(null);
  };

  return (
    <div className="table-room">
      <header className="table-top">
        <Wordmark compact />
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <ShareCode code={code.toUpperCase()} />
          <ConnPill status={t.status} />
          <button
            type="button"
            className="btn btn--sm btn--ghost rail-toggle"
            onClick={() => setRailOpen((o) => !o)}
            aria-expanded={railOpen}
          >
            Ledger ({state.ledger.length})
          </button>
        </div>
      </header>

      <div className="table-board">
        <Seats state={state} youId={you.id} />

        {phase === "lobby" && (
          <Lobby
            state={state}
            you={you}
            isHost={isHost}
            isSeated={isSeated}
            onConfig={(c) => send({ t: "config", config: c })}
            onStart={() => send({ t: "start" })}
            onSit={() => send({ t: "sit" })}
            onStand={() => send({ t: "stand" })}
          />
        )}

        {(phase === "playing" || phase === "point-of-order") && (
          <>
            <div className="table-center">
              <Pile label="Draw">
                <CardStack count={state.drawPileCount} size="md" />
                <span className="pile__label">{state.drawPileCount} left</span>
              </Pile>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "0.6rem",
                }}
              >
                <DiscardPile state={state} />
                <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                  {state.activeSuit && (
                    <span className="suit-flag">
                      in force{" "}
                      <strong style={{ fontSize: "1.1rem" }}>{SUIT_GLYPH[state.activeSuit]}</strong>
                    </span>
                  )}
                  <span className="suit-flag">
                    {state.direction === 1 ? "↻ clockwise" : "↺ widdershins"}
                  </span>
                  {state.pendingDraw > 0 && (
                    <span className="suit-flag" style={{ color: "var(--gm-penalty)" }}>
                      draw {state.pendingDraw} owed
                    </span>
                  )}
                </div>
              </div>
            </div>

            {phase === "point-of-order" && (
              <div className="poo-banner">
                <span className="gm-general">Point of order. Cards down.</span>
                {isSeated && (
                  <button
                    type="button"
                    className="btn btn--sm"
                    onClick={() => send({ t: "end-point-of-order" })}
                  >
                    Resume play
                  </button>
                )}
              </div>
            )}

            {state.revealedRules && <KnownRules rules={state.revealedRules} />}

            {isSeated ? (
              <div className="hand-tray">
                <p className="turn-note gm-general">
                  {yourTurn ? "It is your move." : "The table waits."}
                </p>
                <div className="hand">
                  {you.hand.map((card) => {
                    const legal = isBaseLegal(state, card);
                    return (
                      <PlayingCard
                        key={cardId(card)}
                        card={card}
                        size="md"
                        playable={yourTurn && legal && phase === "playing"}
                        fresh={freshCards.has(cardId(card))}
                        onClick={yourTurn && phase === "playing" ? () => playCard(card) : undefined}
                      />
                    );
                  })}
                  {you.hand.length === 0 && (
                    <p style={{ color: "var(--gm-text-2)" }} className="gm-general">
                      Empty-handed. Now say the words.
                    </p>
                  )}
                </div>
                <div className="hand-actions">
                  <button
                    type="button"
                    className="btn"
                    disabled={!yourTurn || phase !== "playing"}
                    onClick={() => send({ t: "draw" })}
                  >
                    Draw a card
                  </button>
                  <SuitPicker armed={armedSuit} onArm={setArmedSuit} />
                  {phase === "playing" && (
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => send({ t: "point-of-order" })}
                    >
                      Point of order
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="hand-tray">
                <p className="gm-general" style={{ color: "var(--gm-text-2)" }}>
                  You are watching. The ledger is the whole story.
                </p>
              </div>
            )}
          </>
        )}

        {phase === "finished" && (
          <Finished state={state} isHost={isHost} onRematch={() => send({ t: "rematch" })} />
        )}
      </div>

      <aside className={`table-rail ${railOpen ? "table-rail--open" : ""}`}>
        <Ledger entries={state.ledger} />
        <Chat
          feed={feed}
          disabled={spectate || !isSeated}
          onSend={(text) => send({ t: "chat", text })}
        />
      </aside>

      <Toasts toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

function Pile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="pile" role="group" aria-label={label}>
      {children}
    </div>
  );
}

function DiscardPile({ state }: { state: PublicGameState }) {
  return (
    <div className="pile" role="group" aria-label="Discard pile">
      {state.topCard ? (
        <PlayingCard
          card={state.topCard}
          size="lg"
          ariaLabel={`Top card: ${state.topCard.rank} of ${state.topCard.suit}`}
        />
      ) : (
        <CardBack size="lg" />
      )}
      <span className="pile__label">Discard</span>
    </div>
  );
}

function Seats({ state, youId }: { state: PublicGameState; youId: string }) {
  return (
    <div className="seats">
      {state.players.map((p) => (
        <div
          key={p.id}
          className={`seat ${state.currentSeat === p.seat && state.phase === "playing" ? "seat--turn" : ""} ${
            p.finished ? "seat--out" : ""
          }`}
        >
          <span className={`seat__dot ${p.connected ? "" : "seat__dot--off"}`} />
          <div>
            <div className="seat__name">
              {p.name}
              {p.id === youId && <span className="chip">you</span>}
              {p.isHost && <span title="Host">✦</span>}
            </div>
            <div className="seat__meta">
              <span>{p.finished ? `#${p.place}` : `${p.handCount} cards`}</span>
              <span>{p.penaltyCount} pen.</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SuitPicker({ armed, onArm }: { armed: Suit | null; onArm: (s: Suit | null) => void }) {
  return (
    <div className="suit-picker" role="group" aria-label="Declare a suit for your next play">
      <span className="suit-picker__label">Declare</span>
      {SUITS.map((s) => (
        <button
          key={s}
          type="button"
          className={`suit-chip ${armed === s ? "suit-chip--on" : ""} suit-chip--${s}`}
          onClick={() => onArm(armed === s ? null : s)}
          aria-pressed={armed === s}
          title={`Declare ${s}`}
        >
          {SUIT_GLYPH[s]}
        </button>
      ))}
    </div>
  );
}

function KnownRules({ rules }: { rules: string[] }) {
  return (
    <div className="known-rules">
      <span className="gm-label">Known rules (practice)</span>
      <ul>
        {rules.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    </div>
  );
}

function Lobby({
  state,
  you,
  isHost,
  isSeated,
  onConfig,
  onStart,
  onSit,
  onStand,
}: {
  state: PublicGameState;
  you: SelfView;
  isHost: boolean;
  isSeated: boolean;
  onConfig: (c: { mode?: RulesetMode; difficulty?: Difficulty; maxPlayers?: number }) => void;
  onStart: () => void;
  onSit: () => void;
  onStand: () => void;
}) {
  const seated = state.players.length;
  return (
    <div className="lobby">
      <div className="lobby__panel gm-panel">
        <h2 className="gm-general">The bench is convening</h2>
        <p style={{ color: "var(--gm-text-2)" }}>
          {seated} of {state.config.maxPlayers} seated. Share the code; the General waits for no
          one, but the host does.
        </p>

        {isHost ? (
          <div className="lobby__config">
            <label className="field">
              <span>Ruleset</span>
              <select
                className="input"
                value={state.config.mode}
                onChange={(e) => onConfig({ mode: e.target.value as RulesetMode })}
              >
                <option value="classic">Classic, fully secret</option>
                <option value="themed">Themed deck</option>
                <option value="practice">Practice, rules shown</option>
              </select>
            </label>
            <label className="field">
              <span>Severity</span>
              <select
                className="input"
                value={state.config.difficulty}
                onChange={(e) => onConfig({ difficulty: e.target.value as Difficulty })}
              >
                <option value="gentle">Gentle</option>
                <option value="standard">Standard</option>
                <option value="brutal">Brutal</option>
              </select>
            </label>
          </div>
        ) : (
          <p className="gm-general" style={{ color: "var(--gm-text-muted)" }}>
            Waiting for the host to convene the table.
          </p>
        )}

        <div className="lobby__actions">
          {isHost && (
            <button
              type="button"
              className="btn btn--primary btn--lg"
              disabled={seated < 2}
              onClick={onStart}
            >
              Convene the table
            </button>
          )}
          {isSeated ? (
            <button type="button" className="btn btn--ghost" onClick={onStand}>
              Give up my seat
            </button>
          ) : (
            <button
              type="button"
              className="btn"
              onClick={onSit}
              disabled={seated >= state.config.maxPlayers}
            >
              Take a seat
            </button>
          )}
        </div>
        {isHost && seated < 2 && (
          <p style={{ color: "var(--gm-text-muted)", fontSize: "var(--fs-sm)" }}>
            The General requires at least two to hold court.
          </p>
        )}
        {!isSeated && !you.spectator && (
          <p style={{ color: "var(--gm-text-muted)", fontSize: "var(--fs-sm)" }}>
            You are spectating this table.
          </p>
        )}
      </div>
    </div>
  );
}

function Finished({
  state,
  isHost,
  onRematch,
}: {
  state: PublicGameState;
  isHost: boolean;
  onRematch: () => void;
}) {
  const standings = [...state.players].sort((a, b) => (a.place ?? 99) - (b.place ?? 99));
  const winner = standings[0];
  return (
    <div className="finished">
      <div className="finished__verdict">
        <Seal size={64} tone="penalty" />
        <h2 className="gm-general" style={{ fontSize: "2rem" }}>
          The game of Mao has ended.
        </h2>
        {winner && (
          <p className="gm-general" style={{ color: "var(--gm-brass)", fontSize: "1.25rem" }}>
            {winner.name} broke the pattern first.
          </p>
        )}
      </div>

      <div className="finished__cols">
        <div className="gm-panel finished__standings">
          <span className="gm-label">Final standing</span>
          <ol>
            {standings.map((p) => (
              <li key={p.id}>
                <span>{p.name}</span>
                <span className="gm-mono">{p.penaltyCount} pen.</span>
              </li>
            ))}
          </ol>
        </div>

        {state.revealedRules && (
          <div className="gm-panel finished__reveal">
            <span className="gm-label">The rules, at last</span>
            <ul>
              {state.revealedRules.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {isHost && (
        <button type="button" className="btn btn--primary btn--lg" onClick={onRematch}>
          Convene again, new secret rules
        </button>
      )}
    </div>
  );
}

function ShareCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const url = `${location.origin}/t/${code}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };
  return (
    <button type="button" className="chip share-code" onClick={copy} title="Copy invite link">
      <span className="gm-mono">{code}</span>
      <span>{copied ? "copied" : "share"}</span>
    </button>
  );
}

function ConnPill({ status }: { status: "connecting" | "open" | "closed" }) {
  const label =
    status === "open" ? "in session" : status === "connecting" ? "connecting" : "reconnecting";
  return (
    <span className="chip" title={`Connection: ${status}`}>
      <span className={`seat__dot ${status === "open" ? "" : "seat__dot--off"}`} />
      {label}
    </span>
  );
}
