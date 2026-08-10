import { useEffect, useMemo, useRef, useState } from 'react'
import { useUiTheme } from '../../hooks/useUiTheme'
import { useUrielBus } from '../../store/urielBus'
import type { OsMap, RunSummary } from '../lib/runnerApi'
import type { LeadContact, NebulaLayout, NebulaNode, ViewMode } from './nebulaLayout'
import { buildLayout, getLayerColors, TOP } from './nebulaLayout'

/**
 * OsNebula — Canvas-Engine für den Agentic-OS-Graph im RUBRIC-Look:
 * Deep-Space-Hintergrund (Starfield + Nebel-Fog), Glow-Dots, langsamer
 * Ring-Spin, Kometen entlang der Bahnen, Hover = leuchten + Rest dimmt,
 * Suche filtert, Control-Panel rechts (Ansicht/Slider), Header links.
 * Drei Ansichten: Ringe · Nebula · Leads (Layout aus nebulaLayout.ts).
 */

interface Settings {
  view: ViewMode
  glow: number
  spin: number
  links: number
  comets: number
  labels: boolean
}

const SETTINGS_KEY = 'ck-nebula'

/**
 * Canvas kennt keine CSS-Variablen — die Schrift muss als Zeichenkette in den
 * 2D-Kontext. Eine Konstante statt fünf Literale, damit ein Font-Wechsel
 * (Phase 2: JetBrains Mono → Inter) genau eine Stelle hat.
 */
const CANVAS_FONT = "'Inter', system-ui, sans-serif"

