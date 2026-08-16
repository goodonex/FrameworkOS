# Wargame — Marken-Kompass: die Kennenlernen-Phase wird ein Portal-Werkzeug

**Erstellt:** 2026-08-16 · **Planer:** Fable 5 · **Executor:** Opus 5 auf `xhigh` (blind ausführbar)
**Branch:** `cockpit-rebuild` · **Repo:** `~/Kevin OS/02 Projekte/uriel`

---

## Mission Brief

Kevins Diktat (16.08.):

> „…ein Tool direkt in Uriel im Kundenportal […] wo der so ähnlich wie beim
> Myers-Briggs-Test halt verschiedene Sachen beantwortet, bei verschiedenen
> Bildern, die klicken muss und sagen muss, was gefällt ihm mehr, was nicht —
> dass wir auf 'ner sehr hohen Wahrscheinlichkeit einfach schon im ersten
> Entwurf bei dem rauskommen, was der Kunde am Ende haben möchte."

Gebaut wird der **Marken-Kompass** (Arbeitstitel, siehe LEDGER): ein geführter
Selbsttest im Kundenportal, der die Kennenlernen-Phase des KLAR-Prozesses
(Discovery-Workshop + Visual-Analyse, Vault:
`07 Templates/Geschäft & Branding/Discovery & Branding – Prozess-Template.md`)
in vier Teile übersetzt:

1. **Stil-Duelle** — Bildpaare, jedes Paar isoliert genau EINE Ästhetik-Achse.
2. **Selbstbild-Regler** — Gegensatzpaar-Skalen zur strategischen Verortung.
3. **Anti-Auswahl** — „Welche zwei davon auf keinen Fall?" (Negativsignale).
4. **Kernfragen** — die sechs KLAR-Discovery-Fragen als Textfelder.

Die Auswertung ist zweistufig: **deterministisch** im Client
(Achsen-Scores, Widerspruchs-Erkennung, adaptive Zusatz-Duelle — reine
Funktionen, verify-testbar) und **eine** Claude-Synthese am Ende (Edge
Function), die daraus ein Marken-Profil mit North-Star-Hypothesen,
Wortwelt, Template-Parametern für den ersten Entwurf und den
Spannungs-Fragen für Kevins Call baut.

Der Kunde sieht nach Abschluss eine kuratierte Kurzfassung; die Spannungen
und Call-Fragen sieht **nur Kevin** im Cockpit (D9). Erfolgsmaß der Mission:
ein Testlauf Ende-zu-Ende — Kunde klickt durch, Profil entsteht, Kevin sieht
Ergebnis + kopierbaren Build-Prompt im Projektbereich.

Einstieg in dieser Reihenfolge: (1) `HANDOFF.md`, (2) `docs/BACKLOG.md`
(Runde vom 14.08. — dort liegt die 0071-Falle), (3) diese Blaupause komplett.

---

## Gesetze dieser Runde

1. **Zeilennummern/Dateinamen hier sind Wegweiser vom 16.08., nicht Wahrheit.**
   Vor jedem Edit frisch lesen. Zug K0 (Recon) zuerst.
2. **Nach jedem Zug:** `cd app && npx tsc -b && npm run build` grün, danach
   ALLE `scripts/verify-*.ts` grün (Stand 14.08.: 35 Skripte + neue). Ein
   Commit je Zug auf `cockpit-rebuild`, deutsche Commit-Message mit
   Typ-Prefix. **NICHT auf `main` pushen** — Livegang ist Kevins Wort.
3. **Migrationen ausschließlich über `supabase db push`**, nie im SQL-Editor
   (Lehre L2). Die neue Migration heißt **0072** — Details und Falle in K3.
4. **Tabu (nur lesen, nie ändern):** `lib/phaseMapping.ts`, `lib/abnahme.ts`,
   `hooks/useProjectMessages.ts`, `hooks/usePortalProject.ts`,
   `lib/prioritaet.ts`, `hooks/usePosten.ts`. Der Kompass hängt sich an
   bestehende Phasen und Sendepfade, er definiert keine zweite Wahrheit.
5. **Token-Disziplin Welt 2:** jede Farbe aus `--portal-*`
   (`docs/phase2/DESIGN-TOKENS.md`). Portal-Breakpoint ist **768**
   (`pages/portal/portal.css`), nicht 900. Mobil bei 390×664 verifizieren.
   Die Stil-Kacheln selbst sind bewusst NICHT im Portal-Look (D3) — aber ihr
   Rahmen (Karten, Knöpfe, Fortschritt) ist es.
6. **Kein neuer Google-Font.** Die Typo-Achse arbeitet mit den geladenen
   Familien (Inter, Archivo, Instrument Serif) plus System-Serif
   (`Georgia, 'Times New Roman', serif`). Erst prüfen, was `app/index.html`
   lädt (K0), dann bauen.
7. **KI nur am Ende.** Der Test-Flow selbst ruft niemals ein Modell —
   Scores, Widersprüche und Adaptivität sind deterministische Funktionen mit
   verify-Skript. Genau eine Synthese pro Abschluss (+ manuelles Neu-Rechnen
   durch Kevin).

---

## Recon-Befunde (Stand 16.08., von der Planung am Code verifiziert)

