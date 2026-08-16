/**
 * Die Texte des Identity-OS — Kevins eigene Worte aus der Visionmap.
 *
 * **Quelle:** Vault `~/Second Brain/00 Kontext/Visionmap 2.0.md` (Stand
 * 16.08.2026). Der Vault wird nicht mitdeployt und ist vom Handy aus nicht
 * erreichbar; die Morgenlese soll aber genau dort funktionieren. Deshalb
 * stehen die Sätze hier als Konstanten und nicht hinter einem Runner-Aufruf —
 * eine Morgenlese, die vom eingeschalteten Mac abhängt, wäre an genau den
 * Morgen kaputt, an denen sie zählt.
 *
 * **Regel beim Pflegen:** Der Vault bleibt die Quelle. Wer die Map ändert,
 * ändert sie dort und trägt die Änderung hier nach — nicht umgekehrt. Kürzen
 * oder „schöner schreiben" ist ausdrücklich nicht erlaubt: das sind Kevins
 * Formulierungen, ihre Wirkung hängt am Wortlaut.
 */

export const VISIONMAP_QUELLE = 'Visionmap 2.0 · Stand 16.08.2026'

// ---------------------------------------------------------------------------
// ☀️ Die Morgenlese (2 Minuten) — was jeden Morgen gelesen wird
// ---------------------------------------------------------------------------

export const MORGENLESE = {
  leitsatz: 'Ich bin ein Verkäufer mit einer Agentur — kein Bastler mit einem Vertriebsproblem.',
  leitsatzFolge: 'Mein Tag beginnt mit dem, was Geld bringt, nicht mit dem, was sich sicher anfühlt.',
  saetze: [
    'Ich bin clean. Mein Kopf gehört mir — Belohnung gibt es abends, wenn ich sie bezahlt habe.',
    'Ich schließe Loops: erledigt, delegiert oder im Kalender. Nichts frisst im Hintergrund meinen Arbeitsspeicher.',
    'Ich bin ein Fels in der Brandung für mein Umfeld — und das beweise ich nicht mit Bildern im Kopf, sondern mit dem heutigen Block.',
  ],
  routine: {
    titel: 'Die eine Routine, die alles trägt',
    kern: '60–90 Minuten Vertrieb, vor allem anderen.',
    zusatz: '~7 Chats, 1 Loom. Bei Widerstand: nur 15 Minuten anfangen — der Rest kommt von allein.',
  },
  standards: ['Durchziehen', 'Sauberkeit', 'Zufriedenheit', 'Clean'],
  warum:
    'Ab 10.000 € MRR kann ein Mensch, der mir wichtig ist, aufhören zu arbeiten. Dafür gehen die Nachrichten raus — auch ohne Lust.',
  afformationen: [
    'Wieso fällt mir der tägliche Vertriebsblock so leicht?',
    'Wieso bin ich so gerne clean?',
    'Wieso mache ich Dinge fertig, bevor ich Neues anfange?',
  ],
} as const

// ---------------------------------------------------------------------------
// Die Sektionen darunter — Nachschlagewerk, standardmäßig zugeklappt
// ---------------------------------------------------------------------------

export interface VerhaltensZeile {
  /** „geht in Sales-Calls so rein:" */
  auftakt: string
  text: string
}

export const VERHALTEN: VerhaltensZeile[] = [
  {
    auftakt: 'geht in Sales-Calls so rein',
    text: 'vorbereitet — das Skript sitzt, die Recherche ist gemacht, ich bin pünktlich und führe das Gespräch. Always take control.',
  },
  {
    auftakt: 'reagiert auf Einwände so',
    text: 'ruhig und neugierig. Ein Einwand ist eine Frage, kein Angriff — ich arbeite die Struktur aus der Einwandbehandlung, ich diskutiere nicht.',
  },
  {
    auftakt: 'nennt Preise so',
    text: 'klar und ohne Rechtfertigung. 5.000 € Festpreis, Retainer 1.000 / 2.000 €. Wer den Wert kennt, verhandelt nicht gegen sich selbst.',
  },
  {
    auftakt: 'trifft Entscheidungen so',
    text: 'bedacht — und dann endgültig. Flexibel in Plänen, starr in Zielen. Einmal Entschiedenes wird nicht täglich neu verhandelt.',
  },
  {
    auftakt: 'bleibt in Routinen so',
    text: 'mechanisch. Routinen erfüllen, auch unmotiviert — Klarheit schlägt Motivation, Routinen schlagen Willenskraft.',
  },
]

