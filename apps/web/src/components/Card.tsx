import type { Card, Suit } from "@mao/protocol";
import { cardColor } from "@mao/protocol";

const SUIT_GLYPH: Record<Suit, string> = {
  clubs: "♣",
  diamonds: "♦",
  hearts: "♥",
  spades: "♠",
};

export function PlayingCard({
  card,
  size = "md",
  playable = false,
  selected = false,
  fresh = false,
  onClick,
  ariaLabel,
}: {
  card: Card;
  size?: "sm" | "md" | "lg";
  playable?: boolean;
  selected?: boolean;
  fresh?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
}) {
  const red = cardColor(card) === "red";
  const glyph = SUIT_GLYPH[card.suit];
  const cls = [
    "card",
    `card--${size}`,
    red ? "card--red" : "card--black",
    playable ? "card--playable" : "",
    selected ? "card--selected" : "",
    fresh ? "card--fresh" : "",
    onClick ? "card--interactive" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const label = ariaLabel ?? `${card.rank} of ${card.suit}`;

  const inner = (
    <>
      <span className="card__corner card__corner--tl">
        <span className="card__rank">{card.rank}</span>
        <span className="card__pip">{glyph}</span>
      </span>
      <span className="card__center" aria-hidden="true">
        {glyph}
      </span>
      <span className="card__corner card__corner--br">
        <span className="card__rank">{card.rank}</span>
        <span className="card__pip">{glyph}</span>
      </span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={cls}
        onClick={onClick}
        aria-label={label}
        aria-pressed={selected}
      >
        {inner}
      </button>
    );
  }
  return (
    <div className={cls} role="img" aria-label={label}>
      {inner}
    </div>
  );
}

export function CardBack({ size = "sm" }: { size?: "sm" | "md" | "lg" }) {
  return (
    <div className={`card card--back card--${size}`} aria-hidden="true">
      <span className="card-back__mark">GM</span>
    </div>
  );
}

const STACK_LAYERS = ["a", "b", "c", "d"] as const;

export function CardStack({ count, size = "sm" }: { count: number; size?: "sm" | "md" }) {
  const shown = Math.min(Math.max(count, 1), 4);
  return (
    <div className={`card-stack card-stack--${size}`} role="img" aria-label={`${count} cards`}>
      {STACK_LAYERS.slice(0, shown).map((id, i) => (
        <div
          key={id}
          className="card-stack__layer"
          style={{ transform: `translate(${i * 2}px, ${i * -2}px)` }}
        >
          <CardBack size={size} />
        </div>
      ))}
    </div>
  );
}