| Befund | Beleg | Konsequenz |
|---|---|---|
| Portal-Routen: `/portal/login`, `/portal/setup`, `/portal/:projectId(/crm)` | `app/src/App.tsx:214-217` | K4 ergänzt `/portal/:projectId/kompass` im selben Block |
| Auth-Gate: `role='client'` wird hart auf sein `clientProjectId` gelenkt; Owner-Brille via `?als=kunde`; `?preview=true` nur im Dev-Build | `pages/portal/PortalRoute.tsx:40-95` | Kompass-Route nutzt DASSELBE Gate (`RequireClientPortalGate`), keinen eigenen Wächter bauen |
| `usePortalProject` lädt Projekt + Brand RLS-konform | `hooks/usePortalProject.ts:103-147` | K4 verwendet ihn unverändert (Tabu-Liste) |
| Phasen: `branding` = Stages `onboarding` + `discover`; `getPhaseState(phase, client_stage)` | `lib/phaseMapping.ts:20-26,41-51` | Einstiegskarte ist „aktiv", solange `phaseForStage(client_stage)==='branding'`; danach kompakt („Stil-Profil ansehen") |
| Portal-Nachrichten laufen über `useProjectMessages(projectId,'client',name)` + Präfix-Protokoll `lib/abnahme.ts` | `components/portal/PortalShell.tsx:38,49-53` | Kompass-Abschluss schickt KEINE Nachricht (D10) — Kevin sieht den Status im Cockpit |
| `deliver_projects`: `client_stage`, `deliverables`, `client_documents`; Kunde ↔ Projekt über `user_roles.project_id` (RLS-Muster) | `docs/data-model.md:157-221`, Migration `0012_client_access.sql` | `kompass_laeufe` referenziert `project_id`; RLS nach 0012-Muster (K3) |
| Edge-Function-Muster: CORS-Header, `ANTHROPIC_API_KEY` + optional `ANTHROPIC_MODEL` aus Secrets, Auth via Bearer → `userClient.auth.getUser()` | `supabase/functions/uriel/index.ts:1-80` | K5 kopiert das Gerüst; Anthropic-Aufruf wie dort (frisch lesen) |
| Je Function ein `verify_jwt`-Eintrag | `supabase/config.toml` | K3 trägt `[functions.kompass-synthese] verify_jwt = true` ein |
| Namensraum „discovery" ist VERBRANNT: `discovery-agent` + `discovery-feed-refresh` sind undeployt, UI gelöscht, bleiben es | `HANDOFF.md` („Edge Functions"), `config.toml` | Alles Neue heißt `kompass*`, nichts `discovery*` |
| Letzte GEPUSHTE Migration: `0070`. **`0071` liegt fertig, aber ungepusht** — mit Wächter, der abbricht, solange Alt-Doppel im Bestand liegen (27 überzählige Zeilen, Bereinigung offen) | `docs/BACKLOG.md` Runde 14.08., `supabase/migrations/0071_…` | **Die Falle dieser Runde.** K3 regelt Reihenfolge + STOPP-Trigger |
| Welt-2-Tokens: `--portal-bg #0A1128`, Text `#eef1f8/#a3adc4/#6b7590`, Gold `#C5A059`, Karten `rgba(28,38,64,0.5)`; Projekt-Akzent bleibt Detail-Akzent, Gold ist Rahmen | `docs/phase2/DESIGN-TOKENS.md:76-92`, `pages/portal/ClientPortal.tsx:29-36` | K4/K6 bauen ausschließlich mit diesen Tokens |
| KLAR-Kennenlernen = Discovery-Workshop (6 Kernfragen) + Visual-Analyse (Spektren, Zitate, Anti-Referenzen) | Vault: `07 Templates/Geschäft & Branding/Discovery & Branding – Prozess-Template.md:59-92` | Inhalts-Fundament unten ist die Übersetzung; Fragen wörtlich übernehmen |

**RECON NEEDED (Executor klärt in K0, bevor er baut):**

- **R1 — 0071-Lage zum Ausführungszeitpunkt:** `supabase migration list` (oder
  Trockenlauf `db push --dry-run`). Ist 0071 inzwischen gepusht → K3 normal.
  Liegt 0071 weiter ungepusht → Trigger in K3.
- **R2 — Geladene Fonts:** `app/index.html` — welche Familien/Weights der
  Google-Fonts-Link wirklich lädt. Instrument Serif ohne Italic → Kachel-Stile
  entsprechend wählen.
- **R3 — Andockpunkt im Cockpit:** `cockpit/pages/…/ProjectPage.tsx` (Pfad per
  Glob suchen) — wo der Ergebnis-Abschnitt (K7) strukturell hingehört
  (bestehende Karten-Sektionen, kein neues Layout-System).
- **R4 — `deliver_projects.deleted_at`** existiert (usePortalProject filtert
  darauf) — beim RLS-Test in K8 mitdenken, gelöschte Projekte dürfen keinen
  Kompass laden.

---

## Entscheidungen (getroffen — nichts davon neu verhandeln)

- **D1 — Name.** Code-Präfix ist `kompass` (Dateien, Tabelle, Function).
  Der ANZEIGENAME im Portal ist Kevins Geschmacksentscheid und steht im
  LEDGER; bis dahin trägt die UI „Marken-Kompass" als Platzhalter, an genau
  einer Stelle konstant gehalten (`lib/kompassInhalt.ts` → `KOMPASS_TITEL`).