function defaultSettings(): Settings {
  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const base: Settings = {
    view: 'rings',
    glow: 0.75,
    spin: reduced ? 0 : 0.35,
    links: 0.5,
    comets: reduced ? 0 : 0.55,
    labels: true,
  }
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) return { ...base, ...(JSON.parse(raw) as Partial<Settings>) }
  } catch {
    /* defaults */
  }
  return base
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r},${g},${b},${a})`
}

/** Theme-Palette des Graphen — aus den --ck-graph-*-Tokens (auf .ck-root) gelesen. */
interface GraphPalette {
  isLight: boolean
  bg: string
  star: string
  line: string
  core: string
  label: string
  panel: string
  /** Füllung von Discs/Hexes/Core — Kontrast zur (hellen bzw. dunklen) Layer-Farbe. */
  nodeFill: string
}

const GRAPH_DARK_FALLBACK = {
  bg: '#05080c',
  star: '#cfd8e3',
  line: '#f2f4f5',
  core: '#f2f4f5',
  label: '#9aa4a8',
  panel: 'rgba(8,12,17,0.92)',
}

const GRAPH_LIGHT_FALLBACK = {
  bg: '#eef1f4',
  star: '#9aa8b8',
  line: '#24303a',
  core: '#111827',
  label: '#46525a',
  panel: 'rgba(255,255,255,0.94)',
}

function readGraphPalette(el: HTMLElement | null, isLight: boolean): GraphPalette {
  // Die --ck-graph-*-Tokens leben auf .ck-root, nicht auf <html>. Beim allerersten
  // Render ist der Wrapper-Ref noch null → dann von .ck-root lesen (nicht von
  // documentElement, wo die Tokens fehlen und der Fallback sonst Dark liefert).
  const target =
    el ?? (typeof document === 'undefined' ? null : document.querySelector<HTMLElement>('.ck-root'))
  const styles = typeof window === 'undefined' || !target ? null : getComputedStyle(target)
  const fb = isLight ? GRAPH_LIGHT_FALLBACK : GRAPH_DARK_FALLBACK
  const v = (name: string, fallback: string) => styles?.getPropertyValue(name).trim() || fallback
  return {
    isLight,
    bg: v('--ck-graph-bg', fb.bg),
    star: v('--ck-graph-star', fb.star),
    line: v('--ck-graph-line', fb.line),
    core: v('--ck-graph-core', fb.core),
    label: v('--ck-graph-label', fb.label),
    panel: v('--ck-graph-panel', fb.panel),
    nodeFill: isLight ? '#ffffff' : '#0a0f15',
  }
}

/** Glow-Sprite pro Farbe (einmal offscreen gerendert, dann drawImage = billig). */
const spriteCache = new Map<string, HTMLCanvasElement>()
function glowSprite(color: string): HTMLCanvasElement {
  let c = spriteCache.get(color)
  if (c) return c
  c = document.createElement('canvas')
  c.width = 64
  c.height = 64
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, rgba(color, 0.85))
  grad.addColorStop(0.35, rgba(color, 0.28))
  grad.addColorStop(1, rgba(color, 0))
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  spriteCache.set(color, c)
  return c
}

interface Star {
  x: number
  y: number
  r: number
  a: number
  ph: number
}

interface Comet {
  /** rings/leads: Bahn-Radius; nebula: Ziel-Hub-Index */
  radius: number
  angle: number
  speed: number
  color: string
  hubId?: string
  offset: number
}

/** Layout-Fokus der Home (steuert Sidebar-Breite + Graph-Höhe) — als feine
 *  Buttons oben im Graphen, statt einer separaten Leiste über dem Dashboard. */
export type GraphFocus = 'tracking' | 'balanced' | 'graph'

interface OsNebulaProps {
  map: OsMap
  contacts: LeadContact[]
  /** Agenten-Läufe für die Workflows-Ansicht. */
  runs?: RunSummary[]
  onNodeClick?: (node: NebulaNode) => void
  /** Erzwingt frisches /os/map (Cache-Bypass) — Button im Steuerpanel. */
  onRefresh?: () => void
  height?: number
  /** Aktueller Layout-Fokus (für den Umschalter oben rechts). */
  focus?: GraphFocus
  /** Fokus umschalten — wirkt auf das Home-Grid (Sidebar/Graph). */
  onFocus?: (focus: 'tracking' | 'graph') => void
}

const VIEW_LABEL: Record<ViewMode, string> = {
  rings: 'Ringe',
  nebula: 'Nebula',
  leads: 'Leads',
  workflows: 'Agenten',
}
const SUBTITLE: Record<ViewMode, string> = {
  rings: 'CLAUDE.md ist der Router-Stern · jede Datei ein Körper im Orbit.',
  nebula: 'Jeder Bereich eine Galaxie · der Router hält sie zusammen.',
  leads: 'Sales innen · Loom · Kaltakquise außen — jeder Punkt ein Lead.',
  workflows: 'Jeder Agent ein Hub · seine Läufe als Speiche, Farbe = Status.',
}

export function OsNebula({ map, contacts, runs = [], onNodeClick, onRefresh, height = 620, focus, onFocus }: OsNebulaProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const tipRef = useRef<HTMLDivElement | null>(null)
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const [query, setQuery] = useState('')
  const [panelOpen, setPanelOpen] = useState(true)

  // Theme: Layer-Farben + Canvas-Palette (Dark/Light) — der rAF-Loop liest Refs,
  // damit der Theme-Wechsel sofort greift, ohne den Loop neu zu starten.
  const { isPlainLight } = useUiTheme()
  const layerColors = useMemo(() => getLayerColors(isPlainLight), [isPlainLight])
  const palette = useMemo(
    // Beim allerersten Render ist wrapRef noch null → documentElement/Dark-Fallbacks;
    // der Effect unten liest nach dem Mount vom Wrapper (innerhalb von .ck-root) nach.
    () => readGraphPalette(wrapRef.current, isPlainLight),
    [isPlainLight],
  )

  const layout = useMemo(
    () => buildLayout(settings.view, map, contacts, layerColors, runs),
    [settings.view, map, contacts, layerColors, runs],
  )

  // Refs für den rAF-Loop (kein Loop-Neustart bei State-Wechseln)
  const layoutRef = useRef<NebulaLayout>(layout)
  const settingsRef = useRef<Settings>(settings)
  const queryRef = useRef(query)
  const clickRef = useRef(onNodeClick)
  const paletteRef = useRef<GraphPalette>(palette)
  const layerColorsRef = useRef(layerColors)
  const needFitRef = useRef(true)
  // Theme-Flip baut das Layout nur wegen der Farben neu → Zoom/Pan dabei behalten.
  const themeFlipped = layerColorsRef.current !== layerColors
  if (layoutRef.current !== layout && !themeFlipped) needFitRef.current = true
  layoutRef.current = layout
  settingsRef.current = settings
  queryRef.current = query
  clickRef.current = onNodeClick
  paletteRef.current = palette
  layerColorsRef.current = layerColors

  useEffect(() => {
    // Nach Mount/Theme-Wechsel die Tokens direkt vom Wrapper (.ck-root-Scope) lesen
    // und die Glow-Sprites verwerfen, damit sie in den neuen Farben neu entstehen.
    paletteRef.current = readGraphPalette(wrapRef.current, isPlainLight)
    spriteCache.clear()
  }, [isPlainLight])

  const set = (patch: Partial<Settings>) =>
    setSettings((s) => {
      const next = { ...s, ...patch }
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
      } catch {
        /* egal */
      }
      return next
    })

  // Uriel-Command-Bus: der Assistent kann Ansicht/Suche fernsteuern. Wir wenden
  // die Anfrage auf den lokalen State an; manuelle Panel-Bedienung bleibt Quelle
  // der Wahrheit, Uriel injiziert nur. nonce erzwingt Wiederholbarkeit.
  const graphRequest = useUrielBus((s) => s.graphRequest)
  useEffect(() => {
    if (!graphRequest) return
    if (graphRequest.view) set({ view: graphRequest.view })
    if (graphRequest.query !== undefined) {
      setQuery(graphRequest.query)
      needFitRef.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphRequest])

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    const tip = tipRef.current
    if (!canvas || !wrap || !tip) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = wrap.clientWidth || 640
    const dpr = window.devicePixelRatio || 1
    const view = { x: 0, y: 0, k: 0.8 }
    let hoverId: string | null = null
    let stars: Star[] = []
    let comets: Comet[] = []
    let cometView: ViewMode | null = null
    let cometLight: boolean | null = null
    const t0 = performance.now()

    const makeStars = () => {
      const n = Math.round((width * height) / 8000)
      const r = mulberry(width * 7 + height)
      stars = Array.from({ length: n }, () => ({
        x: r() * width,
        y: r() * height,
        r: 0.35 + r() * 0.9,
        a: 0.05 + r() * 0.24,
        ph: r() * Math.PI * 2,
      }))
    }

    function mulberry(seed: number) {
      let a = seed >>> 0
      return () => {
        a |= 0
        a = (a + 0x6d2b79f5) | 0
        let t = Math.imul(a ^ (a >>> 15), 1 | a)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
      }
    }

    const makeComets = () => {
      const L = layoutRef.current
      const s = settingsRef.current
      cometView = L.view
      cometLight = paletteRef.current.isLight
      const n = Math.round(s.comets * 14)
      const r = mulberry(hashStr(L.view) + L.nodes.length)
      const hubs = L.nodes.filter((x) => x.kind === 'hub')
      comets = Array.from({ length: n }, () => {
        if (L.view === 'nebula' && hubs.length) {
          const hub = hubs[Math.floor(r() * hubs.length)]
          return {
            radius: 0,
            angle: 0,
            speed: 0.1 + r() * 0.12,
            color: layerColorsRef.current[hub.layer],
            hubId: hub.id,
            offset: r(),
          }
        }
        const band = L.bands[Math.floor(r() * Math.max(L.bands.length, 1))]
        const arcR = band ? band.arcs[Math.floor(r() * band.arcs.length)] : 200
        return {
          radius: arcR,
          angle: r() * Math.PI * 2,
          speed: (0.14 + r() * 0.2) * (r() > 0.5 ? 1 : -1),
          color: band?.color ?? paletteRef.current.star,
          offset: r(),
        }
      })
    }

    function hashStr(s: string): number {
      let h = 0
      for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
      return h >>> 0
    }

    const resize = () => {
      width = wrap.clientWidth || 640
      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      makeStars()
      needFitRef.current = true
    }
    resize()

    const cx = () => width / 2
    const cy = () => height / 2

    const fit = () => {
      const L = layoutRef.current
      view.k = Math.min(width, height) / (2 * (L.maxR + 32))
      view.x = 0
      view.y = 0
      needFitRef.current = false
    }

    /** Aktuelle Weltposition eines Nodes (inkl. Ring-Spin). */
    const posOf = (n: NebulaNode, t: number): { x: number; y: number } => {
      if (n.kind === 'core') return { x: 0, y: 0 }
      const a = n.angle + n.speed * settingsRef.current.spin * t
      return { x: Math.cos(a) * n.radius, y: Math.sin(a) * n.radius }
    }

    const toWorld = (sx: number, sy: number) => ({
      x: (sx - cx() - view.x) / view.k,
      y: (sy - cy() - view.y) / view.k,
    })

    const nodeAt = (sx: number, sy: number, t: number): NebulaNode | null => {
      const w = toWorld(sx, sy)
      let best: NebulaNode | null = null
      let bestD = Infinity
      for (const n of layoutRef.current.nodes) {
        const p = posOf(n, t)
        const dx = w.x - p.x
        const dy = w.y - p.y
        const hit = n.size + 6 / view.k
        const d = dx * dx + dy * dy
        if (d <= hit * hit && d < bestD) {
          best = n
          bestD = d
        }
      }
      return best
    }

    const matches = (n: NebulaNode, q: string) =>
      !q ||
      n.label.toLowerCase().includes(q) ||
      n.sub.toLowerCase().includes(q) ||
      (n.area?.toLowerCase().includes(q) ?? false)

    const drawCurvedLabel = (text: string, radius: number, color: string) => {
      const fs = 10.5
      ctx.font = `700 ${fs}px ${CANVAS_FONT}`
      const widths = [...text].map((ch) => ctx.measureText(ch).width + fs * 0.28)
      const totalAngle = widths.reduce((s, w) => s + w, 0) / radius
      let a = TOP - totalAngle / 2
      ctx.fillStyle = rgba(color, 0.55)
      for (let i = 0; i < text.length; i++) {
        const w = widths[i] / radius
        a += w / 2
        ctx.save()
        ctx.translate(Math.cos(a) * radius, Math.sin(a) * radius)
        ctx.rotate(a + Math.PI / 2)
        ctx.textAlign = 'center'
        ctx.fillText(text[i], 0, 0)
        ctx.restore()
        a += w / 2
      }
    }

    const hexPath = (x: number, y: number, r: number) => {
      ctx.beginPath()
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 2
        const px = x + Math.cos(a) * r
        const py = y + Math.sin(a) * r
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
    }

    let raf = 0
    const draw = () => {
      const L = layoutRef.current
      const s = settingsRef.current
      const P = paletteRef.current
      const C = layerColorsRef.current
      const q = queryRef.current.trim().toLowerCase()
      const t = (performance.now() - t0) / 1000
      if (needFitRef.current) fit()
      if (
        cometView !== L.view ||
        cometLight !== P.isLight ||
        comets.length !== Math.round(s.comets * 14)
      )
        makeComets()

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      // Deep Space
      ctx.fillStyle = P.bg
      ctx.fillRect(0, 0, width, height)
      for (const st of stars) {
        const tw = 0.72 + 0.28 * Math.sin(t * 0.7 + st.ph)
        ctx.globalAlpha = st.a * tw
        ctx.fillStyle = P.star
        ctx.beginPath()
        ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      ctx.translate(cx() + view.x, cy() + view.y)
      ctx.scale(view.k, view.k)

      // Nebel-Fog
      for (const f of L.fogs) {
        const fx = Math.cos(f.angle) * f.radius
        const fy = Math.sin(f.angle) * f.radius
        const grad = ctx.createRadialGradient(fx, fy, 0, fx, fy, f.r)
        grad.addColorStop(0, rgba(f.color, 0.055 * s.glow + 0.02))
        grad.addColorStop(1, rgba(f.color, 0))
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(fx, fy, f.r, 0, Math.PI * 2)
        ctx.fill()
      }

      // Ring-Guides (gepunktet) + gebogene Band-Labels
      for (const b of L.bands) {
        ctx.strokeStyle = rgba(b.color, 0.16)
        ctx.lineWidth = 1 / view.k
        ctx.setLineDash([1.3 / view.k, 6.5 / view.k])
        for (const r of b.arcs) {
          ctx.beginPath()
          ctx.arc(0, 0, r, 0, Math.PI * 2)
          ctx.stroke()
        }
        ctx.setLineDash([])
        if (s.labels) drawCurvedLabel(b.label, b.rLabel, b.color)
      }

      // Hover-Kontext
      const hover = hoverId ? L.byId.get(hoverId) : null
      const connected = new Set<string>()
      if (hover) {
        for (const e of L.edges) {
          if (e.a === hover.id) connected.add(e.b)
          if (e.b === hover.id) connected.add(e.a)
        }
      }

      const alphaFor = (n: NebulaNode): number => {
        if (q) return matches(n, q) ? 1 : 0.05
        if (hover) {
          if (n.id === hover.id) return 1
          if (connected.has(n.id)) return 0.95
          if (n.kind === 'core') return 0.55
          if (n.kind === 'hub' && n.area && n.area === hover.area) return 0.85
          return 0.13
        }
        return n.dim ? 0.42 : 1
      }

      // Kanten (Wikilinks) als Sehnen mit Zug zur Mitte
      if (s.links > 0.02 && L.edges.length) {
        for (const e of L.edges) {
          const na = L.byId.get(e.a)!
          const nb = L.byId.get(e.b)!
          const pa = posOf(na, t)
          const pb = posOf(nb, t)
          const hot = hover && (e.a === hover.id || e.b === hover.id)
          ctx.strokeStyle = rgba(
            C.memory,
            hot ? 0.6 : 0.05 * s.links * 2 * (hover || q ? 0.35 : 1),
          )
          ctx.lineWidth = (hot ? 1.3 : 0.8) / view.k
          ctx.beginPath()
          ctx.moveTo(pa.x, pa.y)
          ctx.quadraticCurveTo(((pa.x + pb.x) / 2) * 0.45, ((pa.y + pb.y) / 2) * 0.45, pb.x, pb.y)
          ctx.stroke()
        }
      }

      // Speichen Kern → Hubs
      for (const n of L.nodes) {
        if (n.kind !== 'hub') continue
        const p = posOf(n, t)
        ctx.strokeStyle = rgba(P.line, hover ? 0.02 : 0.045)
        ctx.lineWidth = 1 / view.k
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.lineTo(p.x, p.y)
        ctx.stroke()
      }
      // Speiche zum Hover-Node
      if (hover && hover.kind !== 'core') {
        const p = posOf(hover, t)
        ctx.strokeStyle = rgba(P.line, 0.22)
        ctx.lineWidth = 1 / view.k
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.lineTo(p.x, p.y)
        ctx.stroke()
      }

      // Kometen — Kontext, der durchs System fließt
      if (s.comets > 0.02) {
        for (const c of comets) {
          if (c.hubId) {
            const hub = L.byId.get(c.hubId)
            if (!hub) continue
            const hp = posOf(hub, t)
            const p = (t * c.speed + c.offset) % 1
            const px = hp.x * p
            const py = hp.y * p
            for (let k = 0; k < 4; k++) {
              const pp = Math.max(p - k * 0.012, 0)
              ctx.globalAlpha = (1 - p) * (1 - k / 4) * 0.7
              ctx.fillStyle = c.color
              ctx.beginPath()
              ctx.arc(hp.x * pp, hp.y * pp, (1.7 - k * 0.3) / Math.sqrt(view.k), 0, Math.PI * 2)
              ctx.fill()
            }
            ctx.globalAlpha = 1
            ctx.drawImage(glowSprite(c.color), px - 7, py - 7, 14, 14)
          } else {
            const a = c.angle + t * c.speed
            for (let k = 0; k < 5; k++) {
              const aa = a - Math.sign(c.speed) * k * 0.014
              ctx.globalAlpha = (1 - k / 5) * 0.75
              ctx.fillStyle = c.color
              ctx.beginPath()
              ctx.arc(
                Math.cos(aa) * c.radius,
                Math.sin(aa) * c.radius,
                (1.7 - k * 0.26) / Math.sqrt(view.k),
                0,
                Math.PI * 2,
              )
              ctx.fill()
            }
            ctx.globalAlpha = 1
            const hx = Math.cos(a) * c.radius
            const hy = Math.sin(a) * c.radius
            ctx.drawImage(glowSprite(c.color), hx - 7, hy - 7, 14, 14)
          }
        }
      }

      // Nodes: erst Dots, dann Discs/Hexes/Core obendrauf
      const pass = (kinds: (n: NebulaNode) => boolean) => {
        for (const n of L.nodes) {
          if (!kinds(n)) continue
          const alpha = alphaFor(n)
          if (alpha < 0.03) continue
          const p = posOf(n, t)
          const color = C[n.layer]
          const isHover = hover?.id === n.id

          ctx.globalAlpha = alpha
          if (n.shape === 'dot') {
            const gs = n.size * (3.4 + s.glow * 3.2) * (isHover ? 1.5 : 1)
            ctx.drawImage(glowSprite(color), p.x - gs / 2, p.y - gs / 2, gs, gs)
            ctx.fillStyle = isHover ? P.core : rgba(color, 0.95)
            ctx.beginPath()
            ctx.arc(p.x, p.y, n.size * (isHover ? 1.25 : 1), 0, Math.PI * 2)
            ctx.fill()
          } else {
            const gs = n.size * (3 + s.glow * 2) * (isHover ? 1.3 : 1)
            ctx.drawImage(glowSprite(color), p.x - gs / 2, p.y - gs / 2, gs, gs)
            ctx.fillStyle = P.nodeFill
            if (n.shape === 'hex') {
              hexPath(p.x, p.y, n.size)
              ctx.fill()
              if (n.status === 'geplant') ctx.setLineDash([2.5 / view.k, 2.5 / view.k])
              ctx.strokeStyle = rgba(color, isHover ? 1 : 0.85)
              ctx.lineWidth = 1.4 / view.k
              ctx.stroke()
              ctx.setLineDash([])
            } else {
              ctx.beginPath()
              ctx.arc(p.x, p.y, n.size, 0, Math.PI * 2)
              ctx.fill()
              ctx.strokeStyle = rgba(color, isHover ? 1 : 0.85)
              ctx.lineWidth = (n.kind === 'core' ? 1.7 : 1.3) / view.k
              ctx.stroke()
              if (n.kind === 'core') {
                const pulse = (Math.sin(t * 2) + 1) / 2
                ctx.beginPath()
                ctx.arc(p.x, p.y, n.size + 5 + pulse * 4, 0, Math.PI * 2)
                ctx.strokeStyle = rgba(P.core, 0.32 - pulse * 0.2)
                ctx.lineWidth = 1.2 / view.k
                ctx.stroke()
              }
            }
            if (n.glyph) {
              ctx.fillStyle = rgba(n.kind === 'core' ? P.core : color, 0.95)
              ctx.font = `700 ${n.size * 0.95}px ${CANVAS_FONT}`
              ctx.textAlign = 'center'
              ctx.textBaseline = 'middle'
              ctx.fillText(n.glyph, p.x, p.y + 0.5)
              ctx.textBaseline = 'alphabetic'
            }
          }

          // Labels: Core immer, Hubs ab 3 Objekten (kleine nur bei Hover/Zoom),
          // Apps/Routinen ab Zoom, Hover immer.
          const showLabel =
            (s.labels && n.kind === 'core') ||
            (s.labels && n.kind === 'hub' && ((n.count ?? 0) >= 3 || view.k >= 1.4)) ||
            isHover ||
            (s.labels && (n.kind === 'app' || n.kind === 'routine') && view.k >= 0.9)
          if (showLabel) {
            const fs = Math.max(8.5, 9.5 / view.k)
            ctx.font = `600 ${fs}px ${CANVAS_FONT}`
            ctx.textAlign = 'center'
            ctx.fillStyle = isHover ? P.core : rgba(P.label, 0.9)
            const label = n.label.length > 24 ? `${n.label.slice(0, 23)}…` : n.label
            ctx.fillText(label.toUpperCase(), p.x, p.y + n.size + fs + 3)
            if (n.kind === 'hub' && n.count != null) {
              ctx.fillStyle = rgba(color, 0.85)
              ctx.fillText(String(n.count), p.x, p.y + n.size + fs * 2 + 5)
            }
            if (n.kind === 'core') {
              ctx.fillStyle = rgba(P.label, 0.7)
              ctx.font = `500 ${fs * 0.85}px ${CANVAS_FONT}`
              ctx.fillText(n.sub.toUpperCase(), p.x, p.y + n.size + fs * 2 + 5)
            }
          }
          ctx.globalAlpha = 1
        }
      }
      pass((n) => n.shape === 'dot')
      pass((n) => n.shape !== 'dot')

      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)

    // --- Interaktion ---
    let panning = false
    let moved = false
    let last = { x: 0, y: 0 }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      const factor = Math.exp(-e.deltaY * 0.0015)
      const k = Math.min(4.5, Math.max(0.3, view.k * factor))
      const mx = sx - cx()
      const my = sy - cy()
      view.x = mx - ((mx - view.x) / view.k) * k
      view.y = my - ((my - view.y) / view.k) * k
      view.k = k
    }
    const onDown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      last = { x: e.clientX - rect.left, y: e.clientY - rect.top }
      panning = true
      moved = false
    }
    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      const t = (performance.now() - t0) / 1000
      if (panning) {
        view.x += sx - last.x
        view.y += sy - last.y
        if (Math.abs(sx - last.x) + Math.abs(sy - last.y) > 2) moved = true
        last = { x: sx, y: sy }
        return
      }
      const n = nodeAt(sx, sy, t)
      hoverId = n ? n.id : null
      canvas.style.cursor = n ? 'pointer' : 'grab'
      if (n) {
        tip.style.display = 'block'
        tip.style.left = `${Math.min(sx + 14, width - 240)}px`
        tip.style.top = `${sy + 14}px`
        const title = tip.firstElementChild as HTMLElement
        const sub = tip.lastElementChild as HTMLElement
        title.textContent = n.label
        title.style.color = layerColorsRef.current[n.layer]
        sub.textContent = n.sub.length > 130 ? `${n.sub.slice(0, 129)}…` : n.sub
      } else {
        tip.style.display = 'none'
      }
    }
    const onUp = (e: MouseEvent) => {
      if (panning && !moved) {
        const rect = canvas.getBoundingClientRect()
        const t = (performance.now() - t0) / 1000
        const n = nodeAt(e.clientX - rect.left, e.clientY - rect.top, t)
        if (n) {
          tip.style.display = 'none'
          clickRef.current?.(n)
        }
      }
      panning = false
    }
    const onLeave = () => {
      hoverId = null
      tip.style.display = 'none'
    }

    const ro = new ResizeObserver(() => resize())
    ro.observe(wrap)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('mousedown', onDown)
    canvas.addEventListener('mouseleave', onLeave)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('mousedown', onDown)
      canvas.removeEventListener('mouseleave', onLeave)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [height])

  const counts = useMemo(() => {
    const c = new Map<string, { color: string; n: number }>()
    for (const n of layout.nodes) {
      if (n.kind === 'hub' || n.kind === 'core') continue
      const key = n.layer
      const cur = c.get(key) ?? { color: layerColors[n.layer], n: 0 }
      cur.n += 1
      c.set(key, cur)
    }
    return [...c.entries()]
  }, [layout, layerColors])

  const slider = (label: string, key: 'glow' | 'spin' | 'links' | 'comets') => (
    <label style={{ display: 'block', marginTop: 7 }}>
      <span style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span className="ck-label">{label}</span>
        <span className="ck-label" style={{ opacity: 0.7 }}>
          {settings[key].toFixed(2)}
        </span>
      </span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={settings[key]}
        onChange={(e) => set({ [key]: Number(e.target.value) } as Partial<Settings>)}
        className="ck-nebula-slider"
        style={{ width: '100%', marginTop: 3 }}
        aria-label={label}
      />
    </label>
  )

  /** Feiner Segmented-Button — geteilt von Ansicht- und Fokus-Leiste. */
  const segBtn = (active: boolean, onClick: () => void, label: string, key: string) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        padding: '3px 8px',
        fontSize: 10,
        fontWeight: active ? 600 : 400,
        fontFamily: CANVAS_FONT,
        letterSpacing: '0.02em',
        border: 'none',
        borderRadius: 5,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        background: active ? 'color-mix(in srgb, var(--ck-accent) 18%, transparent)' : 'transparent',
        color: active ? 'var(--ck-accent)' : 'var(--ck-text-2)',
      }}
    >
      {label}
    </button>
  )

  return (
    <div ref={wrapRef} style={{ width: '100%', position: 'relative', background: 'var(--ck-graph-bg)' }}>
      <canvas
        ref={canvasRef}
        aria-label="Agentic-OS-Graph: Kern mit Ringen für Skills, Memory, Routines, Applications sowie Leads-Pipelines"
      />

      {/* Tooltip */}
      <div
        ref={tipRef}
        style={{
          display: 'none',
          position: 'absolute',
          maxWidth: 230,
          padding: '7px 10px',
          background: 'var(--ck-graph-panel)',
          border: '1px solid var(--ck-border-strong)',
          borderRadius: 'var(--ck-radius-innen)',
          pointerEvents: 'none',
          zIndex: 5,
          fontSize: 11,
          lineHeight: 1.45,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 11.5 }} />
        <div style={{ color: 'var(--ck-text-2)' }} />
      </div>

      {/* Header rechts oben — Ansicht-Umschalter immer sichtbar (nicht mehr im Panel) */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          right: 12,
          zIndex: 4,
          maxWidth: 'min(52%, 340px)',
          textAlign: 'right',
        }}
      >
        {/* Ansicht: Ringe · Nebula · Leads · Agenten */}
        <div
          style={{
            display: 'inline-flex',
            padding: 2,
            gap: 2,
            border: '1px solid var(--ck-border)',
            borderRadius: 7,
            background: 'var(--ck-graph-panel)',
            backdropFilter: 'blur(6px)',
          }}
        >
          {(['rings', 'nebula', 'leads', 'workflows'] as ViewMode[]).map((v) =>
            segBtn(settings.view === v, () => set({ view: v }), VIEW_LABEL[v], v),
          )}
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--ck-text-2)', marginTop: 5, pointerEvents: 'none' }}>
          {SUBTITLE[settings.view]}
        </div>
        <div style={{ fontSize: 9.5, color: 'var(--ck-text-3)', marginTop: 3, pointerEvents: 'none' }}>
          {layout.stats.items} Objekte · {layout.stats.links} Links
        </div>
      </div>

      {/* Control-Panel links: Fokus-Umschalter + ⚙ immer sichtbar, Detail-Panel klappt darunter auf */}
      <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 4, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
        {/* Immer sichtbar: Fokus (Tracking · Graph) + Panel-Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {onFocus ? (
            <div
              style={{
                display: 'inline-flex',
                padding: 2,
                gap: 2,
                border: '1px solid var(--ck-border)',
                borderRadius: 7,
                background: 'var(--ck-graph-panel)',
                backdropFilter: 'blur(6px)',
              }}
              title="Layout-Fokus: mehr Platz fürs Tracking oder für den Graphen"
            >
              {segBtn(focus === 'tracking', () => onFocus('tracking'), 'Tracking', 'foc-t')}
              {segBtn(focus === 'graph', () => onFocus('graph'), 'Graph', 'foc-g')}
            </div>
          ) : null}
          <button
            className="ck-btn"
            style={{ padding: '3px 8px', fontSize: 12 }}
            onClick={() => setPanelOpen((o) => !o)}
            aria-label={panelOpen ? 'Steuerung einklappen' : 'Steuerung öffnen'}
            aria-expanded={panelOpen}
            title="Steuerung"
          >
            ⚙
          </button>
        </div>

        {panelOpen ? (
          <div
            style={{
              width: 208,
              padding: '10px 12px 12px',
              background: 'var(--ck-graph-panel)',
              border: '1px solid var(--ck-border)',
              borderRadius: 'var(--ck-radius-innen)',
              backdropFilter: 'blur(6px)',
            }}
          >
            <input
              className="ck-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`${layout.stats.items} Objekte durchsuchen…`}
              aria-label="Graph durchsuchen"
              style={{ width: '100%', fontSize: 11, padding: '5px 8px' }}
            />

            {slider('Glow', 'glow')}
            {slider('Ring-Spin', 'spin')}
            {slider('Kanten', 'links')}
            {slider('Kometen', 'comets')}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
              <label style={{ display: 'flex', gap: 7, alignItems: 'center', fontSize: 11 }}>
                <input
                  type="checkbox"
                  checked={settings.labels}
                  onChange={(e) => set({ labels: e.target.checked })}
                  style={{ accentColor: 'var(--ck-accent)' }}
                />
                <span className="ck-label">Labels</span>
              </label>
              <span style={{ display: 'inline-flex', gap: 4 }}>
                <button
                  className="ck-btn"
                  style={{ fontSize: 10, padding: '2px 8px' }}
                  onClick={() => {
                    needFitRef.current = true
                    setQuery('')
                  }}
                  title="Zoom/Suche zurücksetzen"
                >
                  Reset
                </button>
                {onRefresh ? (
                  <button
                    className="ck-btn"
                    style={{ fontSize: 11, padding: '2px 7px' }}
                    onClick={onRefresh}
                    title="Daten neu laden (Cache umgehen)"
                    aria-label="Daten neu laden"
                  >
                    ⟳
                  </button>
                ) : null}
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '4px 10px',
                marginTop: 10,
                paddingTop: 8,
                borderTop: '1px solid var(--ck-border)',
              }}
            >
              {counts.map(([layer, { color, n }]) => (
                <span
                  key={layer}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10 }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: color,
                      boxShadow: `0 0 6px ${color}`,
                    }}
                  />
                  <span className="ck-label">
                    {layer} · {n}
                  </span>
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
