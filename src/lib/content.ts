/**
 * content.ts — the single seam between data and layout.
 *
 * Every component imports `content` from this module. The raw JSON is
 * validated at build time: missing sections, empty collections, or diagram
 * edges that reference non-existent nodes fail the build with a precise
 * error instead of shipping a silently broken canvas.
 */
import raw from '../content/content.json';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type NodeKind = 'trigger' | 'infra' | 'compute' | 'ml' | 'guard' | 'output';
export type EdgeKind = 'flow' | 'reject';
export type StatusKind = 'live' | 'dev';
export type CtaKind = 'primary' | 'ghost';

export interface DiagramNode {
  id: string;
  title: string;
  sub?: string;
  kind?: NodeKind;
  col: number;
  row: number;
}

export interface DiagramEdge {
  from: string;
  to: string;
  label?: string;
  kind?: EdgeKind;
}

export interface Diagram {
  cols: number;
  caption?: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

export interface Meta {
  title: string;
  description: string;
  themeColor: string;
  language: string;
  author: string;
  keywords: string[];
}

export interface Brand {
  mark: string;
  wordmark: string;
  tagline: string;
}

export interface NavLink {
  label: string;
  href: string;
}

export interface Nav {
  ariaLabel: string;
  links: NavLink[];
  cta: NavLink;
}

export interface TerminalLine {
  cmd: string;
  out: string;
}

export interface Hero {
  status: string;
  kicker: string;
  name: string;
  role: string;
  headline: { lead: string; emphasis: string; trail: string };
  subhead: string;
  location: string;
  ctas: { label: string; href: string; kind: CtaKind }[];
  terminal: { title: string; lines: TerminalLine[] };
}

export interface Metric {
  value: string;
  label: string;
  detail?: string;
}

export interface SkillItem {
  name: string;
  links?: string[];
}

export interface SkillCluster {
  id: string;
  title: string;
  position: { col: number; row: number };
  items: SkillItem[];
}

export interface Skills {
  id: string;
  kicker: string;
  heading: string;
  intro: string;
  core: { id: string; title: string; sub: string };
  clusters: SkillCluster[];
  edges: DiagramEdge[];
}

export interface Highlight {
  title: string;
  body: string;
}

export interface DoctrineBound {
  n: string;
  name: string;
  limit: string;
  breach: string;
}

export interface YantreshArchitecture {
  doctrine: {
    kicker: string;
    heading: string;
    intro: string;
    bounds: DoctrineBound[];
    guards: { name: string; body: string }[];
    guarantee: string;
  };
  router: {
    kicker: string;
    heading: string;
    intro: string;
    diagram: Diagram;
    routes: { step: string; model: string; why: string }[];
  };
}

export interface Project {
  id: string;
  codename: string;
  name: string;
  status: { label: string; kind: StatusKind };
  role: string;
  period: string;
  summary: string;
  problem: string;
  approach: string;
  diagram: Diagram;
  highlights: Highlight[];
  metrics: Metric[];
  stack: string[];
  architecture?: YantreshArchitecture;
}

export interface Projects {
  id: string;
  kicker: string;
  heading: string;
  intro: string;
  items: Project[];
}

export interface ExperienceItem {
  role: string;
  company: string;
  period: string;
  location: string;
  projectId?: string;
  bullets: string[];
}

export interface Experience {
  id: string;
  kicker: string;
  heading: string;
  items: ExperienceItem[];
  education: { credential: string; school: string; period: string }[];
  certifications: { name: string; issuer: string; note?: string }[];
}

export interface Contact {
  id: string;
  kicker: string;
  heading: string;
  body: string;
  email: string;
  channels: { label: string; value: string; href?: string }[];
}

export interface Footer {
  note: string;
  stack: string;
  copyright: string;
}

export interface SiteContent {
  meta: Meta;
  brand: Brand;
  nav: Nav;
  hero: Hero;
  metrics: { ariaLabel: string; items: Metric[] };
  skills: Skills;
  projects: Projects;
  experience: Experience;
  contact: Contact;
  footer: Footer;
}

/* ------------------------------------------------------------------ */
/* Build-time validation                                               */
/* ------------------------------------------------------------------ */

function fail(path: string, message: string): never {
  throw new Error(`[content.json] ${path}: ${message}`);
}

function assertNonEmpty(value: unknown, path: string): void {
  if (typeof value === 'string' && value.trim().length > 0) return;
  if (Array.isArray(value) && value.length > 0) return;
  fail(path, 'is missing or empty');
}

function validateDiagram(diagram: Diagram, path: string): void {
  assertNonEmpty(diagram.nodes, `${path}.nodes`);
  assertNonEmpty(diagram.edges, `${path}.edges`);
  const ids = new Set<string>();
  for (const node of diagram.nodes) {
    assertNonEmpty(node.id, `${path}.nodes[].id`);
    assertNonEmpty(node.title, `${path}.nodes[${node.id}].title`);
    if (ids.has(node.id)) fail(path, `duplicate node id "${node.id}"`);
    ids.add(node.id);
  }
  for (const edge of diagram.edges) {
    if (!ids.has(edge.from)) fail(path, `edge references unknown node "${edge.from}"`);
    if (!ids.has(edge.to)) fail(path, `edge references unknown node "${edge.to}"`);
  }
}

function validate(data: SiteContent): SiteContent {
  assertNonEmpty(data.meta?.title, 'meta.title');
  assertNonEmpty(data.meta?.description, 'meta.description');
  assertNonEmpty(data.hero?.name, 'hero.name');
  assertNonEmpty(data.hero?.role, 'hero.role');
  assertNonEmpty(data.hero?.headline?.emphasis, 'hero.headline.emphasis');
  assertNonEmpty(data.metrics?.items, 'metrics.items');
  assertNonEmpty(data.skills?.clusters, 'skills.clusters');
  assertNonEmpty(data.experience?.items, 'experience.items');
  assertNonEmpty(data.contact?.email, 'contact.email');

  if (data.projects.items.length !== 3) {
    fail('projects.items', `expected exactly 3 project nodes, found ${data.projects.items.length}`);
  }

  // Skill constellation: cluster cards + core behave as diagram nodes.
  const clusterIds = new Set<string>([data.skills.core.id, ...data.skills.clusters.map((c) => c.id)]);
  for (const edge of data.skills.edges) {
    if (!clusterIds.has(edge.from) || !clusterIds.has(edge.to)) {
      fail('skills.edges', `edge ${edge.from} → ${edge.to} references unknown cluster`);
    }
  }

  const projectIds = new Set<string>();
  for (const project of data.projects.items) {
    validateDiagram(project.diagram, `projects.${project.id}.diagram`);
    assertNonEmpty(project.highlights, `projects.${project.id}.highlights`);
    assertNonEmpty(project.stack, `projects.${project.id}.stack`);
    projectIds.add(project.id);
    if (project.architecture) {
      validateDiagram(project.architecture.router.diagram, `projects.${project.id}.architecture.router.diagram`);
      assertNonEmpty(project.architecture.doctrine.bounds, `projects.${project.id}.architecture.doctrine.bounds`);
    }
  }

  // Skill → project links must resolve to a real case study.
  for (const cluster of data.skills.clusters) {
    for (const item of cluster.items) {
      for (const link of item.links ?? []) {
        if (!projectIds.has(link)) {
          fail(`skills.${cluster.id}.${item.name}`, `links to unknown project "${link}"`);
        }
      }
    }
  }

  // Experience → project references must resolve as well.
  for (const xp of data.experience.items) {
    if (xp.projectId && !projectIds.has(xp.projectId)) {
      fail(`experience.${xp.company}`, `references unknown project "${xp.projectId}"`);
    }
  }

  return data;
}

export const content: SiteContent = validate(raw as unknown as SiteContent);
