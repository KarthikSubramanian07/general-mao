import type { LedgerEntry } from "@mao/protocol";
import { cardLabel } from "@mao/protocol";

export function Ledger({ entries }: { entries: LedgerEntry[] }) {
  return (
    <section className="ledger" aria-label="The General's ledger">
      <header className="ledger__head">
        <h2 className="ledger__title">The Ledger</h2>
        <span className="ledger__count">
          {entries.length} {entries.length === 1 ? "entry" : "entries"}
        </span>
      </header>
      <div className="ledger__scroll">
        {entries.length === 0 ? (
          <p className="ledger__empty">
            The record is clean.
            <br />
            It will not stay that way.
          </p>
        ) : (
          entries.map((e) => (
            <div key={e.seq} className="ledger-row ledger-row--penalty">
              <span className="ledger-row__seq">{String(e.seq).padStart(2, "0")}</span>
              <span className="ledger-row__body">
                <span className="ledger-row__who">{e.playerName}</span>
                <span className="ledger-row__reason">{e.reason}</span>
                {e.card && <span className="ledger-row__card">on the {cardLabel(e.card)}</span>}
              </span>
              <span className="ledger-row__stamp" title={`${e.penaltyCards} penalty cards`}>
                +{e.penaltyCards} ✦
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
