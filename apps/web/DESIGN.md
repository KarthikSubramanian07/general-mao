# DESIGN.md, General Mao ("The Tribunal")

## Physical scene
A shuttered military tribunal at night. One hard overhead light on green baize. Oxblood
ink drying on a verdict. A stenographer's ledger recording every penalty in a typed
column. A brass seal catching the light. Nobody is having fun except the General.

## Color strategy, Committed, dark-first (OKLCH)
The mood lives in the felt, the oxblood accent, and the type, not in decoration.

- `--gm-ink` `oklch(0.165 0.008 265)`, app chrome, deep blue-black
- `--gm-ink-deep` `oklch(0.118 0.008 265)`, wells, footers, vignette
- `--gm-felt` `oklch(0.245 0.036 158)`, the table surface (deep baize)
- `--gm-felt-edge` `oklch(0.185 0.032 158)`, table vignette
- `--gm-surface-1/2/3` `oklch(0.205 / 0.235 / 0.275 · 0.008 265)`, panels
- `--gm-line` `oklch(0.320 0.008 265)`, `--gm-line-strong` `oklch(0.405 0.009 265)`
- `--gm-text` `oklch(0.955 0.004 265)`, `--gm-text-2` `oklch(0.740 0.006 265)`,
  `--gm-text-muted` `oklch(0.585 0.006 265)`
- `--gm-penalty` `oklch(0.585 0.190 24)`, THE accent (oxblood crimson); penalties/verdicts only
- `--gm-penalty-deep` `oklch(0.420 0.140 25)`, seal/stamp fills
- `--gm-brass` `oklch(0.755 0.090 82)`, the General's seal, rationed to the emblem
- `--gm-legal` `oklch(0.720 0.130 155)`, "a legal move", success (a cold jade, not the felt)
- `--gm-focus` `oklch(0.680 0.100 250)`, focus ring only

Deviation from the palette seed (sky blue 200°) is deliberate: the brand's identity is
felt-green + oxblood, and color IS voice here.

## Type, three registers, no reflex fonts
- **The General (display / pronouncements):** Zilla Slab. Institutional slab, deadpan,
  reads like a stamped government form. Weights 400/500/600/700.
- **Interface (cards, chat, buttons, labels):** Archivo (variable). A grotesque with
  backbone; not Inter/DM/Geist.
- **The ledger (court record):** Fragment Mono. Typewriter/transcript texture; justified
  because the ledger genuinely IS a machine record. `tabular-nums` on.

## Signature elements
1. **The ledger**, a stenographer's court record. Mono, square rows (radius 0), hairline
   separators, `tabular-nums`. Penalty rows carry an oxblood background tint and a small
   stamp glyph (never a side-stripe border). Screenshottable by default.
2. **Redaction**, secret rules render as `████` bars. The whole premise, made visible.
3. **The seal**, a brass wax-seal emblem that appears on verdicts and the wordmark.
4. **The penalty card**, slides in with weight; the cryptic reason types out one line.

## Motion
Product surfaces: 150-250ms, state-only. The penalty-card slide and the deal are the two
deliberate flourishes. Everything respects `prefers-reduced-motion` (crossfade/instant).

## Radii & elevation
Sharp: `--r-sm 2px`, `--r-md 4px`, `--r-lg 6px`. The ledger is square (0). Elevation is
shadow-as-hairline plus a low ambient shadow; no glow, no glass.
