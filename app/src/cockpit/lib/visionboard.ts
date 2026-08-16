/**
 * Das Visionboard — die kuratierten Bilder unter der Morgenlese.
 *
 * **Quelle:** `identity-os-bilder/final/` im Repo-Wurzelverzeichnis, kuratiert
 * von Kevin in zwei Runden am 16.08.2026 (Galerien `auswahl-runde-2.html` und
 * `board-final.html`). Titel, Notizen und die Preisreihenfolge der Uhren sind
 * aus `board-final.html` übernommen, nicht erfunden.
 *
 * **Die Dateien liegen als verkleinerte Kopien in `app/public/identity/`.**
 * Die Originale sind 3–5 MB je Bild (zusammen ~51 MB) — das ist ein Vielfaches
 * des gesamten App-Bundles und am Handy im Mobilfunknetz nicht vertretbar.
 * Kopiert wurde auf 1.100 px lange Kante bei JPEG-Qualität 72 (zusammen
 * 2,1 MB); die Yacht-Master ist freigestellt und bleibt deshalb PNG, sonst
 * würde ihr transparenter Grund schwarz.
 *
 * **Nachtragen ist eine Zeile.** Das Board war am 16.08. um 20:09 noch ein
 * „Final-Entwurf" mit offenen Plätzen (Patek Nautilus 5712G, Blackout-Nautilus
 * 5726, die Statuen-/Deko-Bilder aus Notion). Wer eines davon ergänzt: Bild
 * verkleinert nach `app/public/identity/` legen, hier eine Zeile eintragen —
 * mehr ist es nicht.
 */

export interface BoardBild {
  /** Dateiname in `app/public/identity/`. */
  datei: string
  titel: string
  /** Kevins Notiz aus dem Board — Preis, Anlass oder Grund. */
  notiz?: string
}

export interface BoardGruppe {
  id: string
  titel: string
  /** Die Zeile unter der Überschrift — sagt, wonach sortiert ist. */
  hinweis?: string
  /**
   * Vollständig zeigen statt beschneiden: quadratische Kachel,
   * `object-fit: contain` auf dunkler Fläche. So hält es die Vorlage für die
   * Uhren — und nur so bleibt eine Uhr eine Uhr statt ein Ausschnitt.
   */
  vollstaendig?: boolean
  bilder: BoardBild[]
}

export const VISIONBOARD: BoardGruppe[] = [
  {
    id: 'uhren',
    titel: 'Uhren',
    hinweis: 'aufsteigend nach Preis',
    vollstaendig: true,
    bilder: [
      { datei: 'uhr-yachtmaster-126622.png', titel: 'Yacht-Master 40', notiz: 'der Daily · 12.700 €' },
      { datei: 'uhr-rolex-daydate-228239.jpg', titel: 'Day-Date 40 Meteorit', notiz: 'Herzens-Uhr · 61.550 €' },
      {
        datei: 'uhr-ap-royaloak-26735SG.jpg',
        titel: 'Royal Oak Openworked Sandgold',
        notiz: 'Herzens-Uhr · ca. 250 T€',
      },
      { datei: 'uhr-adg-honey-pearl.jpg', titel: 'AdG Honey Pearl', notiz: 'Skeleton 5711 · ca. 250–300 T€' },
      { datei: 'uhr-rm88-smiley.jpg', titel: 'RM 88 Smiley', notiz: 'ca. 1,2 Mio €' },
    ],
  },
  {
    id: 'autos',
    titel: 'Autos',
    bilder: [
      { datei: 'auto-porsche-911.jpg', titel: 'Porsche 911', notiz: 'schwarz, Küstenstraße' },
      { datei: 'auto-gle-coupe-matt.jpg', titel: 'AMG GLE Coupé', notiz: 'matt-dunkel foliert' },
      { datei: 'auto-urus.jpg', titel: 'Urus', notiz: 'Altstadt bei Nacht' },
      { datei: 'auto-smart-brabus.jpg', titel: 'Smart Brabus', notiz: 'der Stadt-Praktische' },
    ],
  },
  {
    // Die Vorlage fasst Yachten und Orte zu einer Reihe zusammen — vier
    // Kacheln nebeneinander statt zweimal zwei.
    id: 'yachten-orte',
    titel: 'Yachten & Orte',
    bilder: [
      { datei: 'yacht-klassisch.jpg', titel: 'Klassiker', notiz: 'Riva-Stil' },
      { datei: 'yacht-gross.jpg', titel: 'Superyacht ~80 m' },
      { datei: 'insel-luftbild.jpg', titel: 'Private Insel', notiz: 'Mittelmeer' },
      { datei: 'finca-mallorca.jpg', titel: 'Finca Mallorca', notiz: 'Sportbecken, Oliven, Wein' },
    ],
  },
]

/** Pfad eines Board-Bildes unter `app/public/`. */
export function boardPfad(datei: string): string {
  return `/identity/${datei}`
}

/** Alle Bilder über alle Gruppen — für Zählung und Drift-Wache. */
export function alleBoardBilder(): BoardBild[] {
  return VISIONBOARD.flatMap((g) => g.bilder)
}
