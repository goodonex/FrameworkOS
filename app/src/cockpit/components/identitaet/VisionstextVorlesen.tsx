import { useCallback, useEffect, useRef, useState } from 'react'
import { VISIONSTEXT } from '../../lib/identityInhalte'
import { boardPfad } from '../../lib/visionboard'

/**
 * Der Vorlese-Knopf am Visionstext — mit zwei Stimmen und klarer Rangfolge:
 *
 * 1. **Kevins eigene Aufnahme**, sobald sie existiert. Gesucht wird beim
 *    ersten Tipp unter `/identity/visionstext.m4a` und `.mp3`. Die eigene
 *    Stimme ist der gewollte Endzustand (Psychokybernetik: das Selbstbild
 *    hört auf sich selbst am besten) — Aufnahme in Sprachmemos, Datei nach
 *    `app/public/identity/visionstext.m4a` legen, deployen. Kein Code nötig,
 *    der Knopf wechselt von allein.
 * 2. **Bis dahin die Systemstimme** über `speechSynthesis` (Web Speech API).
 *    Anders als die Sprach-EINGABE (O12: SpeechRecognition fehlt in
 *    Safari/iOS) funktioniert die AUSGABE auch am iPhone — sie braucht nur
 *    eine Nutzer-Geste, und genau die ist der Knopf.
 *
 * **SPA-Falle beim Prüfen der Datei:** Netlify beantwortet JEDE unbekannte
 * URL per Redirect mit `200 text/html` (SPA-Fallback). Ein `HEAD` mit 200
 * beweist also nichts — erst `content-type: audio/*` tut es.
 *
 * Vorgelesen wird der KOMPLETTE Visionstext (alle neun Absätze), nicht nur
 * die zwei offenen — Vorlesen ersetzt das Aufklappen. Je Absatz eine
 * Utterance: lange Einzel-Utterances brechen in manchen Browsern still ab,
 * eine Warteschlange aus neun kurzen nicht.
 */

const AUFNAHME_KANDIDATEN = ['visionstext.m4a', 'visionstext.mp3']

type Zustand = 'still' | 'sucht' | 'spielt'

export function VisionstextVorlesen() {
  const [zustand, setZustand] = useState<Zustand>('still')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  // Ergebnis der Datei-Suche wird gemerkt: null = noch nicht gesucht,
  // '' = keine Aufnahme vorhanden, sonst der Pfad.
  const aufnahmeRef = useRef<string | null>(null)

  const kannSprechen = typeof window !== 'undefined' && 'speechSynthesis' in window

  const stopp = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    if (kannSprechen) window.speechSynthesis.cancel()
    setZustand('still')
  }, [kannSprechen])

  // Beim Verlassen der Seite nicht weiterreden.
  useEffect(() => stopp, [stopp])

  const findeAufnahme = useCallback(async (): Promise<string> => {
    if (aufnahmeRef.current !== null) return aufnahmeRef.current
    for (const datei of AUFNAHME_KANDIDATEN) {
      try {
        const antwort = await fetch(boardPfad(datei), { method: 'HEAD' })
        const typ = antwort.headers.get('content-type') ?? ''
        if (antwort.ok && typ.startsWith('audio')) {
          aufnahmeRef.current = boardPfad(datei)
          return aufnahmeRef.current
        }
      } catch {
        /* Netzfehler → wie „nicht vorhanden" behandeln, Fallback spricht */
      }
    }
    aufnahmeRef.current = ''
    return ''
  }, [])

  const sprich = useCallback(() => {
    const synth = window.speechSynthesis
    synth.cancel()
    // Bevorzugt eine deutsche Stimme; ohne geladene Liste entscheidet
    // `lang` allein — auch gut.
    const stimme = synth.getVoices().find((v) => v.lang.startsWith('de')) ?? null
    const absaetze = VISIONSTEXT
    absaetze.forEach((absatz, i) => {
      const u = new SpeechSynthesisUtterance(absatz)
      u.lang = 'de-DE'
      if (stimme) u.voice = stimme
      // Ruhiger als Vorlese-Standard — es ist ein Visionstext, kein Nachrichtenticker.
      u.rate = 0.95
      if (i === absaetze.length - 1) u.onend = () => setZustand('still')
      synth.speak(u)
    })
  }, [])

  const start = useCallback(async () => {
    setZustand('sucht')
    const aufnahme = await findeAufnahme()
    if (aufnahme) {
      const audio = new Audio(aufnahme)
      audioRef.current = audio
      audio.onended = () => setZustand('still')
      audio.onerror = () => setZustand('still')
      try {
        await audio.play()
        setZustand('spielt')
        return
      } catch {
        audioRef.current = null
        /* Abspielen verweigert → Fallback auf die Systemstimme */
      }
    }
    if (kannSprechen) {
      sprich()
      setZustand('spielt')
    } else {
      setZustand('still')
    }
  }, [findeAufnahme, kannSprechen, sprich])

  // Ohne beides (kein Audio-Fund möglich UND keine Sprachausgabe) wäre der
  // Knopf ein toter Knopf — Audio() gibt es aber überall, wo diese App läuft.
  return (
    <button
      type="button"
      className="ck-btn ck-ident-vorlesen"
      onClick={() => (zustand === 'still' ? void start() : stopp())}
      aria-pressed={zustand === 'spielt'}
    >
      {zustand === 'still' ? (
        <>
          <svg viewBox="0 0 24 24" width={14} height={14} fill="currentColor" aria-hidden>
            <path d="M8 5.5v13l10-6.5-10-6.5Z" />
          </svg>
          Vorlesen
        </>
      ) : zustand === 'sucht' ? (
        'Einen Moment …'
      ) : (
        <>
          <svg viewBox="0 0 24 24" width={14} height={14} fill="currentColor" aria-hidden>
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
          Stopp
        </>
      )}
    </button>
  )
}
