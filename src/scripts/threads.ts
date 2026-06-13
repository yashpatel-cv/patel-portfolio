/**
 * threads.ts — the orchestration-canvas runtime.
 *
 * Responsibilities:
 *  1. FlowCanvas    — measures DOM nodes inside every [data-canvas] figure and
 *                     draws SVG bezier "threads" between them; threads light up
 *                     (stroke-dash draw-in) when the canvas scrolls into view,
 *                     then carry a perpetual data-flow dash animation.
 *  2. Hero field    — a lightweight 2D-canvas particle network behind the hero.
 *  3. Terminal      — progressive type-in of the hero terminal card.
 *  4. Skill threads — hovering a skill chip highlights the case studies it
 *                     feeds; clicking scrolls to the first one.
 *  5. Nav           — scrolled state, mobile menu, scrollspy.
 *
 * Everything degrades gracefully: no JS → full static content; reduced
 * motion → no animation, instantly-lit threads.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------------------ */
/* Utilities                                                           */
/* ------------------------------------------------------------------ */

interface Edge {
  from: string;
  to: string;
  label?: string;
  kind?: 'flow' | 'reject';
}

function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  return el;
}

function cssVar(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const int = Number.parseInt(full, 16);
  if (Number.isNaN(int)) return `rgba(76, 195, 255, ${alpha})`;
  return `rgba(${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255}, ${alpha})`;
}

function safeParseEdges(json: string | undefined): Edge[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as Edge[]) : [];
  } catch {
    return [];
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ------------------------------------------------------------------ */
/* 1. Flow canvases                                                    */
/* ------------------------------------------------------------------ */

interface Anchors {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  axis: 'h' | 'v';
}

interface RelRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

function computeAnchors(a: RelRect, b: RelRect): Anchors {
  const acx = a.left + a.width / 2;
  const acy = a.top + a.height / 2;
  const bcx = b.left + b.width / 2;
  const bcy = b.top + b.height / 2;
  const dx = bcx - acx;
  const dy = bcy - acy;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return {
      x1: dx >= 0 ? a.left + a.width : a.left,
      y1: acy,
      x2: dx >= 0 ? b.left : b.left + b.width,
      y2: bcy,
      axis: 'h',
    };
  }
  return {
    x1: acx,
    y1: dy >= 0 ? a.top + a.height : a.top,
    x2: bcx,
    y2: dy >= 0 ? b.top : b.top + b.height,
    axis: 'v',
  };
}

