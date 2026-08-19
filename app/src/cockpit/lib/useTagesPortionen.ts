import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { isMissingSupabaseTableError } from '../../lib/supabaseErrors'
import { supabase } from '../../lib/supabase'
import { useActiveBrand } from './activeBrand'
import { PORTION_STUFEN, type StufenId } from './tagesFlow'

/**
 * Die eingefrorenen Tages-Solls (`sales_tagesportionen`, Migration 0074).
 *
 * Geschrieben wird GENAU EINMAL pro Tag und Stufe — insert mit
 * `ignoreDuplicates`, der erste Stand des Tages gewinnt, auch wenn zwei
 * Geräte gleichzeitig öffnen. Gelesen werden ~60 Tage: die heutigen Zeilen
 * fürs Soll, die Historie für die Streak (was an einem Dienstag vor drei
 * Wochen fällig WAR, weiss keine Live-Liste mehr).
 *
 * Fehlt die Tabelle (Migration nicht eingespielt), bleibt alles leer und
 * `tableMissing` steht — `sollFuer` fällt dann auf die Live-Rechnung zurück,
 * die Oberfläche funktioniert weiter, nur ohne Einfrieren und ohne Streak.
 */

/** Eine Zeile der Historie, wie die Streak sie liest. */
export interface PortionsZeile {
  datum: string // YYYY-MM-DD
  stufe: StufenId
  soll: number
  /**
   * 0075: Wann die Stufe an diesem Tag STAND — unabhängig davon, ob der Zähler
   * das Soll erreicht hat. Am 18.08.2026 standen 37 von 39 Erstnachrichten im
   * Zähler, weil Kevin zwei verworfen hat: Zeile grün, Streak gerissen. „Die
   * Liste ist leer" lässt sich rückwirkend nicht rekonstruieren, also wird der
   * Moment festgehalten.
   */
  erledigtAt: string | null
}

const HISTORIE_TAGE = 60

export interface TagesPortionen {
  /** Die heute eingefrorenen Solls — leer, solange nichts eingefroren ist. */
  heutige: Partial<Record<StufenId, number>>
  /** Alle geladenen Zeilen (~60 Tage), für die Streak. */
  historie: PortionsZeile[]
  geladen: boolean
  tableMissing: boolean
  /** Schreibt fehlende Portionen für heute fest. Bereits vorhandene gewinnen. */
  friereEin: (portionen: Partial<Record<StufenId, number>>) => void
  /**
   * Hält fest, dass eine Stufe heute steht — einmal, beim ersten Mal. Ein
   * späteres Zurückfallen (ein neuer Fall rutscht nach) löscht den Vermerk
   * nicht: Kevin hat den Tag abgearbeitet, was danach reinkommt, ist Ware für
   * morgen.
   */
  merkeErledigt: (stufen: StufenId[]) => void
}

function istPortionsStufe(stufe: string): stufe is StufenId {
  return (PORTION_STUFEN as readonly string[]).includes(stufe)
}

