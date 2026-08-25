/**
 * Text in die Zwischenablage legen — mit der Rückfallebene, die Kevins
 * LinkedIn-Runde am Laufen hält.
 *
 * `navigator.clipboard` ist der richtige Weg, scheitert aber je nach
 * Browser-Zustand mit `NotAllowedError` — am 18.08.2026 im Vorschau-Browser
 * gemessen, und Safari ist hier historisch eigen. Dann greift die alte
 * Technik: unsichtbares Textfeld, markieren, `execCommand('copy')`. Sie ist
 * veraltet, aber sie funktioniert genau dort, wo die moderne API aussteigt.
 * Ein „Zwischenablage gesperrt" bei jedem zweiten Namen wäre für eine Runde
 * über 177 Threads teurer als eine veraltete Zeile Code.
 *
 * Stand ursprünglich in `Arbeitsliste.tsx`; seit dem 25.08. hier, weil das
 * Sales-Canvas dieselbe Mechanik braucht und zwei Kopien garantiert
 * auseinanderlaufen.
 *
 * @returns ob es geklappt hat — die Rückmeldung am Knopf hängt daran.
 */
export async function inZwischenablage(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const feld = document.createElement('textarea')
      feld.value = text
      // Aus dem Blick, aber im Layout — `display: none` liesse sich nicht markieren.
      feld.setAttribute('aria-hidden', 'true')
      feld.style.position = 'fixed'
      feld.style.top = '-1000px'
      feld.style.opacity = '0'
      document.body.appendChild(feld)
      feld.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(feld)
      return ok
    } catch {
      return false
    }
  }
}
