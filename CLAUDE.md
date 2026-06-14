# Agent rules — read before editing

Any AI agent (Claude Code, Cursor, etc.) **must** follow these rules on every
edit in this repo. They are non-negotiable.

## Standing rules

1. **Minimalist, anti-bloat.** No over-engineering, no unnecessary
   dependencies, no speculative abstraction. Lean, readable, simple. Prefer
   deleting code to adding it. Justify every new dependency.
2. **Zero hardcoded domains or secrets.** Domains, addresses, keys live only
   in `.env` / `.env.example`. Code reads them as variables. Never inline a
   real value.
3. **Small, atomic commits.** One logical change per commit. Commit messages
   in Conventional Commits style, subject **under 20 words**, no fluff.
4. **Strict LF line endings.** `.gitattributes` enforces `eol=lf`. Verify LF
   before committing (dev is Windows, deploy is Linux ARM64).
5. **Premium, human-crafted design.** UI must feel intentionally designed,
   not AI-generated. Honor the existing token system in
   `src/styles/global.css`; no inline magic colors. See `docs/DESIGN-PLAN.md`.

## This repo

`patel-portfolio` — Astro 5 static site, Tailwind v4, dependency-free
`threads.ts` renderer. All content from `src/content/content.json` (build-
time validated by `src/lib/content.ts`). Zero-JS path must render complete
content. All motion honors `prefers-reduced-motion`.
