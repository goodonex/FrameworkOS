import { useMemo } from 'react'
import { useLinkedinThreads } from '../../hooks/useLinkedinThreads'
import { useActiveBrand } from './activeBrand'
import { followupPosten } from './arbeitsmodusQuellen'
import { useUiSetting } from './uiSettings'
import {
  TAGES_FLOW_ZIELE,
  stufenStaende,
  type StufenStand,
  type TagesZeile,
  type ZielUeberschreibung,
} from './tagesFlow'

/**
 * Die Verdrahtung des Tages-Flows an die Hooks (11.08.2026).
 *
 * Die Rechnung selbst steht in `tagesFlow.ts` und ist dort ohne React prüfbar.
 * Hier kommt nur zusammen, was sie braucht: die heutige Zeile aus
 * `daily_metrics`, die Zahl der heute fälligen Follow-ups und Kevins eigene
 * Ziele aus `ui_settings`.
 *
 * **Dieser Hook lädt die Tageszeile bewusst NICHT selbst.** Beide Aufrufer
 * halten sie ohnehin in der Hand (der Zähl-Modus zum Schreiben, der Homescreen
 * für den Hero) — ein eigener Ladelauf hier hiesse, `daily_metrics` auf
 * derselben Seite zweimal zu abonnieren.
 */

/** Ohne Eintrag in `ui_settings` gelten die Standard-Ziele. Modul-Konstante, damit die Referenz steht. */
const KEINE_ZIELE: ZielUeberschreibung = {}

export interface TagesFlowStand {
  staende: StufenStand[]
  /**
   * Solange `true`, ist jede Aussage über „erledigt" vorläufig — beim ersten
   * Render sind alle Zähler 0 und jede Stufe sähe offen aus. Wer daraus
   * springt (Auto-Advance), muss diesen Zustand abwarten.
   */
  laedt: boolean
}

/**
 * Wie viele LinkedIn-Threads sind heute fällig? Das Soll der vierten Stufe.
 *
 * Die Antwort kommt aus `followupPosten` — derselben Funktion, aus der auch die
 * Sales-Kachel und der Arbeitsmodus ihre Follow-up-Liste ziehen, und die
 * ihrerseits `linkedinFollowups.bucketOf` fragt. Eine hier nachgebaute
 * Schwelle wäre eine zweite Fälligkeits-Wahrheit; das ist genau der Fehler,
 * den die eine Rangfolge vermeiden soll.
 */
export function useFaelligeFollowups(): { anzahl: number; laedt: boolean } {
  const { activeBrand } = useActiveBrand()
  const threads = useLinkedinThreads(activeBrand?.slug)
  // Der Mount-Zeitpunkt genügt: die Follow-up-Schwellen sind Tage (3/7/14),
  // eine Zähl-Sitzung dauert Minuten. Ein Minutentakt wie in `usePosten` würde
  // hier nur Neuberechnungen erzeugen, die nichts ändern.
  const jetzt = useMemo(() => new Date(), [])
  const anzahl = useMemo(() => followupPosten(threads.items, jetzt).length, [threads.items, jetzt])
  return { anzahl, laedt: threads.loading }
}

/** Der Stand aller fünf Stufen — die eine Berechnung, die Hero und Zähl-Modus teilen. */
export function useTagesFlow(today: TagesZeile, faelligHeute: number, quelleLaedt = false): TagesFlowStand {
  const { wert: ziele, geladen } = useUiSetting<ZielUeberschreibung>(TAGES_FLOW_ZIELE, KEINE_ZIELE)
  const staende = useMemo(
    () => stufenStaende({ today, faelligHeute, ziele }),
    [today, faelligHeute, ziele],
  )
  return { staende, laedt: quelleLaedt || !geladen }
}