function threadPath(p: Anchors): string {
  const { x1, y1, x2, y2, axis } = p;
  if (axis === 'h') {
    const bend = Math.max(Math.abs(x2 - x1) * 0.45, 26) * Math.sign(x2 - x1 || 1);
    return `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
  }
  const bend = Math.max(Math.abs(y2 - y1) * 0.45, 26) * Math.sign(y2 - y1 || 1);
  return `M ${x1} ${y1} C ${x1} ${y1 + bend}, ${x2} ${y2 - bend}, ${x2} ${y2}`;
}

class FlowCanvas {
  private readonly root: HTMLElement;
  private readonly svg: SVGSVGElement;
  private readonly edges: Edge[];
  private readonly id: string;
  private lit = false;
  private drawQueued = false;

  constructor(root: HTMLElement, index: number) {
    this.root = root;
    this.id = `${root.dataset.canvas || 'flow'}-${index}`;
    this.edges = safeParseEdges(root.dataset.edges);

    let svg = root.querySelector<SVGSVGElement>('svg.flow-threads');
    if (!svg) {
      svg = svgEl('svg', { class: 'flow-threads', 'aria-hidden': 'true' });
      root.prepend(svg);
    }
    this.svg = svg;

    const observer = new ResizeObserver(() => this.queueDraw());
    observer.observe(root);
  }

  queueDraw(): void {
    if (this.drawQueued) return;
    this.drawQueued = true;
    requestAnimationFrame(() => {
      this.drawQueued = false;
      this.draw();
    });
  }

  draw(): void {
    const width = this.root.clientWidth;
    const height = this.root.clientHeight;
    if (width === 0 || height === 0 || this.edges.length === 0) return;

    this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    this.svg.replaceChildren();

    const emerald = cssVar('--color-emerald', '#2ee6a8');
    const azure = cssVar('--color-azure', '#4cc3ff');
    const amber = cssVar('--color-amber', '#f5b950');

    /* defs: a canvas-wide gradient + arrowhead markers */
    const defs = svgEl('defs');
    const grad = svgEl('linearGradient', {
      id: `${this.id}-grad`,
      gradientUnits: 'userSpaceOnUse',
      x1: '0',
      y1: '0',
      x2: String(width),
      y2: String(height),
    });
    grad.appendChild(svgEl('stop', { offset: '0', 'stop-color': emerald }));
    grad.appendChild(svgEl('stop', { offset: '1', 'stop-color': azure }));
    defs.appendChild(grad);

    for (const [suffix, color] of [
      ['arrow', azure],
      ['arrow-warn', amber],
    ] as const) {
      const marker = svgEl('marker', {
        id: `${this.id}-${suffix}`,
        viewBox: '0 0 8 8',
        refX: '7',
        refY: '4',
        markerWidth: '7',
        markerHeight: '7',
        orient: 'auto-start-reverse',
      });
      marker.appendChild(
        svgEl('path', {
          d: 'M0,0.6 L7,4 L0,7.4',
          fill: 'none',
          stroke: color,
          'stroke-width': '1.5',
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
        }),
      );
      defs.appendChild(marker);
    }
    this.svg.appendChild(defs);

    const rootRect = this.root.getBoundingClientRect();
    const relRect = (el: Element): RelRect => {
      const r = el.getBoundingClientRect();
      return {
        left: r.left - rootRect.left,
        top: r.top - rootRect.top,
        width: r.width,
        height: r.height,
      };
    };

    this.edges.forEach((edge, i) => {
      const fromEl = this.root.querySelector(`[data-node="${CSS.escape(edge.from)}"]`);
      const toEl = this.root.querySelector(`[data-node="${CSS.escape(edge.to)}"]`);
      if (!fromEl || !toEl) return;

      const anchors = computeAnchors(relRect(fromEl), relRect(toEl));
      const d = threadPath(anchors);
      const isReject = edge.kind === 'reject';

      this.svg.appendChild(svgEl('path', { d, class: 'thread-base' }));

      const lit = svgEl('path', {
        d,
        class: `thread-lit${isReject ? ' kind-reject' : ''}`,
        stroke: isReject ? amber : `url(#${this.id}-grad)`,
        'marker-end': `url(#${this.id}-${isReject ? 'arrow-warn' : 'arrow'})`,
      });
      if (isReject) lit.setAttribute('stroke-dasharray', '5 4');
      this.svg.appendChild(lit);

      if (!isReject) {
        const length = lit.getTotalLength();
        lit.style.strokeDasharray = String(length);
        lit.style.strokeDashoffset = this.lit ? '0' : String(length);
        if (this.lit) lit.style.transition = 'none';
        else lit.style.transitionDelay = `${i * 160}ms`;

        const flow = svgEl('path', { d, class: 'thread-flow' });
        this.svg.appendChild(flow);
      }

      if (edge.label) {
        const text = svgEl('text', {
          x: String((anchors.x1 + anchors.x2) / 2),
          y: String((anchors.y1 + anchors.y2) / 2 - 9),
          'text-anchor': 'middle',
          class: `thread-label${isReject ? ' kind-reject' : ''}`,
        });
        text.textContent = edge.label;
        this.svg.appendChild(text);
      }
    });
  }

  activate(): void {
    if (this.lit) return;
    this.lit = true;
    this.root.classList.add('on');
    requestAnimationFrame(() => {
      this.svg
        .querySelectorAll<SVGPathElement>('.thread-lit:not(.kind-reject)')
        .forEach((path) => {
          path.style.strokeDashoffset = '0';
        });
    });
  }
}

function initFlows(): FlowCanvas[] {
  const flows: FlowCanvas[] = [];
  document.querySelectorAll<HTMLElement>('[data-canvas]').forEach((root, index) => {
    const flow = new FlowCanvas(root, index);
    flow.draw();
    flows.push(flow);

    if (REDUCED) {
      flow.activate();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            flow.activate();
            io.disconnect();
          }
        }
      },
      { threshold: 0.25 },
    );
    io.observe(root);
  });
  return flows;
}

/* ------------------------------------------------------------------ */
/* 2. Hero particle field                                              */
/* ------------------------------------------------------------------ */

interface FieldNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

