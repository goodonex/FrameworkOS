import type { OsMap, RunSummary } from '../lib/runnerApi'

/**
 * Nebula-Layout — pure, deterministische Layout-Builder für den OS-Graph
 * (RUBRIC-Vorbild aus den RoboNuggets-Videos): drei Ansichten auf dieselbe
 * Canvas-Engine. Kein Force-Sim: gepunktete Ring-Arcs bzw. Phyllotaxis-Cluster
 * mit seeded Jitter → organisch, aber stabil und sofort da.
 *
 *  - rings  … konzentrische Ring-Bänder (Skills innen → Apps außen), Ring-Spin
 *  - nebula … Galaxie-Cluster pro Bereich um den Kern ("Router")
 *  - leads  … 3 Lead-Pipelines als Ringe: Sales (innen) · Loom · Kaltakquise
 */

export type ViewMode = 'rings' | 'nebula' | 'leads' | 'workflows'

export type LayerId =
  | 'core'
  | 'skills'
  | 'memory'
  | 'routines'
  | 'apps'
  | 'sales'
  | 'loom'
  | 'kalt'
  | 'paused'
  | 'agent'
  | 'erledigt'
  | 'fehler'
  | 'läuft'

/**
 * Die Kategorie-Farben des Graphen (Phase 2, Zug A6).
 *
 * Ein Graph braucht unterscheidbare Kategorien — das ist Datenkodierung, nicht
 * Oberflächen-Schmuck, und deshalb der einzige Ort im Cockpit mit mehr als
 * einem Farbton. Was er NICHT mehr sein darf, ist ein Neon-Nebel neben einer
 * warmen Waldgrün-Welt: die Töne liegen jetzt alle in derselben Tonart
 * (gedämpft, mittlere Sättigung), und die vier Zustände holen sich die echten
 * Signal-Tokens — Erfolg = Akzent, Fehler = Rot, läuft = Gold-Kühl, ruhend =
 * neutral. Das Tokens-Doc deckt Kategoriefarben nicht ab; steht im
 * Entscheidungsblock.
 */
export const LAYER_COLOR: Record<LayerId, string> = {
  core: '#eaf0e6', // --ck-text-1
  skills: '#c9b27a', // warmes Beige (innen)
  memory: '#9fb8c4', // kühles Graublau
  routines: '#d9ab52', // Gold — wie --ck-warn
  apps: '#8fb8a8', // Salbei-Teal (außen)
  sales: '#aecfa4', // Akzent = Geld, nah am Kern
  loom: '#d3a98a', // Ton/Clay
  kalt: '#8a9bb5', // gedämpftes Blau
  paused: '#78857f', // neutral, wie --ck-idle
  agent: '#d9ab52', // Agent-Hub (Gold, wie Routinen)
  erledigt: '#aecfa4', // Run erfolgreich = Akzent
  fehler: '#e5484d', // Run fehlgeschlagen = --ck-danger
  'läuft': '#9fc7d1', // Run läuft gerade
}

/** Abgedunkelte Pendants (gleiche Farbtöne) — lesbar auf hellem Hintergrund. */
export const LAYER_COLOR_LIGHT: Record<LayerId, string> = {
  core: '#111827',
  skills: '#b45309', // orange (innen)
  memory: '#7c3aed', // violett
  routines: '#a16207', // gold
  apps: '#0369a1', // eis-blau (außen)
  sales: '#047857', // grün = Geld, nah am Kern
  loom: '#b45309', // amber
  kalt: '#2563eb', // blau
  paused: '#64748b', // grau
  agent: '#a16207', // Agent-Hub (gold)
  erledigt: '#047857', // Run erfolgreich
  fehler: '#dc2626', // Run fehlgeschlagen (rot)
  'läuft': '#0e7490', // Run läuft gerade (cyan)
}

export function getLayerColors(isLight: boolean): Record<LayerId, string> {
  return isLight ? LAYER_COLOR_LIGHT : LAYER_COLOR
}