- **D2 — Ein Lauf je Projekt.** `kompass_laeufe` hat `unique(project_id)`.
  Neustart = bestätigter Reset derselben Zeile (Antworten leeren, Status
  zurück). Keine Versionshistorie im MVP.
- **D3 — Stimuli sind selbst gerenderte Stil-Kacheln**, keine Screenshots
  fremder Websites (Rechte, Wartung, Achsen-Reinheit). Eine Kachel ist eine
  Mini-Hero-Vorschau (Fläche, Headline, Subline, Knopf-Attrappe), gerendert
  aus einem Stil-Parameter-Objekt. Beide Kacheln eines Duells unterscheiden
  sich in GENAU EINEM Parameter-Satz (der Achse); Inhalts-Text ist identisch
  und makler-neutral („Ihr Zuhause verdient Klarheit." o. ä. aus
  `kompassInhalt.ts`). Echte Referenz-Screenshots sind Phase 2 (LEDGER).
- **D4 — Fünf Ästhetik-Achsen, sechs Regler, sechs Anti-Karten, sechs
  Kernfragen** — exakt die Inhalte im Abschnitt „Inhalts-Fundament". Der
  Executor erfindet keine Items dazu und lässt keine weg.
- **D5 — Widerspruchs-Regel (deterministisch):** Jede Ästhetik-Achse wird
  doppelt gemessen — über die Duelle (Score aus Wahlen) und über das
  Regler-Mapping (Tabelle unten). Weichen beide Messungen um ≥ 40 Punkte
  (Skala 0–100) voneinander ab, gilt die Achse als **gespannt**: der Flow
  blendet GENAU EIN Zusatz-Duell dieser Achse ein (aus dem Reserve-Pool),
  und die Spannung wandert benannt in Synthese + Kevin-Ansicht. Maximal
  zwei Zusatz-Duelle pro Lauf (die zwei größten Deltas).
- **D6 — Zwischenstand ist heilig.** Nach jedem Schritt (jedem Duell, jedem
  Regler, jeder Frage) wird der Stand per Upsert in `kompass_laeufe.antworten`
  gesichert. Reload/Wiederkommen nach Tagen setzt exakt dort fort. Kein
  localStorage als Wahrheit (nur als Latenz-Puffer erlaubt).
- **D7 — Synthese-Trigger:** automatisch beim Abschluss durch den Kunden
  (Status `fertig` → Function-Call aus dem Client), plus Knopf „Synthese neu
  rechnen" nur in Kevins Cockpit-Ansicht. Modell: `ANTHROPIC_MODEL`-Secret,
  Default `claude-sonnet-5` (Ein-Schuss-Textjob mit Schema — Opus/Fable wäre
  Geldverschwendung; per Secret jederzeit hochdrehbar).
- **D8 — Die Function schreibt mit der USER-Session** (Muster `uriel`):
  der Kunde darf per RLS nur seine eigene Zeile aktualisieren, also braucht
  es keinen Service-Role-Key im Spiel.
