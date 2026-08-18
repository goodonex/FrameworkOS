import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { useActiveBrand } from './activeBrand'
import type { MetricField } from './metrikFelder'
import { heutigesMetrikDatum, toIsoDate, weekRowsOf } from './metricsDates'

/**
 * Eine Tageszeile aus daily_metrics (Migration 0049).
 *
 * Etappe 4, Schritt 2c: die vier herkunftslosen Sammelfelder `coldmails`,
 * `followups`, `antworten_cold` und `termine_vereinbart` sind raus. Seit 0053/0055
 * wird je Kanal gezählt (li_/ig_/call_), und die Sammelspalten wurden nur noch
 * mit Nullen beschrieben — kein Leser im ganzen Code, kein Eintrag in QuickTrack
 * oder TrackingArea. Die Spalten selbst bleiben bis zur Migration 0066 stehen
 * (`not null default 0`), der Upsert lässt sie ab jetzt einfach aus.
 */
export interface DailyMetricsRow {
  id?: string
  datum: string // YYYY-MM-DD
  li_anfragen: number
  li_nachrichten: number
  inmails: number
  looms: number
  ig_anfragen: number
  ig_nachrichten: number
  cold_calls: number
  // Follow-ups je Kanal (0055)
  li_followups: number
  ig_followups: number
  call_followups: number
  antworten_li: number
  antworten_inmail: number
  antworten_ig: number
  quali_termine: number
  sales_calls: number
  // Termine mit Kanal-Herkunft (0055)
  termine_li: number
  termine_ig: number
  termine_call: number
  abschluesse: number
  umsatz: number
  note?: string | null
}

// Feldnamen + Beschriftungen liegen in metrikFelder.ts (Blatt-Modul ohne React),
// damit urielTools.ts und scripts/verify-*.ts sie ohne den Hook laden können.
// Re-Export hält alle bestehenden Import-Pfade gültig.
export { METRIC_FIELDS, METRIK_LABEL, istMetrikFeld } from './metrikFelder'
export type { MetricField } from './metrikFelder'

export function emptyRow(datum: string): DailyMetricsRow {
  return {
    datum,
    li_anfragen: 0,
    li_nachrichten: 0,
    inmails: 0,
    looms: 0,
    ig_anfragen: 0,
    ig_nachrichten: 0,
    cold_calls: 0,
    li_followups: 0,
    ig_followups: 0,
    call_followups: 0,
    antworten_li: 0,
    antworten_inmail: 0,
    antworten_ig: 0,
    quali_termine: 0,
    sales_calls: 0,
    termine_li: 0,
    termine_ig: 0,
    termine_call: 0,
    abschluesse: 0,
    umsatz: 0,
  }
}

// Datums-/Wochenlogik liegt in metricsDates.ts (Blatt-Modul ohne React), damit
// scripts/verify-*.ts sie ohne Vite-Umgebung laden kann. Re-Export hält alle
// bestehenden Import-Pfade gültig.
export { mondayOf, toIsoDate, weekRowsOf } from './metricsDates'

interface UseDailyMetricsResult {
  /** alle Zeilen des laufenden Monats (aufsteigend nach Datum) */
  monthRows: DailyMetricsRow[]
  /** Zeilen der laufenden Woche (Mo–So) */
  weekRows: DailyMetricsRow[]
  /** ALLE geladenen Zeilen (~45-Tage-Fenster) — Quelle für Verlaufs-Sparklines */
  windowRows: DailyMetricsRow[]
  /** heutige Zeile (leer, wenn noch nichts eingetragen) */
  today: DailyMetricsRow
  loading: boolean
  /** Tabelle fehlt → Migration 0049 noch nicht ausgeführt */
  tableMissing: boolean
  error: string | null
  /** frühestes Datum, das rückwirkend eingetragen werden kann (Ladefenster-Start) */
  windowStart: string
  /** Zeile eines beliebigen Tages (leer, wenn nichts eingetragen) */
  rowFor: (datum: string) => DailyMetricsRow
  /** Feld der HEUTIGEN Zeile ändern (optimistisch, race-sicher, gebündelt gespeichert) */
  bump: (field: MetricField, delta: number) => void
  /** Umsatz der HEUTIGEN Zeile setzen */
  setUmsatz: (value: number) => void
  /** Feld eines BELIEBIGEN Tages ändern (rückwirkendes Tracking) */
  bumpOn: (datum: string, field: MetricField, delta: number) => void
  /** Umsatz eines BELIEBIGEN Tages setzen */
  setUmsatzOn: (datum: string, value: number) => void
  refresh: () => Promise<void>
}

/**
 * Echte daily_metrics aus Supabase (ersetzt useVitalsMock ab Phase 3).
 * Lädt ein ~45-Tage-Fenster (für rückwirkendes Eintragen), schreibt per Upsert
 * auf (user, brand, datum). Bumps laufen über eine synchrone Ref-Kopie +
 * gebündelten (debounced) Upsert — so gehen schnelle Klicks nicht verloren
 * (kein Stale-Closure-Race) und out-of-order-Writes können sich nicht
 * gegenseitig überschreiben.
 */
