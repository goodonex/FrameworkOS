/**
 * Mitschrift eines Agenten-Laufs (O17, 07.08.2026).
 *
 * **Warum es das gibt.** Der Runner startete `claude -p --output-format text`.
 * Dabei kommt auf stdout *nichts*, bis der Lauf fertig ist — der ganze Text
 * erscheint am Ende in einem Rutsch. Wird der Prozess vorher abgeschossen, ist
 * die Ausgabe leer: genau das steht in neun Run-Dateien seit dem 03.08.
 * („Run fehlgeschlagen (Exit 143)" · „kein Output"). Ein Timeout zu ändern,
 * ohne zu wissen, wo die Zeit hingeht, wäre Raten.
 *
 * Mit `--output-format stream-json --verbose` liefert die CLI stattdessen eine
 * Zeile JSON je Ereignis. Dieses Modul macht daraus ein lesbares Protokoll mit
 * Zeitstempeln — und hält nebenbei das Endergebnis fest, damit die Run-Datei
 * bei Erfolg **exakt** so aussieht wie vorher (die Freigaben-Queue liest den
 * ```json-Block daraus; ein Formatwechsel dort wäre ein stiller Bruch).
 *
 * Reine Funktionen, kein Dateisystem — `npx tsx scripts/verify-agent-stream.ts`.
 */

/** Werkzeug-Argument, das den Aufruf erkennbar macht (erste Wahl zuerst). */
const ARG_FELDER = [
  'file_path',
  'path',
  'command',
  'pattern',
  'url',
  'query',
  'description',
  'prompt',
  'notebook_path',
]

/** `+MM:SS`, ab einer Stunde `+H:MM:SS`. Negatives/Unsinniges wird zu `+00:00`. */
export function seitStart(ms) {
  const s = Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : 0
  const std = Math.floor(s / 3600)
  const min = Math.floor((s % 3600) / 60)
  const sek = s % 60
  const zz = (n) => String(n).padStart(2, '0')
  return std > 0 ? `+${std}:${zz(min)}:${zz(sek)}` : `+${zz(min)}:${zz(sek)}`
}