export interface NebulaNode {
  id: string
  kind: 'core' | 'skill' | 'note' | 'routine' | 'app' | 'hub' | 'contact' | 'run'
  layer: LayerId
  label: string
  sub: string
  /** Polar um den Kern; x/y entstehen beim Zeichnen aus angle + Spin. */
  angle: number
  radius: number
  /** Ring-Spin-Geschwindigkeit (rad/s bei Spin-Regler = 1). */
  speed: number
  size: number
  shape: 'dot' | 'disc' | 'hex'
  /** Glyph im Hub-Kreis (Nummer/Buchstabe). */
  glyph?: string
  count?: number
  path?: string
  source?: string
  status?: string
  area?: string
  /** Nur auf Contact-Nodes gesetzt (Leads-Ansicht): Klickziel /sales/:id. */
  href?: string
  dim?: boolean
}

export interface NebulaEdge {
  a: string
  b: string
}

export interface RingBand {
  label: string
  color: string
  /** Radien der gepunkteten Guide-Arcs. */
  arcs: number[]
  rLabel: number
}

export interface FogBlob {
  angle: number
  radius: number
  r: number
  color: string
}

export interface NebulaLayout {
  view: ViewMode
  nodes: NebulaNode[]
  edges: NebulaEdge[]
  byId: Map<string, NebulaNode>
  bands: RingBand[]
  fogs: FogBlob[]
  maxR: number
  stats: { items: number; links: number }
}

/** Leads-Ansicht: schlanker Kontakt-Auszug aus dem CRM. */
export interface LeadContact {
  id: string
  name: string
  company: string
  pipeline_stage: string
  lead_value: number | null
  lead_source: string
}

const TAU = Math.PI * 2
export const TOP = -Math.PI / 2

// ---------- Seeded RNG (mulberry32 + String-Hash) ----------

function hash(str: string): number {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return h >>> 0
}

