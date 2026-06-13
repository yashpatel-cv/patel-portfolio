# yash.patel — the holder of threads

Premium dark-mode portfolio for **Yash Patel** (Full-Stack Developer · n8n Certified Professional),
designed as a **Yantresh orchestration canvas**: every section is a node, every skill a thread.
SVG connection lines light up on scroll, tracing data flows from core skills into three
production-grade case studies — including the **Yantresh — AI Workforce OS** architecture
(Five Bounds doctrine, ModelRouter/LiteLLM seam, Amatya/Karta loop).

## Stack

| Layer     | Choice                                            | Why                                                            |
| --------- | ------------------------------------------------- | -------------------------------------------------------------- |
| Framework | Astro 5 (static output)                           | zero-JS-by-default HTML, components, build-time validation     |
| Styling   | Tailwind CSS 4 (`@tailwindcss/vite`)              | token-driven theme (`@theme`), no runtime CSS                  |
| Runtime   | `threads.ts` — dependency-free vanilla TS         | SVG thread renderer, particle field, terminal, scrollspy       |
| Serving   | `nginxinc/nginx-unprivileged:1.27-alpine`         | non-root, port 8080, multi-arch (arm64/amd64)                  |

## Architecture: strict data separation

**No personal data or project copy lives in any component.** Everything renders from one file:

```
src/content/content.json   ← every word, metric, skill, diagram node & edge
src/lib/content.ts         ← typed seam + build-time validation
```

`content.ts` fails the build with a precise error if a diagram edge references a missing node,
a skill links to an unknown project, or a required section is empty. Edit `content.json`,
rebuild, done — the layout is a pure function of the data.

Diagrams (`projects[].diagram`, `architecture.router.diagram`, the skills constellation) are
node/edge graphs: nodes carry `col`/`row` grid coordinates and a `kind` (trigger / infra /
compute / ml / guard / output); edges become animated SVG beziers drawn by
`src/scripts/threads.ts` from real DOM geometry — they re-route automatically on resize and
collapse to vertical flows on mobile.

```
src/
├── content/content.json        # the single source of truth
├── lib/content.ts              # types + validation
├── styles/global.css           # design tokens + component layer
├── scripts/threads.ts          # the orchestration-canvas runtime
├── layouts/Base.astro          # head/meta/JSON-LD shell
├── pages/index.astro           # section assembly
└── components/
    ├── NavBar.astro            ├── Hero.astro
    ├── Metrics.astro           ├── SkillsConstellation.astro
    ├── FlowDiagram.astro       ├── ProjectNode.astro
    ├── YantreshArchitecture.astro
    ├── ExperienceThread.astro  ├── ContactSection.astro
    └── Footer.astro
```

## Local development

```bash
npm ci          # deterministic install (lockfile committed)
npm run dev     # http://localhost:4321
npm run check   # astro type-check (also runs inside the Docker build)
npm run build   # static output → dist/
```

## Deploy — Oracle ARM (Ampere A1)

All images are multi-arch; no x86-native dependencies exist anywhere in the chain
(Astro/Tailwind resolve pure-JS packages on arm64).

**Local preview / standalone** — this repo's own `docker-compose.yml`
builds and runs the image directly, no TLS:

```bash
docker compose up -d --build
# → http://<host>:8080      health: http://<host>:8080/healthz
```

**Production** — `.github/workflows/build-push.yml` builds multi-arch
images and pushes to `ghcr.io/<owner>/patel-portfolio` on every push to
`main`. The `yantresh-hub` repo pulls that image, fronts it with Caddy
(TLS via `ACME_EMAIL`), and routes `{$DOMAIN}` to it — see
`yantresh-hub/DEPLOY.md`. This repo's `docker-compose.yml` is not used in
that path.

The runtime container is hardened: non-root (UID 101), read-only filesystem with a 16 MB
tmpfs, `cap_drop: ALL`, `no-new-privileges`, CSP/security headers, gzip, immutable caching
for hashed assets, 128 MB memory cap.

## Accessibility & motion

Semantic landmarks, skip link, focus-visible rings, `aria-current` scrollspy, and full
`prefers-reduced-motion` support — threads render pre-lit, particles render a single static
frame, terminal types instantly. No JavaScript → complete static content, no blank shells.
