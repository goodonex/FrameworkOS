> **Die Abnahmeliste unten ist vollständig erfüllt** — alle sechs Punkte sind
> gebaut, nur nie abgehakt (Beleg je Punkt in [`BACKLOG.md`](BACKLOG.md), §2).
> Gültig bleiben die OsNebula-Regeln und „bewusst NICHT übernommen".

# Agentic OS v2 — Plan (aus 3 Video-Analysen, 2026-07-07)

Quellen:
- RoboNuggets „Claude Fable 5 Built Me My Perfect Second Brain" (VoKiKvgpk78)
- RoboNuggets „Claude Fable 5 Use Cases You MUST Try Now" (_WXtkSvIDJs)
- Mark Kashef „Do THIS Before You Lose Access to Fable 5" (nuwlyQXrADg)

## Kernentscheidung

Der Obsidian-artige Wikilink-Blob im Cockpit (`ForceGraph`) wird ersetzt durch einen
**radialen Agentic-OS-Graph (OsNebula)** („RUBRIC"-Muster aus Video 1): Er zeigt nicht Deko,
sondern das Betriebssystem selbst — vier konzentrische Ebenen um einen Kern.

```
        ┌─ APPLICATIONS (außen, blau) — verbundene Tools/Dienste
        │   ┌─ ROUTINES (gelb) — geplante/automatische Läufe
        │   │   ┌─ MEMORY (violett) — Vault-Notizen, geclustert nach PARA-Bereich
        │   │   │   ┌─ SKILLS (innen, orange) — CLI- + Vault-Skills
        ○   ○   ○   ○   ● URIEL CORE (Claude)
```

Regeln (aus Video 1 übernommen):
- Jeder Node ist **klickbar** → Detail-Panel (Dateiinhalt für Skills/Notizen,
  Obsidian-Open für Vault-Notizen). Kein Node nur zur Zierde.
- Der Graph beantwortet zwei Fragen: *Was ist angeschlossen (und was sollte
  getrennt werden)?* und *Wo liegt was?* — Apps/Routinen, die keiner mehr nutzt,
  fallen sofort auf.
- Design bleibt Mission Control: dunkel, Monospace, 1px, ruhige Bewegung.
- Performance-Ziel als Abnahmekriterium: Erstrender < 2s, kein Ruckeln bei Zoom/Pan.

## Datenmodell (Runner)

Neuer Endpoint `GET /os/map` (runner/index.mjs):
- **skills**: `~/Second Brain/.claude/skills/*` + `~/.claude/skills/*`
  (Name + description aus SKILL.md-Frontmatter, Quelle vault|global)
- **routines**: launchd-Jobs `de.kevinos.*` + dream-check (täglich) + Cron/Scheduled
  aus `System/os-apps.json` (Abschnitt routines) — manuell erweiterbar
- **apps**: `System/os-apps.json` (Quelle der Wahrheit, von Claude/Kevin gepflegt)
  + MCP-Server aus `~/.claude.json` (falls vorhanden)
- **memory**: bestehender `/vault/graph` (Wikilink-Kanten) + Top-Level-Ordner
  (PARA) als Cluster-Zuordnung

Neuer Endpoint `GET /os/file?path=…`: read-only Inhalt für das Detail-Panel.
Pfad-Guard: nur Vault + `~/.claude/skills`.

## Was sonst aus den Videos übernommen wird

1. **/wargame-Skill** (Video 3, „Plan vs. Kriegsstrategie"):
   Nicht ausführen, sondern Mission auf dem Papier durchkämpfen — Move für Move,
   je Move: erwartete Beobachtung (Erfolg/Fehlschlag), wahrscheinlichster Fehler +
   Signal + Countermove, Trigger je Weggabelung, RECON NEEDED für ungeklärte
   Annahmen, Abort-Conditions am Ende. Struktur: `tasks/` (Missionen),
   `wargames/` (Ergebnis), `SUCCESS.md` (8 Kriterien, Selbstbenotung),
   `LEDGER.md` (Blocker + {{Variablen}}). Ergebnis: Blaupausen, die auch ein
   günstigeres Modell blind ausführen kann.

2. **/os-audit-Skill** (Video 2): Workspace-Audit wie ein Context Engineer.
   Erst Interview (nervt? heilig? wie aggressiv?), dann 6 Bereiche mit Score /10
   (CLAUDE.md-Delete-Test, Stale Pointers, Duplikate/Konflikte, Skills,
   MCP-vs-CLI, Safety). Report zuerst, EIN Fix-Batch nach Freigabe. file:line.

3. **/last30days-Skill** (Video 1+2): Deep Research über Reddit/X/YouTube/HN/Blogs,
   nur letzte 30 Tage, konsolidierter Report mit Quellen — Basis für „wie machen
   es die anderen"-Entscheidungen.

4. **/website-pipeline-Skill + Prompt-Bibliothek** (Kevins Kernwunsch):
   Kunden-Website als Fließband. Skill prüft erst Vollständigkeit der Inputs
   (KLAR-Leitbild, Positionierung, Texte, Bilder, Domain — und: **vom Kunden
   verifiziert?**), fragt nur Fehlendes ab, zieht dann automatisch die passenden
   Prompts aus `03 Bereiche/HERRMANN & CO/Website-Prompts.md`. Token-sparsam:
   Der Skill lädt nur die Prompt-Sektionen, die gebraucht werden.

5. **brain.mjs + Vault-Index** (Video 1, ~40 % Token-Ersparnis):
   Deterministisches Retrieval ohne LLM: `node System/brain.mjs "frage"` —
   Keyword-Scoring über einen Index (Pfade, Headings, Frontmatter), öffnet nur
   die Top-Datei, gibt nur die relevante Section aus, folgt Pointern.
   Vault-CLAUDE.md-Regel: erst brain.mjs, dann Grep/Read.

6. **/loop-Polish-Muster** (Video 2, als Notiz im Plan, kein eigener Build):
   Bei Design-Iterationen: „vorherige Iteration = Index 100, nächster Pass muss
   ≥ 120 landen" — schriftliches Abnahmekriterium statt Gefühl.

## Bewusst NICHT übernommen

- Sprachsteuerung, Partikel-Deko, Three.js (frühere Entscheidung bleibt).
- Sechs-Säulen-Meta-Systeme / eigener „Dream"-Ausbau — DreamCard bleibt klein.
- Semantic-Search-Embeddings (QMD): Overkill für ~100 aktive Notizen;
  Keyword-Scoring reicht und bleibt ohne API-Kosten.

## Abnahme (DoD)

- [ ] /os/map liefert echte Skills/Routinen/Apps/Memory
- [ ] OsNebula (Ringe·Nebula·Leads) ersetzt ForceGraph auf /cockpit, Nodes klickbar, Suche funktioniert
- [ ] Detail-Panel zeigt SKILL.md/Notiz-Inhalt, Obsidian-Open für Notizen
- [ ] 4 neue Skills liegen in ~/.claude/skills und laden sauber
- [ ] brain.mjs beantwortet eine echte Testfrage über den Vault
- [ ] Build grün, Screenshot an Kevin
