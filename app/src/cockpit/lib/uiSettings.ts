import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

/**
 * Oberflächen-Einstellungen je Nutzer (Migration 0068, O18 v2 d).
 *
 * **Zwei Speicher mit klarer Rangfolge.** Supabase ist die Wahrheit — nur so
 * überlebt eine Einstellung das Löschen-und-neu-Hinzufügen der PWA, das bei
 * diesem Projekt ein dokumentierter Schritt ist (O3). localStorage ist nur ein
 * Zwischenspeicher, damit die Oberfläche beim Öffnen sofort richtig steht und
 * nicht sichtbar umspringt, wenn die Zeile eine halbe Sekunde später eintrifft.
 *
 * Ohne Login oder ohne Supabase bleibt die Einstellung lokal — sie ist dann
 * nicht weniger wert, nur nicht geräteübergreifend.
 */

const CACHE_PREFIX = 'cockpit.ui.'

function leseCache<T>(schluessel: string): T | null {
  try {
    const roh = localStorage.getItem(CACHE_PREFIX + schluessel)
    return roh ? (JSON.parse(roh) as T) : null
  } catch {
    return null
  }
}

function schreibeCache(schluessel: string, wert: unknown): void {
  try {
    localStorage.setItem(CACHE_PREFIX + schluessel, JSON.stringify(wert))
  } catch {
    /* Privatmodus o. ä. — dann eben ohne Zwischenspeicher */
  }
}

export interface UiSetting<T> {
  wert: T
  setzen: (neu: T) => void
  /** Steht der Wert schon fest? Nur relevant, wo ein Umspringen stören würde. */
  geladen: boolean
}

export function useUiSetting<T>(schluessel: string, standard: T): UiSetting<T> {
  const { user } = useAuth()
  const [wert, setWert] = useState<T>(() => leseCache<T>(schluessel) ?? standard)
  const [geladen, setGeladen] = useState(false)

  useEffect(() => {
    let lebt = true
    if (!supabase || !user?.id) {
      setGeladen(true)
      return
    }
    const sb = supabase
    void sb
      .from('ui_settings')
      .select('setting_value')
      .eq('user_id', user.id)
      .eq('setting_key', schluessel)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!lebt) return
        // Fehler bewusst still: eine nicht geladene Einstellung ist ein
        // kosmetisches Problem, kein Grund für einen Banner.
        if (!error && data?.setting_value != null) {
          setWert(data.setting_value as T)
          schreibeCache(schluessel, data.setting_value)
        }
        setGeladen(true)
      })
    return () => {
      lebt = false
    }
  }, [user?.id, schluessel])

  const setzen = useCallback(
    (neu: T) => {
      setWert(neu)
      schreibeCache(schluessel, neu)
      if (!supabase || !user?.id) return
      void supabase
        .from('ui_settings')
        .upsert(
          { user_id: user.id, setting_key: schluessel, setting_value: neu },
          { onConflict: 'user_id,setting_key' },
        )
        .then(({ error }) => {
          if (error) console.warn('[uiSettings] konnte nicht speichern:', error.message)
        })
    },
    [user?.id, schluessel],
  )

  return { wert, setzen, geladen }
}

/** Der eine Schlüssel, den v2 (d) benutzt. */
export const KACHEL_REIHENFOLGE = 'home.kachelReihenfolge'

/**
 * Gespeicherte Reihenfolge auf die tatsächlich vorhandenen Bereiche anwenden.
 *
 * Robust gegen beide Richtungen von Drift: ein Bereich, der aus der Registry
 * verschwindet, fällt raus; ein neuer, den die gespeicherte Liste nicht kennt,
 * landet hinten statt zu fehlen. Ohne das würde eine alte Anordnung neue
 * Bereiche unsichtbar machen — der Fehler, den man erst Wochen später merkt.
 */
export function ordneNach<T extends { path: string }>(bereiche: T[], reihenfolge: string[]): T[] {
  const rang = new Map(reihenfolge.map((p, i) => [p, i]))
  return [...bereiche].sort((a, b) => {
    const ra = rang.get(a.path)
    const rb = rang.get(b.path)
    if (ra == null && rb == null) return 0
    if (ra == null) return 1
    if (rb == null) return -1
    return ra - rb
  })
}

/** Einen Bereich vor einen anderen setzen (Ergebnis der Tipp-Tipp-Geste). */
export function verschiebeVor(reihenfolge: string[], was: string, vor: string): string[] {
  if (was === vor) return reihenfolge
  const ohne = reihenfolge.filter((p) => p !== was)
  const i = ohne.indexOf(vor)
  if (i === -1) return [...ohne, was]
  return [...ohne.slice(0, i), was, ...ohne.slice(i)]
}