export const NICHT_MEHR: string[] = [
  'Kiffen. In keiner Dosis, zu keinem Anlass — es ist Belohnung, die ich nicht bezahlt habe.',
  'Einen Tag „am System bauen", bevor der Vertriebsblock gelaufen ist.',
  'Offene Briefe, Anträge und Loops liegen lassen („mach ich später").',
  'Snoozen.',
  'Auf den richtigen Zeitpunkt warten.',
]

export const JEDEN_TAG: string[] = [
  'Den 60–90-Minuten-Vertriebsblock — vor allem anderen, jeden Werktag.',
  'Die Morgenlese dieser Map + Tagesplan.',
  'Abends: verdiente Belohnung, Reflexion, Afformationen — und rechtzeitig ins Bett.',
]

export interface AntiVisionZeile {
  titel: string
  text: string
}

export const ANTI_VISION: AntiVisionZeile[] = [
  {
    titel: 'Tage ohne einen einzigen Erstkontakt',
    text: 'Ein Tag ohne Outreach ist ein Tag, an dem die Agentur nicht existiert hat.',
  },
  {
    titel: 'Werkzeug-Arbeit als Ersatzhandlung',
    text: 'Bauen fühlt sich wie Arbeit an, verkauft aber nichts. Das System ist fertig genug — es will gefüttert werden.',
  },
  {
    titel: 'Belohnung vor Leistung',
    text: 'Kiffen ist die Saufen-Variante meines eigenen Belohnungs-Grundsatzes: erst die Belohnung, dann den Preis — und der Preis überwiegt. Immer.',
  },
  {
    titel: 'Offene Loops im Hintergrund',
    text: 'Steuer, Briefe, Anträge: erledigt, delegiert oder im Kalender — alles andere frisst RAM.',
  },
  {
    titel: 'Warten auf den richtigen Zeitpunkt',
    text: '„Ich werde nie mehr so viel Kraft haben wie jetzt!"',
  },
]

export const ANTI_VISION_GRUNDSATZ =
  'Deine Welt entsteht aus der Kraft deines Entschlusses sowie aus den Dingen, die du nicht tolerierst.'

export const WARUM = {
  auftakt: 'Der Antrieb, wenn die Lust auf Looms & Nachrichten fehlt:',
  kern: 'Meine Verantwortung gegenüber meiner Freundin und meiner Familie.',
  punkte: [
    'Ab ~10.000 € MRR (stabil) kann ein Mensch, der mir wichtig ist, mit dem Arbeiten aufhören — den will ich in Rente schicken.',
    'Es gab eine Krankheit in der Familie, die sich mit Geld deutlich besser hätte regeln lassen. Für genau solche Situationen baue ich das hier.',
  ],
  schluss: 'Und: Ich werde ein extrem guter Arbeitgeber. „Wer mit Kevin arbeitet, verdient Geld, und er ist ehrlich."',
} as const

/** Die Stufen aus „Traumleben — konkret". Steht unter dem Warum. */
export const STUFEN = [
  { stufe: 'Freiheit', netto: '~10.000 €', bedeutung: 'Umfeld kann aufhören zu arbeiten' },
  { stufe: 'Komfort', netto: '~15.000 €', bedeutung: 'Lebenshaltung komplett gedeckt' },
  { stufe: 'Traumleben', netto: '20.000 €', bedeutung: '≈ 40k Agentur-Umsatz — 5 Neukunden + ~25 Retainer' },
] as const

// ---------------------------------------------------------------------------
// Der Check-in — die drei Einheiten, die abgehakt werden
// ---------------------------------------------------------------------------

export interface CheckinEinheit {
  feld: 'vertriebsblock' | 'clean' | 'sport'
  titel: string
  /** Die eine Zeile darunter — woran man erkennt, dass es erledigt ist. */
  mass: string
}

export const CHECKIN_EINHEITEN: CheckinEinheit[] = [
  { feld: 'vertriebsblock', titel: 'Vertriebsblock', mass: '60–90 Minuten, vor allem anderen' },
  { feld: 'clean', titel: 'Clean geblieben', mass: 'kein THC, kein Tabak' },
  { feld: 'sport', titel: 'Sport', mass: 'nach Trainings- bzw. Reha-Protokoll' },
]

/**
 * Die Energie-Skala. Kevins Ausgangswert im Worksheet vom 16.08. war eine 4
 * („hoch beim Bauen, blockiert beim Senden") — deshalb steht die 4 nicht als
 * Vorbelegung im Regler: ein vorbelegter Wert wäre eine Antwort, die Kevin
 * nicht gegeben hat.
 */
export const ENERGIE_MIN = 1
export const ENERGIE_MAX = 10