function kuerze(text, max = 70) {
  const s = String(text ?? '').replace(/\s+/g, ' ').trim()
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

/** Das Argument, an dem man einen Werkzeug-Aufruf wiedererkennt. */
export function werkzeugArgument(input) {
  if (!input || typeof input !== 'object') return ''
  for (const feld of ARG_FELDER) {
    const wert = input[feld]
    if (typeof wert === 'string' && wert.trim()) return kuerze(wert)
  }
  return ''
}

export function neuerLauf(startMs = 0) {
  return {
    startMs,
    zeilen: [],
    /** Endtext des Agenten — nur gesetzt, wenn das `result`-Ereignis kam. */
    ergebnis: null,
    /** Kennzahlen aus dem `result`-Ereignis (Dauer, Züge, Kosten). */
    meta: null,
    /** Zeilen, die kein JSON waren — bei einem Formatwechsel der CLI der erste Hinweis. */
    unlesbar: 0,
    /** Werkzeug-Aufrufe nach Name, für die Auswertung „wo ging die Zeit hin". */
    werkzeuge: {},
    /** Zeichen, die der Agent gedacht hat (Denktiefe, siehe O17 Schritt 2). */
    denkZeichen: 0,
  }
}

function schreibe(lauf, jetztMs, text) {
  lauf.zeilen.push(`[${seitStart(jetztMs - lauf.startMs)}] ${text}`)
}

/**
 * Verarbeitet **eine** Zeile des Streams. Unbekannte Ereignisse werden bewusst
 * verschluckt statt geloggt — die CLI erfindet laufend neue Untertypen, und ein
 * Protokoll, das bei jedem Update zurauscht, liest niemand mehr.
 */
export function nimmZeile(lauf, rohZeile, jetztMs) {
  const zeile = String(rohZeile ?? '').trim()
  if (!zeile) return
  let ev
  try {
    ev = JSON.parse(zeile)
  } catch {
    lauf.unlesbar += 1
    return
  }
  if (!ev || typeof ev !== 'object') {
    lauf.unlesbar += 1
    return
  }

  if (ev.type === 'system' && ev.subtype === 'init') {
    const werkzeuge = Array.isArray(ev.tools) ? ev.tools.length : 0
    schreibe(lauf, jetztMs, `Sitzung gestartet · ${werkzeuge} Werkzeuge · ${kuerze(ev.cwd ?? '', 60)}`)
    return
  }

  if (ev.type === 'assistant' && ev.message) {
    const inhalt = Array.isArray(ev.message.content) ? ev.message.content : []
    for (const teil of inhalt) {
      if (!teil || typeof teil !== 'object') continue
      if (teil.type === 'text' && String(teil.text ?? '').trim()) {
        schreibe(lauf, jetztMs, `Text (${String(teil.text).length} Z.) · ${kuerze(teil.text, 60)}`)
      } else if (teil.type === 'thinking') {
        const n = String(teil.thinking ?? '').length
        lauf.denkZeichen += n
        schreibe(lauf, jetztMs, `Denkt (${n} Z.)`)
      } else if (teil.type === 'tool_use') {
        const name = String(teil.name ?? 'Werkzeug')
        lauf.werkzeuge[name] = (lauf.werkzeuge[name] ?? 0) + 1
        const arg = werkzeugArgument(teil.input)
        schreibe(lauf, jetztMs, `→ ${name}${arg ? `  ${arg}` : ''}`)
      }
    }
    return
  }

  if (ev.type === 'user' && ev.message) {
    const inhalt = Array.isArray(ev.message.content) ? ev.message.content : []
    for (const teil of inhalt) {
      if (!teil || typeof teil !== 'object' || teil.type !== 'tool_result') continue
      const roh = teil.content
      const laenge =
        typeof roh === 'string'
          ? roh.length
          : Array.isArray(roh)
            ? roh.reduce((n, t) => n + String(t?.text ?? '').length, 0)
            : 0
      schreibe(lauf, jetztMs, teil.is_error ? `↳ FEHLER (${laenge} Z.)` : `↳ ${laenge} Z.`)
    }
    return
  }

  // Nur melden, wenn das Limit wirklich greift — „allowed" ist kein Ereignis.
  if (ev.type === 'rate_limit_event' && ev.rate_limit_info?.status && ev.rate_limit_info.status !== 'allowed') {
    schreibe(lauf, jetztMs, `⚠ Rate-Limit: ${ev.rate_limit_info.status}`)
    return
  }

  if (ev.type === 'result') {
    const dauer = Number(ev.duration_ms)
    lauf.meta = {
      dauerMs: Number.isFinite(dauer) ? dauer : null,
      zuege: Number.isFinite(Number(ev.num_turns)) ? Number(ev.num_turns) : null,
      kostenUsd: Number.isFinite(Number(ev.total_cost_usd)) ? Number(ev.total_cost_usd) : null,
      fehler: Boolean(ev.is_error),
      subtype: typeof ev.subtype === 'string' ? ev.subtype : null,
    }
    if (typeof ev.result === 'string') lauf.ergebnis = ev.result
    const teile = [`Fertig (${ev.subtype ?? '—'})`]
    if (Number.isFinite(dauer)) teile.push(`${(dauer / 1000).toFixed(1)}s`)
    if (lauf.meta.zuege != null) teile.push(`${lauf.meta.zuege} Züge`)
    if (lauf.meta.kostenUsd != null) teile.push(`$${lauf.meta.kostenUsd.toFixed(4)}`)
    schreibe(lauf, jetztMs, teile.join(' · '))
  }
}

/** Zerlegt einen stdout-Brocken in vollständige Zeilen; der Rest bleibt im Puffer. */
export function nimmBrocken(lauf, puffer, brocken, jetztMs) {
  const text = puffer + String(brocken)
  const teile = text.split('\n')
  const rest = teile.pop() ?? ''
  for (const zeile of teile) nimmZeile(lauf, zeile, jetztMs)
  return rest
}

/**
 * Was wirklich Zeit gekostet hat — eine Zeile, die man morgens um sieben
 * begreift, ohne das Protokoll zu lesen.
 */
export function laufBilanz(lauf) {
  const werkzeuge = Object.entries(lauf.werkzeuge).sort((a, b) => b[1] - a[1])
  const summe = werkzeuge.reduce((n, [, k]) => n + k, 0)
  return {
    werkzeugAufrufe: summe,
    werkzeuge,
    denkZeichen: lauf.denkZeichen,
    ereignisse: lauf.zeilen.length,
    unlesbar: lauf.unlesbar,
  }
}

/** Das Protokoll als Markdown-Block für die Run-Datei. */
export function protokollText(lauf, { titel = 'Mitschrift' } = {}) {
  const b = laufBilanz(lauf)
  const kopf = [
    `**${titel}** — ${b.ereignisse} Ereignisse · ${b.werkzeugAufrufe} Werkzeug-Aufrufe` +
      (b.denkZeichen > 0 ? ` · ${b.denkZeichen} Zeichen gedacht` : '') +
      (b.unlesbar > 0 ? ` · ${b.unlesbar} unlesbare Zeilen` : ''),
  ]
  if (b.werkzeuge.length) {
    kopf.push('', b.werkzeuge.map(([name, n]) => `${name}×${n}`).join(' · '))
  }
  return [...kopf, '', '```', ...(lauf.zeilen.length ? lauf.zeilen : ['(noch nichts)']), '```'].join('\n')
}
