# Accessibility

Conformance target: **WCAG 2.2 Level AA**.

## What was tested

- Automated: axe-core (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`) on `/`, `/about`, `/contact`, `/privacy`, `/play`, 404, themed play, and table lobby/rail, at 1440×900, 390×844, and 320×800.
- Manual: keyboard operation of play forms and table controls, skip link, focus visibility, name dialog (Escape does not dismiss without a name), ledger rail Escape, live status announcements, pause, colour-independent suit and turn cues, reflow at 320 px, `prefers-reduced-motion`.

## How to report a barrier

Open an issue at https://github.com/KarthikSubramanian07/general-mao/issues or email the address on the Contact page. Describe the page, the assistive technology or browser, and what you expected.

## Known limitations

- The felt table is a spatial layout. Opponent hands are summarized by count, not by listing each hidden card. Playable cards in your hand are real buttons with names.
- Secret rules stay secret by design; practice mode reveals them in text. The live region announces turns, top card, suit in force, draws owed, and outcomes, not the hidden laws.
- Full multiplayer mid-hand states depend on a live Worker; lobby and static routes are always available offline in local preview.