function rng(seed: string): () => number {
  let a = hash(seed)
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---------- Bausteine ----------

function coreNode(label: string, sub: string): NebulaNode {
  return {
    id: 'core',
    kind: 'core',
    layer: 'core',
    label,
    sub,
    angle: 0,
    radius: 0,
    speed: 0,
    size: 13,
    shape: 'disc',
    glyph: '✦',
  }
}

interface GroupSpec<T> {
  key: string
  label: string
  glyph: string
  items: T[]
}

/**
 * Verteilt Gruppen als zusammenhängende Winkel-Spannen auf einem Ring-Band
 * (Spanne ∝ Gruppengröße), Items rund um mehrere Sub-Arcs, Hub in Spannmitte.
 */
function groupedBand<T>(opts: {
  layer: LayerId
  groups: Array<GroupSpec<T>>
  arcs: number[]
  rHub: number
  speed: number
  seed: string
  minSpan?: number
  toNode: (item: T, angle: number, radius: number) => NebulaNode
  hubSub?: (g: GroupSpec<T>) => string
}): { nodes: NebulaNode[]; hubs: NebulaNode[] } {
  const { layer, groups, arcs, rHub, speed, seed, toNode } = opts
  const nodes: NebulaNode[] = []
  const hubs: NebulaNode[] = []
  const total = Math.max(
    groups.reduce((s, g) => s + g.items.length, 0),
    1,
  )
  const GAP = 0.07
  const minSpan = opts.minSpan ?? 0.22
  // Erst Spannen berechnen (∝ Größe, mit Mindestbreite), dann auf 2π normieren.
  const rawSpans = groups.map((g) => Math.max((g.items.length / total) * TAU, minSpan))
  const rawTotal = rawSpans.reduce((s, x) => s + x, 0) + GAP * groups.length
  const scale = TAU / rawTotal
  const rnd = rng(seed)

  let cursor = TOP
  groups.forEach((g, gi) => {
    const span = rawSpans[gi] * scale
    const gap = GAP * scale
    const start = cursor + gap / 2
    const inner = span

    hubs.push({
      id: `hub:${layer}:${g.key}`,
      kind: 'hub',
      layer,
      label: g.label,
      angle: start + inner / 2,
      radius: rHub,
      speed,
      size: 11,
      shape: 'disc',
      glyph: g.glyph,
      count: g.items.length,
      area: g.label,
      sub: opts.hubSub ? opts.hubSub(g) : `${g.items.length} Objekte in diesem Bereich`,
    })

    g.items.forEach((item, i) => {
      const arcR = arcs[i % arcs.length]
      const perArc = Math.ceil(g.items.length / arcs.length)
      const slot = Math.floor(i / arcs.length)
      const frac = perArc <= 1 ? 0.5 : (slot + 0.5) / perArc
      const angle = start + frac * inner + (rnd() - 0.5) * 0.02
      const radius = arcR + (rnd() - 0.5) * 7
      nodes.push(toNode(item, angle, radius))
    })

    cursor += span + gap
  })
  return { nodes, hubs }
}

const AREA_ORDER = [
  '00 Kontext',
  '01 Inbox',
  '02 Projekte',
  '03 Bereiche',
  '04 Ressourcen',
  '05 Ideen',
  '06 Daily Notes',
  '07 Templates',
  '09 Archiv',
  'Vault',
]

function memoryGroups(map: OsMap): Array<GroupSpec<OsMap['memory'][number]>> {
  const byArea = new Map<string, OsMap['memory']>()
  for (const m of map.memory) {
    const key = m.area || 'Vault'
    if (!byArea.has(key)) byArea.set(key, [])
    byArea.get(key)!.push(m)
  }
  return [...byArea.entries()]
    .sort((a, b) => {
      const ia = AREA_ORDER.indexOf(a[0])
      const ib = AREA_ORDER.indexOf(b[0])
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a[0].localeCompare(b[0])
    })
    .map(([area, items]) => ({
      key: area,
      label: area,
      glyph: /^\d\d/.test(area) ? area.slice(0, 2) : area[0].toUpperCase(),
      items: items.sort((x, y) => y.links - x.links || x.name.localeCompare(y.name)),
    }))
}

function noteNode(
  m: OsMap['memory'][number],
  angle: number,
  radius: number,
  speed: number,
): NebulaNode {
  return {
    id: `note:${m.path}`,
    kind: 'note',
    layer: 'memory',
    label: m.name,
    sub: m.area || 'Vault',
    angle,
    radius,
    speed,
    size: m.links >= 8 ? 4.4 : m.links >= 3 ? 3.4 : 2.5,
    shape: 'dot',
    path: m.path,
    area: m.area || 'Vault',
  }
}

function memoryEdgesFor(map: OsMap, byId: Map<string, NebulaNode>): NebulaEdge[] {
  const edges: NebulaEdge[] = []
  for (const e of map.memoryEdges) {
    const a = `note:${e.source}`
    const b = `note:${e.target}`
    if (byId.has(a) && byId.has(b)) edges.push({ a, b })
  }
  return edges
}

function finalize(
  view: ViewMode,
  nodes: NebulaNode[],
  edgesOf: (byId: Map<string, NebulaNode>) => NebulaEdge[],
  bands: RingBand[],
  fogs: FogBlob[],
  maxR: number,
  links: number,
): NebulaLayout {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const edges = edgesOf(byId)
  return {
    view,
    nodes,
    edges,
    byId,
    bands,
    fogs,
    maxR,
    stats: { items: nodes.filter((n) => n.kind !== 'hub' && n.kind !== 'core').length, links },
  }
}

// ---------- Ansicht 1: RINGE (RUBRIC-Ringview) ----------

export function buildRings(
  map: OsMap,
  colors: Record<LayerId, string> = LAYER_COLOR,
): NebulaLayout {
  const nodes: NebulaNode[] = [coreNode('URIEL', 'CLAUDE · DER ROUTER')]

  // SKILLS (innen, orange) — Gruppen Vault/Global
  const skills = groupedBand({
    layer: 'skills',
    seed: 'skills',
    groups: [
      {
        key: 'vault',
        label: 'Vault',
        glyph: 'V',
        items: map.skills.filter((s) => s.source === 'vault'),
      },
      {
        key: 'global',
        label: 'Global',
        glyph: 'G',
        items: map.skills.filter((s) => s.source !== 'vault'),
      },
    ],
    arcs: [96, 114],
    rHub: 105,
    speed: 0.02,
    toNode: (s, angle, radius) => ({
      id: s.id,
      kind: 'skill',
      layer: 'skills',
      label: s.name,
      sub: s.description,
      angle,
      radius,
      speed: 0.02,
      size: 3.4,
      shape: 'dot',
      path: s.path,
      source: s.source,
    }),
  })

  // MEMORY (violett, breitestes Band) — Gruppen = PARA-Bereiche
  const memSpeed = 0.011
  const memory = groupedBand({
    layer: 'memory',
    seed: 'memory',
    groups: memoryGroups(map),
    arcs: [168, 192, 216, 240],
    rHub: 204,
    speed: memSpeed,
    minSpan: 0.16,
    toNode: (m, angle, radius) => noteNode(m, angle, radius, memSpeed),
  })

  // ROUTINES (gold)
  const routines = groupedBand({
    layer: 'routines',
    seed: 'routines',
    groups: [{ key: 'all', label: 'Routinen', glyph: 'R', items: map.routines }],
    arcs: [290],
    rHub: 290,
    speed: -0.015,
    toNode: (r, angle) => ({
      id: r.id,
      kind: 'routine',
      layer: 'routines',
      label: r.name,
      sub: r.schedule,
      angle,
      radius: 290,
      speed: -0.015,
      size: 6.5,
      shape: 'disc',
      glyph: r.name[0]?.toUpperCase() ?? 'R',
    }),
  })

  // APPS (eis-blau, außen, Hexagone)
  const apps = groupedBand({
    layer: 'apps',
    seed: 'apps',
    groups: [{ key: 'all', label: 'Apps', glyph: 'A', items: map.apps }],
    arcs: [336],
    rHub: 336,
    speed: 0.008,
    toNode: (a, angle) => ({
      id: a.id,
      kind: 'app',
      layer: 'apps',
      label: a.name,
      sub: `${a.kind} · ${a.status}`,
      angle,
      radius: 336,
      speed: 0.008,
      size: 9,
      shape: 'hex',
      glyph: a.name[0]?.toUpperCase() ?? '?',
      status: a.status,
      dim: a.status === 'geplant',
    }),
  })

  // Routine-/App-Hubs weglassen (Bänder sind klein genug) — nur Skills/Memory-Hubs.
  nodes.push(...skills.nodes, ...skills.hubs, ...memory.nodes, ...memory.hubs)
  nodes.push(...routines.nodes, ...apps.nodes)

  const bands: RingBand[] = [
    { label: 'SKILLS', color: colors.skills, arcs: [96, 114], rLabel: 138 },
    { label: 'MEMORY', color: colors.memory, arcs: [168, 192, 216, 240], rLabel: 262 },
    { label: 'ROUTINES', color: colors.routines, arcs: [290], rLabel: 310 },
    { label: 'APPLICATIONS', color: colors.apps, arcs: [336], rLabel: 358 },
  ]

  const fogRnd = rng('fog-rings')
  const fogs: FogBlob[] = bands.map((b) => ({
    angle: fogRnd() * TAU,
    radius: b.arcs[Math.floor(b.arcs.length / 2)],
    r: 130,
    color: b.color,
  }))

  return finalize(
    'rings',
    nodes,
    (byId) => memoryEdgesFor(map, byId),
    bands,
    fogs,
    380,
    map.memoryEdges.length,
  )
}

// ---------- Ansicht 2: NEBULA (Galaxie-Cluster) ----------

export function buildNebula(
  map: OsMap,
  colors: Record<LayerId, string> = LAYER_COLOR,
): NebulaLayout {
  const nodes: NebulaNode[] = [coreNode('URIEL', 'CLAUDE · DER ROUTER')]

  interface Cluster {
    key: string
    label: string
    glyph: string
    layer: LayerId
    make: (angle: number, radius: number, i: number) => NebulaNode
    items: unknown[]
  }

  const allClusters: Cluster[] = [
    {
      key: 'skills',
      label: 'SKILLS',
      glyph: 'S',
      layer: 'skills',
      items: map.skills,
      make: (angle, radius, i) => {
        const s = map.skills[i]
        return {
          id: s.id,
          kind: 'skill',
          layer: 'skills',
          label: s.name,
          sub: s.description,
          angle,
          radius,
          speed: 0,
          size: 3.2,
          shape: 'dot',
          path: s.path,
          source: s.source,
        }
      },
    },
    ...memoryGroups(map).map<Cluster>((g) => ({
      key: `mem:${g.key}`,
      label: g.label,
      glyph: g.glyph,
      layer: 'memory',
      items: g.items,
      make: (angle, radius, i) => noteNode(g.items[i], angle, radius, 0),
    })),
    {
      key: 'routines',
      label: 'ROUTINES',
      glyph: 'R',
      layer: 'routines',
      items: map.routines,
      make: (angle, radius, i) => {
        const r = map.routines[i]
        return {
          id: r.id,
          kind: 'routine',
          layer: 'routines',
          label: r.name,
          sub: r.schedule,
          angle,
          radius,
          speed: 0,
          size: 5.5,
          shape: 'disc',
          glyph: r.name[0]?.toUpperCase() ?? 'R',
        }
      },
    },
    {
      key: 'apps',
      label: 'APPLICATIONS',
      glyph: 'A',
      layer: 'apps',
      items: map.apps,
      make: (angle, radius, i) => {
        const a = map.apps[i]
        return {
          id: a.id,
          kind: 'app',
          layer: 'apps',
          label: a.name,
          sub: `${a.kind} · ${a.status}`,
          angle,
          radius,
          speed: 0,
          size: 8,
          shape: 'hex',
          glyph: a.name[0]?.toUpperCase() ?? '?',
          status: a.status,
          dim: a.status === 'geplant',
        }
      },
    },
  ]
  const clusters = allClusters.filter((c) => c.items.length > 0)

  // Cluster-Zentren gleichmäßig um den Kern, große Cluster weiter außen.
  const fogs: FogBlob[] = []
  const R_CENTER = 235
  clusters.forEach((c, ci) => {
    const n = c.items.length
    const centerAngle = TOP + (ci / clusters.length) * TAU
    const rnd = rng(`cluster:${c.key}`)
    const centerR = R_CENTER + (rnd() - 0.5) * 60 + Math.min(n, 60) * 0.4
    const cx = Math.cos(centerAngle) * centerR
    const cy = Math.sin(centerAngle) * centerR
    const discR = 11 * Math.sqrt(n) + 14

    // Hub im Cluster-Zentrum
    nodes.push({
      id: `hub:${c.layer}:${c.key}`,
      kind: 'hub',
      layer: c.layer,
      label: c.label,
      sub: `${n} Objekte in diesem Bereich`,
      angle: centerAngle,
      radius: centerR,
      speed: 0,
      size: 11,
      shape: 'disc',
      glyph: c.glyph,
      count: n,
      area: c.label,
    })

    // Phyllotaxis-Scheibe (Sonnenblume) + Jitter = organischer Blob
    for (let i = 0; i < n; i++) {
      const fr = discR * Math.sqrt((i + 0.7) / n)
      const fa = i * 2.39996 + rnd() * 0.35
      const x = cx + Math.cos(fa) * fr + (rnd() - 0.5) * 6
      const y = cy + Math.sin(fa) * fr + (rnd() - 0.5) * 6
      const node = c.make(Math.atan2(y, x), Math.hypot(x, y), i)
      nodes.push(node)
    }

    fogs.push({ angle: centerAngle, radius: centerR, r: discR * 2.2, color: colors[c.layer] })
  })

  const maxR = 235 + 60 + 11 * Math.sqrt(Math.max(...clusters.map((c) => c.items.length), 1)) + 40

  return finalize(
    'nebula',
    nodes,
    (byId) => memoryEdgesFor(map, byId),
    [],
    fogs,
    maxR,
    map.memoryEdges.length,
  )
}

// ---------- Ansicht 3: LEADS (3 Pipelines) ----------

/**
 * Coach-Modell (Agentur Inkubator / Marcel Steljes, 2-Pipeline-Prinzip),
 * gemappt auf die vorhandenen CRM-Stages ohne DB-Migration:
 *  - Kaltakquise (außen) = first_contact  (Kontakt vor Antwort)
 *  - Loom-Pipeline (Mitte) = conversation (Loom gesendet) + follow_up (Chat/E-Mail-FU)
 *  - Sales-Pipeline (innen, am Geld) = proposal (Quali/Sales-Call) + deal (Kunde)
 *  - paused = grauer Außenarc.
 * Leads wandern von außen (Kaltakquise) über Loom in die Sales-Pipeline.
 * Feinere Stages (Loom offen/aufgenommen, No-Show …) bräuchten eine eigene Migration.
 */
const PIPELINES: Array<{
  layer: LayerId
  label: string
  arcs: number[]
  rHub: number
  rLabel: number
  speed: number
  stages: Array<{ key: string; label: string; glyph: string }>
}> = [
  {
    layer: 'sales',
    label: 'SALES-PIPELINE',
    arcs: [118, 142],
    rHub: 130,
    rLabel: 166,
    speed: 0.016,
    stages: [
      { key: 'proposal', label: 'Quali/Sales-Call', glyph: 'Q' },
      { key: 'deal', label: 'Kunde', glyph: '€' },
    ],
  },
  {
    layer: 'loom',
    label: 'LOOM-PIPELINE',
    arcs: [212, 234],
    rHub: 223,
    rLabel: 258,
    speed: -0.012,
    stages: [
      { key: 'conversation', label: 'Loom gesendet', glyph: 'L' },
      { key: 'follow_up', label: 'Follow-up', glyph: 'F' },
    ],
  },
  {
    layer: 'kalt',
    label: 'KALTAKQUISE',
    arcs: [300, 320],
    rHub: 310,
    rLabel: 344,
    speed: 0.009,
    stages: [{ key: 'first_contact', label: 'Erstkontakt', glyph: 'K' }],
  },
]

export function buildLeads(
  contacts: LeadContact[],
  colors: Record<LayerId, string> = LAYER_COLOR,
): NebulaLayout {
  const total = contacts.length
  const sumValue = contacts.reduce((s, c) => s + (c.lead_value ?? 0), 0)
  const nodes: NebulaNode[] = [
    coreNode(
      'PIPELINE',
      `${total} Leads · ${sumValue > 0 ? `${Math.round(sumValue / 1000)}k €` : 'Wert offen'}`,
    ),
  ]

  const contactNode = (
    c: LeadContact,
    layer: LayerId,
    angle: number,
    radius: number,
    speed: number,
  ): NebulaNode => ({
    id: `contact:${c.id}`,
    kind: 'contact',
    layer,
    label: c.company || c.name,
    sub: `${c.name}${c.lead_value ? ` · ${c.lead_value.toLocaleString('de-DE')} €` : ''}`,
    angle,
    radius,
    speed,
    size: 3.2 + Math.min((c.lead_value ?? 0) / 3000, 1) * 2.6,
    shape: 'dot',
    href: `/sales/${c.id}`,
    dim: c.pipeline_stage === 'paused',
  })

  const bands: RingBand[] = []
  for (const p of PIPELINES) {
    const groups = p.stages.map((st) => ({
      key: st.key,
      label: st.label,
      glyph: st.glyph,
      items: contacts.filter((c) => c.pipeline_stage === st.key),
    }))
    const band = groupedBand({
      layer: p.layer,
      seed: `leads:${p.layer}`,
      groups,
      arcs: p.arcs,
      rHub: p.rHub,
      speed: p.speed,
      minSpan: 0.5,
      toNode: (c, angle, radius) => contactNode(c, p.layer, angle, radius, p.speed),
      hubSub: (g) => `${g.items.length} Leads`,
    })
    nodes.push(...band.nodes, ...band.hubs)
    bands.push({ label: p.label, color: colors[p.layer], arcs: p.arcs, rLabel: p.rLabel })
  }

  // Pausierte Leads: dünner grauer Außenarc
  const paused = contacts.filter((c) => c.pipeline_stage === 'paused')
  if (paused.length > 0) {
    const rnd = rng('leads:paused')
    paused.forEach((c, i) => {
      const angle = TOP + (i / paused.length) * TAU + (rnd() - 0.5) * 0.05
      nodes.push(contactNode(c, 'paused', angle, 366, 0.004))
    })
    bands.push({ label: 'PAUSIERT', color: colors.paused, arcs: [366], rLabel: 386 })
  }

  const fogRnd = rng('fog-leads')
  const fogs: FogBlob[] = bands.slice(0, 3).map((b) => ({
    angle: fogRnd() * TAU,
    radius: b.arcs[0],
    r: 110,
    color: b.color,
  }))

  return finalize('leads', nodes, () => [], bands, fogs, paused.length ? 396 : 360, 0)
}

// ---------- Ansicht 4: WORKFLOWS (Agenten + ihre Läufe) ----------

const RUN_LAYER: Record<RunSummary['status'], LayerId> = {
  done: 'erledigt',
  error: 'fehler',
  running: 'läuft',
}

/**
 * Workflows-Ansicht (IDEAS-2026 G2): hebt die Agenten-Läufe aus der
 * Dokumenten-Liste in den Graphen. Jeder Agent = Hub im Innenring; seine letzten
 * Läufe hängen als Speiche daran (neuester am Hub), Farbe nach Status
 * (erledigt/fehler/läuft). Klick auf einen Lauf → RunDrawer.
 */
export function buildWorkflows(
  runs: RunSummary[],
  colors: Record<LayerId, string> = LAYER_COLOR,
): NebulaLayout {
  const nodes: NebulaNode[] = [
    coreNode('WORKFLOWS', runs.length ? `${runs.length} Läufe` : 'noch keine Läufe'),
  ]

  const byAgent = new Map<string, RunSummary[]>()
  for (const r of runs) {
    if (!byAgent.has(r.agent)) byAgent.set(r.agent, [])
    byAgent.get(r.agent)!.push(r)
  }
  for (const arr of byAgent.values()) {
    arr.sort((a, b) => String(b.started).localeCompare(String(a.started)))
  }
  const agents = [...byAgent.entries()].sort(
    (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]),
  )

  const rHub = 120
  const MAX_RUNS = 8
  const edges: NebulaEdge[] = []

  agents.forEach(([agent, agentRuns], ai) => {
    const angle = TOP + (ai / Math.max(agents.length, 1)) * TAU
    const hubId = `agenthub:${agent}`
    const errCount = agentRuns.filter((r) => r.status === 'error').length
    nodes.push({
      id: hubId,
      kind: 'hub',
      layer: 'agent',
      label: agent,
      sub: `${agentRuns.length} Läufe${errCount ? ` · ${errCount} Fehler` : ''}`,
      angle,
      radius: rHub,
      speed: 0,
      size: 11,
      shape: 'disc',
      glyph: agent[0]?.toUpperCase() ?? 'A',
      count: agentRuns.length,
      area: agent,
    })

    agentRuns.slice(0, MAX_RUNS).forEach((r, i) => {
      const id = `run:${r.id}`
      const when = (r.finished || r.started || '').slice(0, 10)
      nodes.push({
        id,
        kind: 'run',
        layer: RUN_LAYER[r.status],
        label: r.agent,
        sub: `${r.status === 'error' ? 'Fehler' : r.status === 'running' ? 'läuft…' : 'erledigt'}${
          when ? ` · ${when}` : ''
        }`,
        angle: angle + (i % 2 === 0 ? 1 : -1) * 0.014 * (i + 1),
        radius: rHub + 40 + i * 22,
        speed: 0,
        size: r.status === 'running' ? 6 : 4.4,
        shape: 'disc',
        path: r.id, // RunDrawer-Ziel
        status: r.status,
      })
      edges.push({ a: hubId, b: id })
    })
  })

  const bands: RingBand[] = [{ label: 'AGENTEN', color: colors.agent, arcs: [rHub], rLabel: rHub - 16 }]
  const maxR = rHub + 40 + MAX_RUNS * 22 + 30

  return finalize(
    'workflows',
    nodes,
    (byId) => edges.filter((e) => byId.has(e.a) && byId.has(e.b)),
    bands,
    [],
    maxR,
    edges.length,
  )
}

export function buildLayout(
  view: ViewMode,
  map: OsMap,
  contacts: LeadContact[],
  colors: Record<LayerId, string> = LAYER_COLOR,
  runs: RunSummary[] = [],
): NebulaLayout {
  if (view === 'nebula') return buildNebula(map, colors)
  if (view === 'leads') return buildLeads(contacts, colors)
  if (view === 'workflows') return buildWorkflows(runs, colors)
  return buildRings(map, colors)
}