function initHeroField(): void {
  const canvas = document.querySelector<HTMLCanvasElement>('[data-hero-field]');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const emerald = cssVar('--color-emerald', '#2ee6a8');
  const azure = cssVar('--color-azure', '#4cc3ff');
  const LINK_DIST = 150;

  let width = 0;
  let height = 0;
  let nodes: FieldNode[] = [];
  let running = false;
  let visible = true;
  let rafId = 0;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  function resize(): void {
    const parent = canvas!.parentElement;
    if (!parent) return;
    width = parent.clientWidth;
    height = parent.clientHeight;
    canvas!.width = Math.floor(width * dpr);
    canvas!.height = Math.floor(height * dpr);
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

    const target = Math.max(24, Math.min(64, Math.floor((width * height) / 26000)));
    nodes = Array.from({ length: target }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.32,
      vy: (Math.random() - 0.5) * 0.32,
      r: 1 + Math.random() * 1.6,
    }));
  }

  function frame(): void {
    ctx!.clearRect(0, 0, width, height);

    for (const node of nodes) {
      node.x += node.vx;
      node.y += node.vy;
      if (node.x < 0 || node.x > width) node.vx *= -1;
      if (node.y < 0 || node.y > height) node.vy *= -1;
    }

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]!;
        const b = nodes[j]!;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.hypot(dx, dy);
        if (dist > LINK_DIST) continue;
        const alpha = (1 - dist / LINK_DIST) * 0.22;
        ctx!.strokeStyle = hexToRgba((i + j) % 2 === 0 ? emerald : azure, alpha);
        ctx!.lineWidth = 1;
        ctx!.beginPath();
        ctx!.moveTo(a.x, a.y);
        ctx!.lineTo(b.x, b.y);
        ctx!.stroke();
      }
    }

    nodes.forEach((node, i) => {
      ctx!.fillStyle = hexToRgba(i % 3 === 0 ? emerald : azure, 0.6);
      ctx!.beginPath();
      ctx!.arc(node.x, node.y, node.r, 0, Math.PI * 2);
      ctx!.fill();
    });
  }

  function loop(): void {
    if (!running) return;
    frame();
    rafId = requestAnimationFrame(loop);
  }

  function setRunning(next: boolean): void {
    if (next === running) return;
    running = next;
    if (running) loop();
    else cancelAnimationFrame(rafId);
  }

  resize();

  if (REDUCED) {
    frame(); // single static render
    return;
  }

  new ResizeObserver(() => {
    resize();
    if (!running) frame();
  }).observe(canvas.parentElement ?? canvas);

  new IntersectionObserver(
    (entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      setRunning(visible && !document.hidden);
    },
    { threshold: 0.05 },
  ).observe(canvas);

  document.addEventListener('visibilitychange', () => {
    setRunning(visible && !document.hidden);
  });
}

/* ------------------------------------------------------------------ */
/* 3. Terminal type-in                                                 */
/* ------------------------------------------------------------------ */

function initTerminal(): void {
  const body = document.querySelector<HTMLElement>('[data-terminal]');
  if (!body || REDUCED) return;

  const rows = [...body.querySelectorAll<HTMLElement>('[data-term-row]')];
  if (rows.length === 0) return;

  interface RowParts {
    row: HTMLElement;
    cmd: HTMLElement;
    cmdText: string;
    out: HTMLElement | null;
  }

  const parts: RowParts[] = [];
  for (const row of rows) {
    const cmd = row.querySelector<HTMLElement>('.cmd');
    if (!cmd) continue;
    parts.push({ row, cmd, cmdText: cmd.textContent ?? '', out: row.querySelector('.term-out') });
    row.style.display = 'none';
  }

  const caret = document.createElement('span');
  caret.className = 'term-caret';
  caret.setAttribute('aria-hidden', 'true');

  async function run(): Promise<void> {
    for (const part of parts) {
      part.row.style.display = '';
      if (part.out) part.out.style.visibility = 'hidden';
      part.cmd.textContent = '';
      part.cmd.after(caret);

      for (const char of part.cmdText) {
        part.cmd.textContent += char;
        await sleep(20 + Math.random() * 26);
      }
      await sleep(160);
      if (part.out) part.out.style.visibility = '';
      await sleep(240);
    }
  }

  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        io.disconnect();
        void run();
      }
    },
    { threshold: 0.4 },
  );
  io.observe(body);
}

/* ------------------------------------------------------------------ */
/* 4. Skill chip → case-study threading                                */
/* ------------------------------------------------------------------ */

function initSkillLinks(): void {
  document.querySelectorAll<HTMLElement>('.chip[data-links]').forEach((chip) => {
    const targets = (chip.dataset.links ?? '')
      .split(',')
      .map((id) => document.getElementById(`project-${id.trim()}`))
      .filter((el): el is HTMLElement => el !== null);
    if (targets.length === 0) return;

    const setActive = (active: boolean): void => {
      chip.classList.toggle('active', active);
      targets.forEach((target) => target.classList.toggle('thread-target', active));
    };

    chip.addEventListener('mouseenter', () => setActive(true));
    chip.addEventListener('mouseleave', () => setActive(false));
    chip.addEventListener('focus', () => setActive(true));
    chip.addEventListener('blur', () => setActive(false));
    chip.addEventListener('click', () => {
      targets[0]?.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
    });
  });
}

