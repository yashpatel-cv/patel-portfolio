# Design Plan — premium, human-crafted feel

> Goal: the portfolio must read as intentionally designed by a senior
> human, not generated. Created 2026-06-14. Builds on the existing
> "orchestration canvas" system — this refines, it does not restart.

## What already works (keep)

- Cohesive dark system: `void → bg → panel` depth ramp, emerald + azure +
  amber accents on a near-black canvas. Restrained, not rainbow.
- Real type pairing: Space Grotesk (display) + JetBrains Mono (code/labels).
- Signature element: SVG threads drawn from live DOM geometry, reduced-
  motion aware. This is the "human, intentional" hook — protect it.
- Blueprint dot-grid canvas, custom scrollbar — small craft signals.

## "AI-generated" smells to hunt and remove

These are the tells that make a site feel machine-made. Audit each:

1. **Even, mechanical rhythm.** Equal padding on every section, every card
   the same height. Fix: deliberate asymmetry — vary section spacing, let
   one feature break the grid.
2. **Generic gradient blobs / glassmorphism.** If present, replace with the
   thread/blueprint motif that's already the site's identity.
3. **Centered everything.** Introduce an editorial left-aligned column with
   intentional negative space; reserve centering for true focal moments.
4. **Uniform emoji/icon bullets.** Use the `kind` taxonomy (trigger/infra/
   compute/ml/guard/output) for meaningful iconography, not decoration.
5. **Flat, default-weight copy.** Tighten headline tracking, vary weight
   between display and body, use the mono face for metadata only.

## Refinements (impact ÷ effort)

### P1
- **Micro-interactions with intent.** Thread nodes should respond to hover
  (subtle glow + connected-edge highlight), not just exist. Cursor-aware
  parallax on the hero canvas, ≤ 6px, disabled under reduced-motion.
- **Type scale discipline.** Lock a modular scale (e.g. 1.25 ratio) and a
  max measure (~68ch) for prose. Inconsistent sizes read amateur.
- **Motion easing.** Replace any linear/ease transitions with a custom
  cubic-bezier (e.g. `cubic-bezier(.22,1,.36,1)`) for a designed feel.

### P2
- **Depth via light, not borders.** Lean on the panel ramp + soft inner
  shadows / 1px top highlight instead of flat `--color-line` boxes.
- **Accent discipline.** Emerald = primary action/active; azure = data/
  links; amber = sparingly for one "alive" highlight. Document the rule in
  `content.json` usage so it stays consistent.
- **Loading/scroll choreography.** Stagger section reveals on first scroll
  (small translate + fade, 40–60ms stagger), reduced-motion → instant.

### P3
- **Detail polish.** Selection color, focus-visible rings tuned to emerald,
  tabular-nums for metrics, optical alignment of the thread endpoints.
- **Favicon / OG image** that matches the canvas motif (not a default).

## Guardrails

- All motion must honor `prefers-reduced-motion` (already the baseline).
- Zero-JS path must still render complete content (already true — keep it).
- No new runtime dependency for effects; the dependency-free `threads.ts`
  renderer stays the only animation engine.
- Every visual value stays a token in `global.css`; no inline magic colors.
