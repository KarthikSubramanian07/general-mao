/**
 * The General's seal: a stamped official chop. The signature mark of the brand.
 * A double-ruled square frame with a slab monogram and a single star. Brass by
 * default; oxblood when it certifies a verdict.
 */
export function Seal({
  size = 40,
  tone = "brass",
  title = "The General's seal",
}: {
  size?: number;
  tone?: "brass" | "penalty" | "ink";
  title?: string;
}) {
  const color =
    tone === "penalty"
      ? "var(--gm-penalty)"
      : tone === "ink"
        ? "var(--gm-text-2)"
        : "var(--gm-brass)";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label={title}
      style={{ color, flexShrink: 0 }}
    >
      <title>{title}</title>
      <g fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3.5" y="3.5" width="41" height="41" rx="2" />
        <rect x="7" y="7" width="34" height="34" rx="1.5" strokeWidth="1" opacity="0.65" />
      </g>
      <path
        d="M24 11.2l1.9 4.1 4.5.5-3.35 3.02.95 4.43L24 20.9l-4.05 2.37.95-4.43-3.35-3.02 4.5-.5z"
        fill="currentColor"
        opacity="0.9"
      />
      <text
        x="24"
        y="37"
        textAnchor="middle"
        fontFamily="var(--font-general)"
        fontWeight="700"
        fontSize="12"
        letterSpacing="0.5"
        fill="currentColor"
      >
        GM
      </text>
    </svg>
  );
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.6rem" }}>
      <Seal size={compact ? 28 : 34} />
      <span
        className="gm-general"
        style={{
          fontWeight: 600,
          fontSize: compact ? "1.05rem" : "1.2rem",
          letterSpacing: "0.01em",
          color: "var(--gm-text)",
        }}
      >
        General&nbsp;Mao
      </span>
    </span>
  );
}