export function useDailyMetrics(): UseDailyMetricsResult {
  const { user } = useAuth()
  const { activeBrand } = useActiveBrand()
  const [allRows, setAllRows] = useState<DailyMetricsRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 4-Uhr-Grenze (metricsDates): ein Haken um 0:30 zählt auf Kevins „gestern".
  const todayIso = heutigesMetrikDatum()
  const monthStart = todayIso.slice(0, 8) + '01'
  // Ladefenster ~45 Tage zurück → rückwirkendes Eintragen (auch über die
  // Monatsgrenze) funktioniert. Aggregate filtern davon wieder auf Monat/Woche.
  const windowStart = useMemo(() => {
    const d = new Date(`${todayIso}T12:00:00`)
    d.setDate(d.getDate() - 45)
    return toIsoDate(d)
  }, [todayIso])

  // Autoritative, SYNCHRON aktualisierte Kopie — Bumps lesen daraus statt aus
  // dem Render-Closure, damit schnelle Mehrfachklicks korrekt akkumulieren.
  const rowsRef = useRef<DailyMetricsRow[]>([])
  const userRef = useRef(user)
  userRef.current = user
  const brandRef = useRef(activeBrand)
  brandRef.current = activeBrand
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const applyRows = useCallback((rows: DailyMetricsRow[]) => {
    rowsRef.current = rows
    setAllRows(rows)
  }, [])

  const refresh = useCallback(async () => {
    const u = userRef.current
    const b = brandRef.current
    if (!supabase || !u || !b) {
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: err } = await supabase
      .from('daily_metrics')
      .select('*')
      .eq('user_id', u.id)
      .eq('brand_id', b.id)
      .gte('datum', windowStart)
      .order('datum', { ascending: true })

    if (err) {
      // Tabelle fehlt → Migration 0049 nicht ausgeführt.
      // Direkt-SQL: 42P01 · PostgREST: PGRST205 "Could not find the table … in the schema cache"
      const missing =
        err.code === '42P01' ||
        err.code === 'PGRST205' ||
        err.message.includes('does not exist') ||
        err.message.includes('Could not find the table')
      if (missing) {
        setTableMissing(true)
      } else {
        setError(err.message)
      }
      applyRows([])
    } else {
      setTableMissing(false)
      setError(null)
      applyRows((data as DailyMetricsRow[]) ?? [])
    }
    setLoading(false)
  }, [windowStart, applyRows])

  useEffect(() => {
    void refresh()
  }, [refresh, user?.id, activeBrand?.id])

  // Transiente Fehler (Auth-Lock/Token/Netz) sind KEINE echten Schreibfehler:
  // GoTrue „stiehlt" beim Token-Refresh bzw. über mehrere Tabs kurz den
  // Navigator-Lock → NavigatorLockAcquireTimeoutError schlägt bis in den Upsert
  // durch. Per Design retrybar. Bei sowas NICHT die Eingabe verwerfen.
  const isTransientWriteError = (msg: string, name?: string): boolean => {
    const m = `${msg} ${name ?? ''}`.toLowerCase()
    return (
      m.includes('stole') || // „…released because another request stole it"
      m.includes('lock') ||
      m.includes('abort') ||
      m.includes('jwt') ||
      m.includes('token') ||
      m.includes('refresh') ||
      m.includes('fetch') || // „Failed to fetch"
      m.includes('network') ||
      m.includes('timeout')
    )
  }

  // Selbstheilendes persist(): schreibt den FRISCHEN Ref-Stand des Tages und
  // versucht bei transienten Fehlern mehrfach erneut, ohne die Eingabe zu
  // verwerfen. Nur ein echter DB-Fehler setzt auf die Server-Wahrheit zurück.
  const persistRef = useRef<(datum: string) => Promise<void>>(async () => {})
  const persist = useCallback(
    async (datum: string) => {
      const u = userRef.current
      const b = brandRef.current
      if (!supabase || !u || !b) return

      const delays = [0, 350, 900, 1800] // 1 Versuch + 3 Retries
      for (let attempt = 0; attempt < delays.length; attempt++) {
        if (delays[attempt] > 0) await new Promise((r) => setTimeout(r, delays[attempt]))

        // Pro Versuch neu lesen → schnelle Klicks während des Retrys gehen mit.
        const row = rowsRef.current.find((r) => r.datum === datum)
        if (!row) return
        // created_at/updated_at/user_id/brand_id einer geladenen Zeile NICHT
        // mitschreiben (Trigger/Defaults pflegen sie; created_at bliebe sonst
        // bei jedem Update überschrieben).
        const {
          id: _id,
          created_at: _c,
          updated_at: _u2,
          user_id: _uid,
          brand_id: _bid,
          ...payload
        } = row as DailyMetricsRow & {
          created_at?: string
          updated_at?: string
          user_id?: string
          brand_id?: string
        }

        const { error: err } = await supabase.from('daily_metrics').upsert(
          { ...payload, user_id: u.id, brand_id: b.id },
          { onConflict: 'user_id,brand_id,datum' },
        )
        if (!err) {
          setError(null)
          return
        }
        if (!isTransientWriteError(err.message, (err as { name?: string }).name)) {
          // Echter DB-Fehler (Constraint/RLS/fehlende Spalte) → sichtbar machen
          // und mit Server-Wahrheit abgleichen. NUR hier wird zurückgesetzt.
          setError(err.message)
          void refresh()
          return
        }
        // Transient: bei Token/JWT einmal aktiv erneuern, dann weiter retryen.
        if (/jwt|token|refresh/i.test(err.message)) {
          try {
            await supabase.auth.refreshSession()
          } catch {
            /* egal — der nächste Versuch zieht die frische Session */
          }
        }
      }

      // Retries erschöpft: Eingabe bleibt erhalten (kein refresh()!), sanfter
      // Hinweis + späterer Selbstheil-Versuch, sobald der Lock frei ist.
      setError('Speichern hakt kurz (Verbindung/Session) — dein Eintrag bleibt erhalten und wird automatisch nachgezogen.')
      setTimeout(() => void persistRef.current(datum), 4000)
    },
    [refresh],
  )
  persistRef.current = persist

  // Bündelt schnelle Klicks pro Tag zu einem Write des Endstands (350ms).
  const schedulePersist = useCallback(
    (datum: string) => {
      const timers = timersRef.current
      const existing = timers.get(datum)
      if (existing) clearTimeout(existing)
      timers.set(
        datum,
        setTimeout(() => {
          timers.delete(datum)
          void persist(datum)
        }, 350),
      )
    },
    [persist],
  )

  const mutate = useCallback(
    (datum: string, patch: Partial<DailyMetricsRow>) => {
      const b = brandRef.current
      // Nicht mit Fallback-Brand schreiben (keine echte UUID) → Insert schlüge fehl.
      if (b && b.id.startsWith('local-fallback-')) {
        setError('Brand lädt noch — bitte 1–2 Sekunden warten und erneut tracken.')
        return
      }
      const cur = rowsRef.current.find((r) => r.datum === datum) ?? emptyRow(datum)
      const next = { ...cur, ...patch }
      const others = rowsRef.current.filter((r) => r.datum !== datum)
      applyRows([...others, next].sort((a, c) => a.datum.localeCompare(c.datum)))
      schedulePersist(datum)
    },
    [applyRows, schedulePersist],
  )

  // Ausstehende Writes beim Verlassen sofort rausschicken (kein Datenverlust).
  useEffect(() => {
    const timers = timersRef.current
    return () => {
      timers.forEach((t, datum) => {
        clearTimeout(t)
        void persist(datum)
      })
      timers.clear()
    }
  }, [persist])

  const rowFor = useCallback(
    (datum: string) => allRows.find((r) => r.datum === datum) ?? emptyRow(datum),
    [allRows],
  )

  const monthRows = useMemo(
    () => allRows.filter((r) => r.datum >= monthStart),
    [allRows, monthStart],
  )

  const today = useMemo(() => rowFor(todayIso), [rowFor, todayIso])

  // Aus allRows (45-Tage-Fenster), NICHT aus monthRows — sonst bricht die
  // laufende Woche an jedem Monatsersten weg (siehe weekRowsOf). `todayIso`
  // wird bewusst durchgereicht, damit die Woche beim Tageswechsel nachzieht.
  const weekRows = useMemo(
    () => weekRowsOf(allRows, new Date(`${todayIso}T12:00:00`)),
    [allRows, todayIso],
  )

  const bumpOn = useCallback(
    (datum: string, field: MetricField, delta: number) => {
      const cur = rowsRef.current.find((r) => r.datum === datum) ?? emptyRow(datum)
      mutate(datum, { [field]: Math.max(0, (cur[field] ?? 0) + delta) })
    },
    [mutate],
  )

  const setUmsatzOn = useCallback(
    (datum: string, value: number) => {
      mutate(datum, { umsatz: Math.max(0, value) })
    },
    [mutate],
  )

  const bump = useCallback(
    (field: MetricField, delta: number) => bumpOn(todayIso, field, delta),
    [bumpOn, todayIso],
  )

  const setUmsatz = useCallback((value: number) => setUmsatzOn(todayIso, value), [setUmsatzOn, todayIso])

  return {
    monthRows,
    weekRows,
    windowRows: allRows,
    today,
    loading,
    tableMissing,
    error,
    windowStart,
    rowFor,
    bump,
    setUmsatz,
    bumpOn,
    setUmsatzOn,
    refresh,
  }
}
