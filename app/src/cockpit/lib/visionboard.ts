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
  /**
   * Freigestelltes Produktfoto statt Szenerie. Solche Bilder bekommen eine
   * eigene Fläche, weil ihr transparenter bzw. weißer Grund sonst als harter
   * Block in der dunklen Seite steht.
   */
  freigestellt?: boolean
}

export interface BoardGruppe {
  id: string
  titel: string
  /** Die Zeile unter der Überschrift — sagt, wonach sortiert ist. */
  hinweis?: string
  bilder: BoardBild[]
}

export const VISIONBOARD: BoardGruppe[] = [
  {
    id: 'uhren',
    titel: 'Uhren',
    hinweis: 'aufsteigend nach Preis',
    bilder: [
      {
        datei: 'uhr-yachtmaster-126622.png',
        titel: 'Rolex Yacht-Master 40, Rhodium',
        notiz: 'der Daily — 12.700 €',
        freigestellt: true,
      },
      {
        datei: 'uhr-rolex-daydate-228239.jpg',
        titel: 'Rolex Day-Date 40, Weissgold, Meteorit',
        notiz: 'Herzens-Uhr — 61.550 €',
      },
      {
        datei: 'uhr-ap-royaloak-26735SG.jpg',
        titel: 'AP Royal Oak Flying Tourbillon Openworked, Sandgold',
        notiz: 'Herzens-Uhr — ca. 250 T€',
      },
      {
        datei: 'uhr-adg-honey-pearl.jpg',
        titel: 'Artisans de Genève Honey Pearl — Skeleton 5711, Roségold',
        notiz: 'ca. 250–300 T€',
      },
      {
        datei: 'uhr-rm88-smiley.jpg',
        titel: 'Richard Mille RM 88 Smiley, Roségold',
        notiz: 'ca. 1,2 Mio €',
      },
    ],
  },
  {
    id: 'autos',
    titel: 'Autos',
    bilder: [
      { datei: 'auto-gle-coupe-matt.jpg', titel: 'AMG GLE Coupé, matt-dunkel', notiz: 'das Auto aus dem Visionstext' },
      { datei: 'auto-porsche-911.jpg', titel: 'Porsche 911, schwarz', notiz: 'Küstenstraße' },
      { datei: 'auto-urus.jpg', titel: 'Lamborghini Urus, matt-grau/Gold', notiz: 'Altstadt bei Nacht' },
      { datei: 'auto-urus-sand.jpg', titel: 'Lamborghini Urus, sandgold', notiz: 'Wüstendüne' },
      { datei: 'auto-smart-brabus.jpg', titel: 'Smart Brabus', notiz: 'der Stadt-Praktische' },
    ],
  },
  {
    id: 'yachten',
    titel: 'Yachten',
    bilder: [
      { datei: 'yacht-klassisch.jpg', titel: 'Klassiker im Riva-Stil', notiz: 'hat Vibe' },
      { datei: 'yacht-gross.jpg', titel: 'Superyacht ~80 m', notiz: 'die richtige Yacht' },
    ],
  },
  {
    id: 'orte',
    titel: 'Orte',
    bilder: [
      { datei: 'finca-mallorca.jpg', titel: 'Steinfinca auf Mallorca', notiz: 'Sportbecken, Oliven, Wein' },
      { datei: 'insel-luftbild.jpg', titel: 'Private Mittelmeer-Insel', notiz: 'Endgame' },
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