export function useTagesPortionen(heute: string): TagesPortionen {
  const { user } = useAuth()
  const { activeBrand } = useActiveBrand()
  const [historie, setHistorie] = useState<PortionsZeile[]>([])
  const [geladen, setGeladen] = useState(false)
  const [tableMissing, setTableMissing] = useState(false)

  const userId = user?.id
  const brandId = activeBrand?.id

  useEffect(() => {
    let lebt = true
    if (!supabase || !userId || !brandId) {
      // Ohne Login gibt es kein Gedächtnis — die Live-Rechnung trägt allein.
      setGeladen(true)
      return
    }
    const sb = supabase
    const von = new Date(`${heute}T12:00:00`)
    von.setDate(von.getDate() - HISTORIE_TAGE)
    const vonIso = von.toISOString().slice(0, 10)
    void sb
      .from('sales_tagesportionen')
      .select('datum, stufe, soll, erledigt_at')
      .eq('user_id', userId)
      .eq('brand_id', brandId)
      .gte('datum', vonIso)
      .then(({ data, error }) => {
        if (!lebt) return
        if (error) {
          if (isMissingSupabaseTableError(error.message)) setTableMissing(true)
          else console.warn('[tagesPortionen] laden fehlgeschlagen:', error.message)
          setGeladen(true)
          return
        }
        setHistorie(
          (data ?? [])
            .filter((z) => istPortionsStufe(z.stufe))
            .map((z) => ({
              datum: z.datum,
              stufe: z.stufe as StufenId,
              soll: z.soll,
              // Die Spalte darf fehlen (Migration 0075 noch nicht eingespielt) —
              // dann verhält sich alles wie vorher.
              erledigtAt: (z as { erledigt_at?: string | null }).erledigt_at ?? null,
            })),
        )
        setGeladen(true)
      })
    return () => {
      lebt = false
    }
  }, [userId, brandId, heute])

  const heutige = useMemo(() => {
    const out: Partial<Record<StufenId, number>> = {}
    for (const z of historie) {
      if (z.datum === heute) out[z.stufe] = z.soll
    }
    return out
  }, [historie, heute])

  /** Nur ein Einfrier-Versuch je (Tag, Mount) — on conflict macht ihn race-sicher. */
  const eingefrorenFuer = useRef<string | null>(null)

  const friereEin = useCallback(
    (portionen: Partial<Record<StufenId, number>>) => {
      if (!supabase || !userId || !brandId || tableMissing) return
      if (eingefrorenFuer.current === heute) return
      eingefrorenFuer.current = heute
      const zeilen = (Object.entries(portionen) as Array<[StufenId, number]>)
        .filter(([stufe, soll]) => istPortionsStufe(stufe) && Number.isInteger(soll) && soll >= 0)
        .map(([stufe, soll]) => ({ user_id: userId, brand_id: brandId, datum: heute, stufe, soll }))
      if (zeilen.length === 0) return
      // Optimistisch in die Historie mergen — der Insert bestätigt nur noch.
      setHistorie((alt) => {
        const vorhanden = new Set(alt.filter((z) => z.datum === heute).map((z) => z.stufe))
        const neu = zeilen
          .filter((z) => !vorhanden.has(z.stufe))
          .map((z) => ({ datum: z.datum, stufe: z.stufe, soll: z.soll, erledigtAt: null }))
        return neu.length ? [...alt, ...neu] : alt
      })
      void supabase
        .from('sales_tagesportionen')
        .upsert(zeilen, { onConflict: 'user_id,brand_id,datum,stufe', ignoreDuplicates: true })
        .then(({ error }) => {
          if (error && !isMissingSupabaseTableError(error.message)) {
            console.warn('[tagesPortionen] einfrieren fehlgeschlagen:', error.message)
          }
        })
    },
    [userId, brandId, heute, tableMissing],
  )

  /** Je Stufe höchstens ein Schreibversuch pro Mount. */
  const erledigtGemerkt = useRef<Set<string>>(new Set())

  const merkeErledigt = useCallback(
    (stufen: StufenId[]) => {
      if (!supabase || !userId || !brandId || tableMissing) return
      const offen = stufen.filter((stufe) => !erledigtGemerkt.current.has(`${heute}|${stufe}`))
      if (offen.length === 0) return
      for (const stufe of offen) erledigtGemerkt.current.add(`${heute}|${stufe}`)
      const at = new Date().toISOString()
      // Optimistisch mergen, damit die Streak nicht auf den Roundtrip wartet.
      setHistorie((alteZeilen) =>
        alteZeilen.map((z) =>
          z.datum === heute && offen.includes(z.stufe) && z.erledigtAt == null
            ? { ...z, erledigtAt: at }
            : z,
        ),
      )
      const sb = supabase
      for (const stufe of offen) {
        void sb
          .from('sales_tagesportionen')
          .update({ erledigt_at: at })
          .eq('user_id', userId)
          .eq('brand_id', brandId)
          .eq('datum', heute)
          .eq('stufe', stufe)
          .is('erledigt_at', null)
          .then(({ error }) => {
            if (error && !isMissingSupabaseTableError(error.message)) {
              console.warn('[tagesPortionen] erledigt-Vermerk fehlgeschlagen:', error.message)
            }
          })
      }
    },
    [userId, brandId, heute, tableMissing],
  )

  return { heutige, historie, geladen, tableMissing, friereEin, merkeErledigt }
}
