export type UiTheme = 'dark' | 'plain-light'

const KEY = 'brand-os-ui-theme'

export const UI_THEME_EVENT = 'brand-os-ui-theme'

/**
 * Die Browser-Leiste kann keine CSS-Variable lesen — der Wert muss als
 * Zeichenkette in das `theme-color`-Meta. Er steht deshalb zwangslaeufig
 * zweimal: hier und in `app/index.html` (vor dem ersten Paint). Beide sind
 * --ck-bg aus Welt 1; wer den Grundton aendert, aendert alle drei.
 */
const THEME_COLOR: Record<UiTheme, string> = {
  dark: '#0c130e',
  'plain-light': '#f7f7f9',
}

/**
 * Phase 2, D3: Das Cockpit ist nur noch dunkel — der ☀-Knopf ist aus der
 * StatusBar raus. Damit MUSS diese Funktion hart 'dark' liefern: wer den
 * Umschalter zuletzt auf hell stehen hatte, säße sonst dauerhaft im
 * ungepflegten `plain-light`-Block fest, ohne Weg zurück.
 * Typ, Speicherfunktionen und die CSS-Klasse bleiben liegen (kein Abriss,
 * kein Pflegeversprechen); ein Hell-Modus käme später neu auf Token-Basis.
 */
export function loadUiTheme(): UiTheme {
  return 'dark'
}

export function saveUiTheme(theme: UiTheme): void {
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    /* ignore */
  }
}

export function applyUiTheme(theme: UiTheme): void {
  const root = document.documentElement
  if (theme === 'plain-light') {
    root.setAttribute('data-ui-theme', 'plain-light')
  } else {
    root.removeAttribute('data-ui-theme')
  }
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (meta) meta.content = THEME_COLOR[theme]
  window.dispatchEvent(new CustomEvent<UiTheme>(UI_THEME_EVENT, { detail: theme }))
}