- **D9 — Zwei Sichten auf ein Ergebnis.** Kunde sieht: Profil-Kurzfassung
  (Achsen-Bild, drei Sätze, „was wir daraus machen"). NUR Kevin sieht:
  Spannungen, Call-Fragen, North-Star-Hypothesen, Template-Parameter,
  Build-Prompt. Die Trennung liegt im Ergebnis-JSON (`kunde` / `intern`),
  die Portal-UI rendert ausschließlich `ergebnis.kunde`.
- **D10 — Keine automatische Portal-Nachricht** bei Abschluss. Der Status
  („Kompass abgeschlossen") erscheint in Kevins Projektbereich; ob und wie
  Kevin reagiert, bleibt sein Zug. (Der bestehende Nachrichten-Pfad bleibt
  unberührt — Tabu-Liste.)
- **D11 — Kevins Ansicht wohnt in der bestehenden `ProjectPage`** (Cockpit,
  `/projekte/:id`) als eigene Karte im vorhandenen Sektionsmuster (R3) —
  kein neuer Bereich, keine neue Route im Cockpit.
- **D12 — Mobile-Ernst:** Duelle untereinander (nicht nebeneinander) unter
  768; Tap-Ziele ≥ 44 px; die gewählte Kachel quittiert sichtbar (Rahmen in
  `--portal-gold`), dann Auto-Weiter nach ~350 ms. Kein Wisch-Zwang.

---

## Inhalts-Fundament (verbindlich — das ist der übersetzte KLAR-Prozess)

Alles Folgende lebt in `app/src/lib/kompassInhalt.ts` als typisierte
Konstanten (reine Daten, keine React-Importe).

### Die fünf Ästhetik-Achsen (je 3 Duelle + 1 Reserve-Duell)

Skala je Achse 0–100; 0 = linker Pol, 100 = rechter Pol. Jedes Duell trägt
`achse` + zwei Stil-Parameter-Objekte (`links`/`rechts` = Pol 0 / Pol 100).

| Achse | Pol 0 | Pol 100 | Kachel-Parameter, die kippen (alles andere identisch) |
|---|---|---|---|
| `dichte` | Reduziert, viel Luft | Reichhaltig, viel Information | Elementanzahl (nur Headline+Knopf ↔ Headline+Subline+3 Badges+Leiste), Innenabstand (48 ↔ 16), Zeilenlänge |
| `ton` | Hell (Creme/Weiß, dunkler Text) | Dunkel (Nacht-Flächen, heller Text) | Flächenfarbe + Textfarbe (Creme `#f6f3ec`/`#1c1c1c` ↔ Nacht `#101418`/`#f2efe8`) |
| `temperatur` | Kühl-sachlich (Blaugrau/Stahl) | Warm-wohnlich (Sand/Terracotta/Braun) | Akzent- und Flächen-Untertöne (`#5b6b7a`-Welt ↔ `#b08a5f`-Welt) |
| `typo` | Klassisch (Serif-Headline) | Modern (Grotesk-Headline, ggf. Versalien) | Headline-Familie (Georgia/Instrument Serif ↔ Inter/Archivo 700), letter-spacing |
| `auftritt` | Editorial-leise (kleine Headline, Understatement) | Plakativ-präsent (große Headline, starker Kontrast, CTA dominant) | Headline-Größe (22 ↔ 40), Knopf-Gewicht (Ghost ↔ gefüllt, groß), Kontrastspannung |

Reserve-Duell je Achse = gleiche Achse, anderes Inhalts-Motiv (z. B. statt
Hero eine Objektkarte) — wird nur bei Spannung (D5) gezeigt.
Reihenfolge der 15 Grund-Duelle: achsen-verschränkt (nie zwei gleiche Achsen
hintereinander), fest einkodiert, kein Zufall (Läufe müssen vergleichbar sein).

### Die sechs Selbstbild-Regler (0–100, Startwert 50, Pflicht)

1. `serioes_nahbar` — „klassisch-seriös" ↔ „locker-nahbar"
2. `etabliert_modern` — „etabliert & bewährt" ↔ „modern & herausfordernd"
3. `exklusiv_zugaenglich` — „wenige große Mandate" ↔ „viele, breit zugänglich"
4. `diskret_sichtbar` — „diskret im Hintergrund" ↔ „sichtbar als Gesicht der Marke"
5. `sachlich_emotional` — „Zahlen & Fakten" ↔ „Geschichten & Gefühl"
6. `regional_ueberregional` — „regional verwurzelt" ↔ „überregional ambitioniert"

**Regler→Achsen-Mapping für die Widerspruchs-Regel (D5):**

| Regler | erwartete Achsen-Tendenz |
|---|---|
| `serioes_nahbar` → 0 | `typo` Richtung 0 (klassisch), `auftritt` Richtung 0 |
| `etabliert_modern` → 100 | `typo` Richtung 100 (grotesk) |
| `exklusiv_zugaenglich` → 0 | `dichte` Richtung 0 (reduziert), `auftritt` Richtung 0 |
| `diskret_sichtbar` → 100 | `auftritt` Richtung 100 |
| `sachlich_emotional` → 100 | `temperatur` Richtung 100 (warm) |
| `regional_ueberregional` | kein Achsen-Mapping (reines Strategie-Signal für die Synthese) |

Erwartungswert je Achse = Mittel der gemappten Regler (linear skaliert);
Achsen ohne Mapping-Treffer (z. B. `ton`) haben keinen Widerspruchs-Check.

### Die sechs Anti-Karten (Auswahl: genau 2 ankreuzen)

Sechs Stil-Kacheln als Makler-Archetypen, gerendert mit demselben
Kachel-Renderer: `blau_corporate` („Sparkassen-Blau, Badge-Leiste"),
`schwarz_luxus` („Schwarz-Gold, Versalien"), `beige_boutique` („Creme,
Serifen, Understatement"), `portal_bunt` („viel Farbe, viele Störer"),
`foto_emotion` („großes Wohnfoto, emotionale Headline"),
`minimal_editorial` („fast leer, ein Satz"). Pflichtfrage darunter (ein
Freitextfeld): „Was genau stört dich an den beiden?"

### Die sechs Kernfragen (Textfelder, aus dem KLAR-Template — Wortlaut so)

1. Wie ist dein Unternehmen entstanden? Erzähl die Geschichte ruhig so, wie
   du sie einem Freund erzählen würdest. *(Ursprungsgeschichte)*
2. Welches Problem löst ihr wirklich — und für wen?
3. Wenn du nur an EINE Person verkaufen dürftest, die für den Großteil
   deines Erfolgs steht: Wer ist das? Beschreib sie konkret.
4. Was soll jemand FÜHLEN, wenn er mit deiner Marke in Kontakt kommt?
5. Wie sieht dein Geschäft in einem Jahr aus? Und in drei?
6. Welche Wettbewerber hast du vor Ort — und was machen die aus deiner
   Sicht falsch oder richtig?

Pflicht: 1–4. Optional: 5–6 (überspringbar, wird in der Synthese als
„nicht beantwortet" geführt, nicht erfunden — Kevins Regel „nichts
erfinden" gilt maschinell).

### Ergebnis-Schema der Synthese (JSON, hart validiert)

```jsonc
{
  "kunde": {                       // das Einzige, was das Portal rendert (D9)
    "ueberschrift": "…",           // z. B. „Warm, reduziert, mit klassischer Note"
    "beschreibung": "…",           // 3–5 Sätze, du-Form, Erwachsenen-Deutsch
    "achsen": [{ "key": "dichte", "wert": 0-100, "label_links": "…", "label_rechts": "…" }],
    "naechster_schritt": "…"       // ein Satz: was HERRMANN daraus macht
  },
  "intern": {
    "nordstern_hypothesen": ["…", "…", "…"],
    "wortwelt": { "ja": ["…"], "nein": ["…"] },      // word_bank-kompatibel
    "template_parameter": {
      "farbwelt": "…", "typo": "…", "dichte": "…",
      "bildsprache": "…", "tonalitaet": "…"
    },
    "spannungen": [{ "achse": "…", "befund": "…", "frage_fuer_call": "…" }],
    "call_fragen": ["…"],          // 3–5, priorisiert
    "build_prompt": "…"            // fertiger Absatz für den Website-Erstentwurf
  }
}
```

---

## Züge

### K0 — Recon & Baseline (nichts verändern)

**Aktion:** `git status` + Branch prüfen (`cockpit-rebuild`, sauber) ·
Baseline: `cd app && npx tsc -b && npm run build`, dann alle
`scripts/verify-*.ts` — alles muss VOR dem ersten Edit grün sein · R1–R4
klären (Migration-Lage, Fonts, ProjectPage-Andockpunkt, `deleted_at`).

**Erwartete Beobachtung:** Baseline grün; R1 sagt eindeutig, ob 0071
gepusht ist.

**Wahrscheinlichster Fehler:** Baseline ist NICHT grün (uncommittete Arbeit
oder roter verify — bei diesem Repo historisch der Normalfall, HANDOFF
Falle 6). **Signal:** `git status` zeigt Änderungen / ein verify bricht.
**Gegenzug:** STOPP und melden — nie über fremde uncommittete Arbeit
hinwegbauen.

### K1 — Inhalts-Fundament + Kachel-Renderer

**Aktion:** `app/src/lib/kompassInhalt.ts` (Typen + alle Konstanten aus dem
Inhalts-Fundament, `KOMPASS_TITEL`) und
`app/src/components/portal/KompassStilKachel.tsx` (rendert ein
Stil-Parameter-Objekt als Mini-Hero; präsentational, kein Fetch). Dazu eine
Dev-only-Sichtprüfung: die Duelle in einer temporären Story/Route einmal
alle rendern (Screenshot für die Runde), danach Dev-Route wieder raus.

**Erwartete Beobachtung:** 15 Duelle + 5 Reserven + 6 Anti-Karten rendern;
in jedem Duell unterscheiden sich die Kacheln sichtbar in genau einer
Dimension; Text identisch.

**Wahrscheinlichster Fehler:** Achsen-Verschmutzung — die `typo`-Kacheln
unterscheiden sich AUCH in Größe/Farbe, weil Serif optisch anders läuft.
**Signal:** Sichtprüfung: man kann nicht benennen, WAS kippt, oder es
kippen zwei Dinge. **Gegenzug:** Parameter-Diff je Duell im Code erzwingen —
ein `verify`-Fall (K2) prüft maschinell, dass sich `links`/`rechts` nur in
den Feldern der deklarierten Achse unterscheiden.

### K2 — Deterministische Auswertung + Drift-Wache

**Aktion:** `app/src/lib/kompassAuswertung.ts` — reine Funktionen:
`achsenScores(antworten)`, `reglerErwartung(regler)`,
`findeSpannungen(scores, erwartung)` (D5-Schwelle 40, Top-2),
`naechsterSchritt(antworten)` (Flow-Fortschritt inkl. adaptiver Duelle),
`istVollstaendig(antworten)`. Dazu `scripts/verify-kompass.ts`:
Extremläufe (alles links / alles rechts), Widerspruch beidseitig, Abbruch
mitten im Lauf, leere Optionalfragen, Parameter-Reinheit der Duelle (aus K1),
Reihenfolge „nie zweimal dieselbe Achse hintereinander".

**Erwartete Beobachtung:** verify-Suite läuft mit dem neuen Skript grün;
die Fälle decken jede Regel aus D5 ab.

**Wahrscheinlichster Fehler:** Skalen-Verdreher (ein Duell zählt für Pol 0,
wird aber als 100 gebucht) — der klassische stille Fehler, den erst der
Extremlauf entlarvt. **Signal:** „alles links" ergibt nicht 0 auf allen
Achsen. **Gegenzug:** Extremlauf-Fälle zuerst schreiben, dann implementieren.

### K3 — Migration 0072 + Function-Registrierung

**Aktion:** `supabase/migrations/0072_kompass_laeufe.sql`:

- Tabelle `kompass_laeufe`: `id uuid pk`, `project_id uuid fk
  deliver_projects unique`, `status text` (`laufend`·`fertig`·
  `synthese_fehlt`·`ausgewertet`), `antworten jsonb default '{}'`,
  `ergebnis jsonb`, `synthese_model text`, `created_at`, `updated_at`,
  `abgeschlossen_am timestamptz`.
- RLS an: Client liest/schreibt NUR die Zeile seines Projekts
  (`user_roles.project_id`-Muster aus `0012_client_access.sql` — vorher
  frisch lesen, auch `0038_deliver_messaging_portal.sql` als zweites
  Vorbild); Owner (via `brands.user_id`) liest/schreibt alles. `ergebnis`
  wird vom Client nur über die Edge Function beschrieben (dieselbe Session,
  aber die UI bietet keinen Schreibpfad — RLS unterscheidet das nicht,
  siehe Red-Team RT4).
- `supabase/config.toml`: `[functions.kompass-synthese] verify_jwt = true`.

**Trigger (die 0071-Falle, aus R1):**

- 0071 ist gepusht → `db push`-Trockenlauf muss GENAU `0072` wollen; sonst STOPP.
- 0071 liegt weiter ungepusht → der Trockenlauf wird 0071+0072 wollen, und
  **0071 hat einen Wächter, der abbricht, solange die 27 Alt-Doppel im
  Bestand liegen** (Backlog 14.08.). Dann: **STOPP und melden** — die
  Bereinigungs-Reihenfolge (Fortschritt retten → bereinigen → push) ist
  Kevins offener Punkt aus der 14.08.-Runde und NICHT Teil dieser Mission.
  Kompass-Arbeit an K4–K7 (alles ohne DB) darf weiterlaufen; K8-Abnahme
  bleibt blockiert, bis die Migration durch ist.

**Erwartete Beobachtung:** `db push` spielt 0072 ein; `supabase migration
list` zeigt Local = Remote lückenlos.

**Wahrscheinlichster Fehler:** RLS-Policy vergisst den Owner-Pfad — Kevin
sieht im Cockpit nichts, obwohl der Kunde speichert. **Signal:** K7 zeigt
leere Karte trotz `status='fertig'`. **Gegenzug:** RLS-Gegenprobe gehört in
K8 (beide Rollen), nicht erst in die Fehlersuche.

### K4 — Test-Flow im Portal

**Aktion:** Route `/portal/:projectId/kompass` in `App.tsx` (im bestehenden
Portal-Block, hinter demselben Gate wie `PortalRoute`);
`pages/portal/KompassPage.tsx` mit den Schritten Intro → Stil-Duelle →
Regler → Anti-Auswahl → Kernfragen → Abschluss. Fortschrittsanzeige („Teil
2 von 4"), Zwischenstand-Upsert nach jedem Schritt (D6), Wiedereinstieg aus
`antworten`, Reset nur mit Bestätigungsdialog (D2). Abschluss setzt
`status='fertig'` + stößt die Synthese an (K5) und zeigt bis zu deren
Antwort einen ruhigen Warte-Zustand („Dein Profil entsteht…", max. 60 s,
danach freundlicher Hinweis + das Profil erscheint später von allein).

**Erwartete Beobachtung:** kompletter Durchlauf im Dev-Build
(`?preview=true` lädt localStorage-Projekt — funktioniert NUR im Dev-Build,
PortalRoute D10); Reload mitten im Lauf setzt exakt am nächsten offenen
Schritt fort.

**Wahrscheinlichster Fehler:** Upsert-Konflikt — zwei schnelle Antworten
überholen sich, der spätere Schreibstand verliert die frühere Antwort.
**Signal:** nach schnellem Durchklicken fehlen einzelne Antworten in der
DB-Zeile. **Gegenzug:** ein Schreibpfad mit Serialisierung (eine
in-flight-Promise, nächster Upsert wartet), Antworten-Objekt wird immer
VOLLSTÄNDIG aus dem lokalen Stand geschrieben, nie als Patch einzelner Keys.

### K5 — Edge Function `kompass-synthese`

**Aktion:** `supabase/functions/kompass-synthese/index.ts` nach dem
`uriel`-Gerüst (CORS, Key-Check, Bearer-Auth, `userClient`). Ablauf: Body
`{ projectId }` → Lauf laden (RLS filtert) → Prompt bauen (Achsen-Scores +
Regler + Anti-Auswahl inkl. Freitext + Kernfragen + Spannungen aus der
deterministischen Auswertung — die Function RECHNET NICHT selbst, sie
bekommt `scores`/`spannungen` als Teil der gespeicherten `antworten`) →
ein Anthropic-Roundtrip (`ANTHROPIC_MODEL` ?? `claude-sonnet-5`,
`max_tokens` großzügig, Antwort MUSS das Ergebnis-Schema als einziges
JSON-Objekt liefern) → validieren → `ergebnis` + `status='ausgewertet'` +
`synthese_model` schreiben. Prompt-Regeln: du-Form für `kunde.*`,
Erwachsenen-Deutsch, KEINE erfundenen Fakten (unbeantwortete Fragen heißen
„nicht beantwortet"), `intern.build_prompt` referenziert die
Template-Parameter.

**Erwartete Beobachtung:** `supabase functions deploy kompass-synthese`,
dann ein Testaufruf mit einem vollständigen Lauf → Zeile trägt valides
`ergebnis`, Status `ausgewertet`.

**Wahrscheinlichster Fehler:** Modell antwortet mit Prosa/Markdown um das
JSON herum. **Signal:** `JSON.parse` scheitert oder Schema-Validierung
schlägt an. **Gegenzug:** genau EIN Retry mit hartem Nachsatz („NUR das
JSON-Objekt"); scheitert auch der → Rohtext in `ergebnis.raw` sichern,
`status='synthese_fehlt'`, Kunde sieht den freundlichen Später-Hinweis,
Kevin sieht in K7 den Neu-Rechnen-Knopf. **Zweiter bekannter Fehler:** 401
vom Anthropic-Endpoint — der Edge-Secret-Key war schon einmal ungültig
(HANDOFF Falle 7 / Backlog L6). **Signal:** 401 im Function-Log.
**Gegenzug:** nicht raten — melden, Kevin erneuert das Secret.

### K6 — Einstiegskarte im Portal

**Aktion:** Karte in `PortalShell` (zwischen `OutcomeHeader` und
`PhaseDashboard`): in der Branding-Phase (`phaseForStage(client_stage) ===
'branding'`) prominent — Titel, zwei Sätze, Status (offen: „Test starten
· ~15 Minuten" / laufend: „Weitermachen — Teil 2 von 4" / fertig:
Profil-Kurzfassung aus `ergebnis.kunde` direkt auf der Karte). Nach der
Branding-Phase kompakt („Dein Stil-Profil ansehen"). Gold ist Rahmen-,
Projektfarbe Detail-Akzent (Tokens-Doc-Regel).

**Erwartete Beobachtung:** Owner-Brille (`/portal/:id?als=kunde`) zeigt die
Karte in jedem der drei Zustände korrekt (Zustände per Testdaten
durchschalten).

**Wahrscheinlichster Fehler:** Die Karte erscheint auch im
`PortalCrmShell`-Zweig (`/portal/:id/crm`), wo sie nichts verloren hat.
**Signal:** Karte auf der Leads-Ansicht. **Gegenzug:** Einbau
ausschließlich in `PortalShell`, nicht im gemeinsamen Layout.

### K7 — Kevins Ergebnis-Karte im Cockpit

**Aktion:** In der `ProjectPage` (R3) eine Karte „Kompass": Status,
Achsen-Profil kompakt, Spannungen + Call-Fragen, Template-Parameter,
`build_prompt` mit Kopier-Knopf (versandfertiger Arbeitstext — Kopieren
erlaubt), Knopf „Synthese neu rechnen" (ruft K5 erneut; nur Owner sieht
ihn). Vor `status='fertig'` zeigt die Karte den Fortschritt („Teil 2 von 4,
zuletzt vor 3 Tagen").

**Erwartete Beobachtung:** Cockpit-Projekt mit Testlauf zeigt alle
`intern`-Inhalte; Kopier-Knopf legt den Build-Prompt in die Zwischenablage.

**Wahrscheinlichster Fehler:** Cockpit-Welt-1-Tokens und Portal-Welt-2-Werte
vermischen sich (Karte im Cockpit MUSS `--ck-*` tragen, nicht
`--portal-*`). **Signal:** Goldtöne/Navy im Cockpit-Screenshot.
**Gegenzug:** Karte nutzt ausschließlich Cockpit-Tokens; nur DATEN kommen
aus dem Kompass.

### K8 — Abnahme der Runde

Reihenfolge fest: erst Technik, dann Rollen, dann Geräte-Maße.

1. `npx tsc -b` + `npm run build` grün; ALLE verify grün (inkl.
   `verify-kompass`).
2. **RLS-Gegenprobe (Pflicht, Sicherheits-Stopp bei Rot):** mit einer
   Client-Session Projekt A: eigene Kompass-Zeile lesbar/schreibbar; Zeile
   von Projekt B: 0 Zeilen bei Select, Fehler bei Upsert. Owner-Session:
   beide lesbar. (Testdaten über ein Wegwerf-Projekt; danach entfernen.)
3. E2E einmal komplett: Testlauf als Kunde (Dev-Preview oder Test-Account,
   LEDGER) → Abschluss → Synthese → Portal zeigt `kunde`-Kurzfassung →
   Cockpit zeigt `intern` + Build-Prompt.
4. Geräte-Maße: Portal-Flow bei 390×664 (kein Querscrollen, Tap-Ziele
   ≥ 44 px, Duelle untereinander) und 1280; Cockpit-Karte bei 390×664 und 1280.
5. Rückwirkende Stichprobe (Qualitäts-Beleg, kein Gate): einen fiktiven
   Lauf mit Reichentrog-artigen Antworten füttern (diskret-Regler links,
   plakativ-Duelle rechts) → die Synthese MUSS die `diskret_sichtbar`-
   Spannung benennen. Ergebnis im Runden-Protokoll festhalten.
6. Doku: BACKLOG-Runde (Muster der bestehenden Einträge: Züge, Verifikation,
   „bewusst nicht angefasst"), HANDOFF nur, falls sich am „Was existiert"
   etwas ändert (neue Route, neue Function — eine Zeile je Punkt).

---

## Abbruchbedingungen (stoppen und melden statt improvisieren)

- K0: Baseline rot oder Working Tree nicht sauber.
- K3: `db push`-Trockenlauf will etwas anderes als genau `0072` (bzw.
  0071-Wächter schlägt an) → DB-Teil stoppen, K4–K7 ohne DB-Abnahme weiter,
  Meldung an Kevin mit der exakten Trockenlauf-Ausgabe.
- K5: `ANTHROPIC_API_KEY` 401/fehlend → melden (Secret ist Kevins Zugriff).
- K8 Punkt 2: RLS-Gegenprobe zeigt Fremdzugriff → SOFORT stoppen, nichts
  weiter bauen, melden — mit offener RLS wird nicht weitergearbeitet.
- Jede nötige Abweichung von `DESIGN-TOKENS.md` → stoppen und fragen
  (Tokens-Doc-Regel: „Wer abweichen will, stoppt und fragt").
- Livegang (`main`-Push) ist in keiner Variante Teil dieser Mission.

---

## Red-Team-Protokoll (gegen die acht SUCCESS-Kriterien gefahren, 16.08.)

- **RT1 — „Kunde ruft `/portal/<fremde-id>/kompass` auf."** Gehalten:
  Route liegt hinter `RequireClientPortalGate`, das Clients hart auf ihr
  `clientProjectId` umleitet (`PortalRoute.tsx:63-65`-Muster), plus RLS als
  zweite Mauer (K3) und die Gegenprobe als Pflicht-Gate (K8.2).
- **RT2 — „Kunde bricht bei Duell 7 ab, kommt nach vier Tagen auf dem Handy
  wieder."** Gehalten über D6 (Upsert je Schritt, Wiedereinstieg aus der
  DB, localStorage nur Puffer).
- **RT3 — „`db push` reißt die ungepushte 0071 mit und der Wächter bricht
  ab."** Dieser Angriff kam DURCH die erste Fassung (sie sagte nur
  „Migration 0072 anlegen") — Patch: R1 als Pflicht-Recon + expliziter
  Trigger und Abbruchpfad in K3, DB-freie Züge laufen weiter.
- **RT4 — „Der Kunde schreibt sich per Devtools ein eigenes `ergebnis` oder
  `status='ausgewertet'`."** Teilweise durchgekommen: RLS kann Update auf
  die eigene Zeile nicht feldgenau verbieten. Patch: Schadensbewertung in
  die Blaupause — betroffen ist nur die EIGENE Zeile, sichtbar nur für ihn
  und Kevin; Kevins Ansicht zeigt `synthese_model` + Zeitstempel, und
  „Synthese neu rechnen" überschreibt jede Manipulation. Kein
  Service-Role-Umbau im MVP (bewusste Entscheidung, dokumentiert).
- **RT5 — „Die Synthese liefert Markdown-Prosa statt JSON."** Gehalten über
  K5-Gegenzug (ein Retry, dann `synthese_fehlt` + Rohtext gesichert + Kevins
  Neu-Rechnen-Knopf — der Kunde sieht nie einen Fehlerzustand, nur
  „später").
- **RT6 — „Zwei Tabs desselben Kunden gleichzeitig offen."** Gehalten über
  K4-Gegenzug (ein serialisierter Schreibpfad, Vollstand statt Patch —
  letzter Vollstand gewinnt, keine Key-Leichen).

---

## LEDGER — Inputs, die nur Kevin liefern kann

| Platzhalter | Was fehlt | Blockiert |
|---|---|---|
| `{{ANZEIGENAME}}` | Wie das Tool für Kunden heißt („Marken-Kompass" ist Platzhalter — Geschmack entscheidet Kevin) | Nichts — eine Konstante, jederzeit änderbar |
| `{{0071_WEG}}` | 0071-Bereinigung + Push (offener Punkt der 14.08.-Runde) ODER Kevins Go für die dokumentierte Reihenfolge | K3/K8, falls R1 „ungepusht" ergibt |
| `{{TEST_KUNDE}}` | Ein Test-Kunden-Login (via `invite-client`) für die echte Rollen-Abnahme — Dev-Preview + Owner-Brille decken fast alles, echten Client-Login ersetzt das nicht | K8.2/K8.3 in der scharfen Variante |
| `{{REFERENZ_SCREENSHOTS}}` | Optional, Phase 2: kuratierte echte Makler-Referenzen als zweiter Duell-Pool | Nichts im MVP |
| Livegang | Fast-Forward auf `main` | Immer Kevins Wort |

---

## Bestanden, wenn (SUCCESS-Kriterien dieser Blaupause)

1. Jeder Zug K0–K8 hat erwartete Beobachtung, wahrscheinlichsten Fehler mit
   Signal und Gegenzug — steht oben.
2. Jede Weggabelung trägt einen Trigger (0071-Lage, Synthese-Retry,
   RLS-Rot) — kein Ermessen beim Executor.
3. Offene Annahmen sind als R1–R4 bzw. `{{…}}` im LEDGER markiert.
4. Abbruchbedingungen existieren und stehen VOR der Abnahme.
5. Verifikation ist ausbuchstabiert (K8, Reihenfolge fest, RLS als
   Pflicht-Gate).
6. Red-Team gefahren; RT3 und RT4 haben die Blaupause verändert und stehen
   im Protokoll.
7. Inhalts-Fundament ist vollständig (Achsen, Parameter, Regler, Mapping,
   Anti-Karten, Fragen, Schema) — der Executor erfindet keine Inhalte.
8. Blind ausführbar: Opus 5 auf `xhigh` kann K0–K8 ohne Rückfrage fahren
   und stoppt exakt an den markierten Stellen.