/* ------------------------------------------------------------------ */
/* 5. Navigation                                                       */
/* ------------------------------------------------------------------ */

function initNav(): void {
  const nav = document.querySelector<HTMLElement>('.nav');
  if (!nav) return;

  const onScroll = (): void => {
    nav.classList.toggle('scrolled', window.scrollY > 8);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const toggle = nav.querySelector<HTMLButtonElement>('[data-nav-toggle]');
  toggle?.addEventListener('click', () => {
    const open = nav.classList.toggle('nav-open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  nav.querySelectorAll<HTMLAnchorElement>('.nav-mobile a').forEach((link) => {
    link.addEventListener('click', () => {
      nav.classList.remove('nav-open');
      toggle?.setAttribute('aria-expanded', 'false');
    });
  });

  /* scrollspy */
  const links = [...nav.querySelectorAll<HTMLAnchorElement>('.nav-link[href^="#"]')];
  const sections = links
    .map((link) => document.querySelector<HTMLElement>(link.hash))
    .filter((el): el is HTMLElement => el !== null);
  if (sections.length === 0) return;

  const spy = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const id = `#${entry.target.id}`;
        links.forEach((link) => {
          if (link.hash === id) link.setAttribute('aria-current', 'true');
          else link.removeAttribute('aria-current');
        });
      }
    },
    { rootMargin: '-40% 0px -55% 0px' },
  );
  sections.forEach((section) => spy.observe(section));
}

/* ------------------------------------------------------------------ */
/* 6. Scroll reveal                                                    */
/* ------------------------------------------------------------------ */

function initReveals(): void {
  const els = document.querySelectorAll<HTMLElement>('[data-reveal]');
  if (REDUCED) {
    els.forEach((el) => el.classList.add('revealed'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          io.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.15, rootMargin: '0px 0px -7% 0px' },
  );
  els.forEach((el) => io.observe(el));
}

/* ------------------------------------------------------------------ */
/* 7. Pointer spotlight on cards (desktop, fine pointers only)         */
/* ------------------------------------------------------------------ */

function initSpotlight(): void {
  if (REDUCED || !window.matchMedia('(pointer: fine)').matches) return;

  document
    .querySelectorAll<HTMLElement>('.node-card, .cluster-card, .metric, .term')
    .forEach((host) => {
      host.classList.add('spot-host');
      const layer = document.createElement('div');
      layer.className = 'spot-layer';
      layer.setAttribute('aria-hidden', 'true');
      host.prepend(layer);
    });

  let rafId = 0;
  document.addEventListener(
    'pointermove',
    (event) => {
      const host = (event.target as Element | null)?.closest?.('.spot-host') as HTMLElement | null;
      if (!host || rafId) return;
      const { clientX, clientY } = event;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        const rect = host.getBoundingClientRect();
        host.style.setProperty('--mx', `${(((clientX - rect.left) / rect.width) * 100).toFixed(2)}%`);
        host.style.setProperty('--my', `${(((clientY - rect.top) / rect.height) * 100).toFixed(2)}%`);
      });
    },
    { passive: true },
  );
}

/* ------------------------------------------------------------------ */
/* 8. Scroll-progress "live wire" along the nav                        */
/* ------------------------------------------------------------------ */

function initScrollProgress(): void {
  const nav = document.querySelector<HTMLElement>('.nav');
  if (!nav) return;

  let rafId = 0;
  const update = (): void => {
    rafId = 0;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const progress = max > 0 ? Math.min(window.scrollY / max, 1) : 0;
    nav.style.setProperty('--progress', progress.toFixed(4));
  };
  update();
  window.addEventListener(
    'scroll',
    () => {
      if (!rafId) rafId = requestAnimationFrame(update);
    },
    { passive: true },
  );
}

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

function boot(): void {
  const flows = initFlows();
  initHeroField();
  initTerminal();
  initSkillLinks();
  initNav();
  initReveals();
  initSpotlight();
  initScrollProgress();

  /* re-measure once webfonts settle — node sizes shift slightly */
  if ('fonts' in document) {
    document.fonts.ready.then(() => flows.forEach((flow) => flow.queueDraw())).catch(() => undefined);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}

export {};
