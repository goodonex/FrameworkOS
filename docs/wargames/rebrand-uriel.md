> **Ausgeführt (M0 fertig)** — offene Punkte stehen in
> [`../BACKLOG.md`](../BACKLOG.md). Gültig und **weiter bindend** bleibt die
> Tabelle „Explizit NICHT anfassen": localStorage-Namespace `brand-os`,
> `frameworkos.de` im Lead-Eingang, Supabase-Ref, Ablage-Wurzel `~/Kevin OS/`.

# WARGAME — Rebrand: Framework OS / brand-os / Kevin OS → URIEL

**Mission:** Alle sichtbaren Namen des Programms auf **Uriel** vereinheitlichen (Repo, UI, Doku, Vault, launchd, GitHub). Ausführung durch ein Executor-Modell (Sonnet) in eigener Session, Start-CWD: dieses Repo. Diese Blaupause ist blind ausführbar — keine Ermessensentscheidungen.

**Inventur-Stand:** 2026-07-19 durch Fable erhoben (grep über Repo, `~/.claude/`, Vault). Zeilennummern sind Stand der Inventur — **immer per grep verifizieren, nie blind an die Zeile springen.**

---

## Namensarchitektur (die Entscheidung hinter allem)

| Ebene | Regel |
|---|---|
| Sichtbare/benennbare Namen (UI, Doku, Repo, Vault, Gespräche) | → **Uriel**, überall |
| Ablage-Wurzel `~/Kevin OS/` | **bleibt** (PARA-Ablage ≠ Produkt; Runner-Pfade `runner/index.mjs:58,66` + 5 Skills + CLAUDE.md hängen dran) |
| Technische Identifier mit Bruchrisiko | **bleiben v1**, siehe „Explizit NICHT anfassen" |
| Domain-Umzug frameworkos.de → uriel-os.de | **separate spätere Mission** (E-Mail-Lead-Eingang hängt an der Domain) |

Schreibweise: **Uriel** in Prosa/UI-Titeln (im Nebula-Header versal: `URIEL`), `uriel` als technischer Slug (package.json, Ordner, GitHub).

---

## Zug 0 — Vorbedingungen (Abbruch-Gate)

**Aktion:**
```bash
cd "/Users/kevinherrmann/Kevin OS/02 Projekte/brand-os"
git status --short
git branch --show-current
(cd app && npm run build)
curl -s http://127.0.0.1:4711/agents | head -c 200
```
**Erwartete Beobachtung:** Working Tree sauber ODER nur unversionierte Wargame-/Scratch-Dateien; Branch `cockpit-rebuild`; Build grün; `/agents` liefert JSON.
**RECON NEEDED (hiermit erledigt der Check):** Stand 2026-07-17 lag die Content-Post-Ebene uncommittet auf `cockpit-rebuild`. **Trigger:** Uncommitted Änderungen an Code-Dateien → **STOPP**, Kevin melden („erst committen oder stashen?"), nichts rebranden auf schmutzigem Tree.
**Trigger:** Build rot vor jeder Änderung → **STOPP** (nicht auf kaputter Basis rebranden).
**Trigger:** `/agents` nicht erreichbar → Runner-Zustand notieren, weiter (Zug 4 installiert eh neu), aber in Zug 4 KEINEN Vorher/Nachher-Vergleich behaupten.

## Zug 1 — Sichtbare UI-Strings

**Aktion:** Einzel-Edits (KEIN sed über Code):
1. `app/src/cockpit/graph/OsNebula.tsx` (~Z.810): Header `KEVIN OS` → `URIEL` (Kontext: `· NEBULA`).
2. `app/src/cockpit/graph/nebulaLayout.ts` (~Z.335 und ~Z.471): `coreNode('KEVIN OS', 'CLAUDE · DER ROUTER')` → `coreNode('URIEL', 'CLAUDE · DER ROUTER')` — **beide** Vorkommen.

**Erwartete Beobachtung:**
```bash
grep -rn "KEVIN OS" app/src/   # → 0 Treffer
(cd app && npm run build)      # → grün
```
**Wahrscheinlichster Fehler:** Es gibt mehr Vorkommen als die Inventur fand (Code ist seit 19.07. weitergewachsen). **Signal:** grep > 0 nach den Edits. **Gegenzug:** jedes weitere Vorkommen einzeln lesen + editieren, bis grep 0; nur String-Literale ändern, keine Variablennamen.

## Zug 2 — Projekt-Identität + Doku + Aufräumen

**Aktion:**
1. Root-`package.json`: `"name": "brand-os"` → `"name": "uriel"`. Auch `app/package.json` und `runner/package.json` prüfen (`grep -l '"name"' */package.json package.json`) — jedes `brand-os`/`framework`-Name-Feld → `uriel`-Varianten (`uriel-app`, `uriel-runner` falls eigene Namen).
2. Doku-Ersetzung NUR auf Markdown: in `README.md`, `HANDOFF.md`, `docs/AGENTIC-OS-PLAN.md`, `docs/CONTENT-MODUL-BRIEFING.md`, `docs/REBUILD-PLAN.md`, `docs/rebuild-notes.md`, `docs/wargames/content-modul-mvp.md`: „Framework OS" → „Uriel", „brand-os" → „uriel", „Kevin OS" NUR wo es das Programm meint — wo es den Ablage-Ordner `~/Kevin OS/` meint (Pfade!), **stehen lassen**.
3. `app/vercel.json` löschen (stale — Deploy ist Netlify, `netlify.toml` ist die Wahrheit).

**Erwartete Beobachtung:** `grep -rn "brand-os" --include="*.md" .` → 0 Treffer außer ggf. historischen Pfad-Zitaten in wargames (okay wenn als Alt-Pfad gekennzeichnet); `ls app/vercel.json` → not found; Build weiter grün.
**Wahrscheinlichster Fehler:** sed ersetzt in Pfad-Angaben `~/Kevin OS/02 Projekte/brand-os` das `brand-os` — der Pfad wird aber in Zug 3 real umbenannt, dann STIMMT `…/uriel`. **Gegenzug:** Pfad-Erwähnungen in Doku bewusst auf den NEUEN Pfad `~/Kevin OS/02 Projekte/uriel` umschreiben (konsistent mit Zug 3), `~/Kevin OS`-Anteil unangetastet.

## Zug 3 — Repo-Ordner umbenennen (erst Dienst stoppen!)

**Aktion — Reihenfolge zwingend:**
```bash
# 1. Runner stoppen (läuft AUS diesem Ordner):
launchctl bootout gui/$(id -u)/de.kevinos.cockpit-runner 2>/dev/null; sleep 1
# 2. Sicherstellen, dass kein Dev-Server/Prozess im Ordner läuft:
lsof +D "/Users/kevinherrmann/Kevin OS/02 Projekte/brand-os" 2>/dev/null | head -5
# 3. Umbenennen:
mv "/Users/kevinherrmann/Kevin OS/02 Projekte/brand-os" "/Users/kevinherrmann/Kevin OS/02 Projekte/uriel"
cd "/Users/kevinherrmann/Kevin OS/02 Projekte/uriel" && git status --short
```
**Erwartete Beobachtung:** `mv` still; `git status` funktioniert im neuen Pfad (git ist pfad-relativ, node_modules bleibt gültig, `.netlify/state.json` ist siteId-basiert = pfadunabhängig).
**Wahrscheinlichster Fehler:** Prozess hält den Ordner (Vite-Dev, Runner-Restart durch KeepAlive). **Signal:** launchd startet den Runner sofort neu (KeepAlive!) und der crasht mit ENOENT auf den alten Pfad. **Gegenzug:** bootout MUSS vor mv erfolgen (entfernt den Job inkl. KeepAlive); wenn nach mv ein Crash-Loop im Log steht (`log show --last 5m | grep cockpit-runner` oder Runner-Logdatei), ist das der alte Job → Zug 4 heilt das durch Neuinstallation.

## Zug 4 — launchd neu als `de.uriel.runner`

**RECON NEEDED (Check zuerst):** `cat scripts/install-runner-autostart.sh` — liest das Script den Repo-Pfad dynamisch (`$(pwd)`/`dirname $0`) oder hart? Danach richten sich die Edits.
**Aktion:**
1. Im Script `PLIST_LABEL="de.kevinos.cockpit-runner"` → `"de.uriel.runner"`; hart kodierte Pfade auf `…/02 Projekte/uriel/…` anpassen. In `runner/index.mjs` (~Z.426) dieselbe Label-Erwähnung mitziehen; ~Z.48 `frameworkos.de`-Erwähnung: nur Kommentar/CORS? Lesen — CORS-Origin für frameworkos.de MUSS bleiben (Live-Site heißt weiter so), Kommentare dürfen Uriel sagen.
2. Alte plist entfernen: `rm -f ~/Library/LaunchAgents/de.kevinos.cockpit-runner.plist`
3. Script ausführen (installiert + startet neu), dann:
```bash
launchctl list | grep -i uriel          # → Job existiert, PID vorhanden
curl -s http://127.0.0.1:4711/agents | head -c 200   # → JSON
launchctl list | grep -i kevinos        # → 0 Treffer
```
**Wahrscheinlichster Fehler:** plist zeigt auf alten Pfad → ENOENT-Crash-Loop (bekanntes Muster aus Juli: claude/PATH-Problem äußerte sich genauso). **Signal:** `launchctl list` zeigt Status ≠ 0 / keine PID, `/agents` bleibt tot. **Gegenzug:** plist-Inhalt lesen (`cat ~/Library/LaunchAgents/de.uriel.runner.plist`), Pfad fixen, `launchctl bootout` + erneut bootstrappen. **Nach 2 Fehlversuchen → ABBRUCH-Regel unten.**

## Zug 5 — GitHub-Repo umbenennen

**Aktion:**
```bash
gh repo rename uriel --repo goodonex/FrameworkOS --yes
git remote set-url origin https://github.com/goodonex/uriel.git
git ls-remote origin HEAD    # → Hash kommt zurück
```
**Erwartete Beobachtung:** `gh` bestätigt Rename; `ls-remote` liefert einen Hash. GitHub leitet die alte URL um (Redirect bleibt bestehen — kein Bruch für alte Clones).
**Wahrscheinlichster Fehler:** Netlify-GitHub-Verknüpfung verliert das Repo. **Signal:** nächster Deploy schlägt fehl / Netlify-Dashboard zeigt „repository not found". **Gegenzug/Trigger:** Netlify zieht Renames über die GitHub-App normalerweise automatisch nach → NICHT proaktiv anfassen; NUR wenn ein späterer Deploy bricht: Kevin bitten, im Netlify-UI (Site `frameworkos1` / siteId `5507edf2-…`) das Repo neu zu verknüpfen. **Kein Push auf `main` in dieser Mission** (Deploy-Gate liegt bei Kevin).

## Zug 6 — Vault-Rebrand (12 Dateien + Projekt-Notiz)

**Aktion — Reihenfolge zwingend:**
```bash
cd "/Users/kevinherrmann/Second Brain" && git pull --rebase   # iPhone-Sync!
mv "02 Projekte/Framework OS.md" "02 Projekte/Uriel.md"
```
Dann in `Uriel.md` oben ins Frontmatter Aliase ergänzen (alte Suchen/Links bleiben lebendig):
```yaml
aliases: [Framework OS, brand-os, Kevin OS (Programm)]
```
Dann Wikilinks global: `grep -rln "\[\[Framework OS" --include="*.md" .` → in jeder Datei `[[Framework OS]]` → `[[Uriel]]` (auch Varianten `[[Framework OS|…]]` → `[[Uriel|…]]`).
Dann Prosa-Erwähnungen in den restlichen Treffern (Inventur: `03 Bereiche/` 7 Dateien, `00 Kontext/` 2, `01 Inbox/` 1, Root-`CLAUDE.md`): „Framework OS"/„brand-os" → „Uriel" **nur wo es Kevins Tool bezeichnet**.
**SKIP-Regel (kein Ermessen):** Dateien mit „Vereinbarung", „Vertrag" oder „Angebot" im Dateinamen (Inventur-Treffer: `…CoLective/…Partnerschaftsvereinbarung….md`, `00 Kontext/Angebot.md`) → **NICHT verändern**, nur im Abschluss-Report listen. Verträge/Angebote sind fixierte Dokumente.
Abschluss:
```bash
git add -A && git commit -m "Rebrand: Framework OS -> Uriel" && git push
```
**Erwartete Beobachtung:** `grep -rn "Framework OS" --include="*.md" .` → nur noch Treffer in geSKIPten Dateien + `Uriel.md`-Alias; push ohne Konflikt.
**Wahrscheinlichster Fehler:** Merge-Konflikt durch parallelen iPhone-Sync (Obsidian-Git pusht alle 5 Min). **Signal:** `git pull --rebase` oder push schlägt fehl. **Gegenzug:** einmal `git pull --rebase` erneut; bei echtem Konflikt → **STOPP**, Konfliktdateien melden, nichts force-pushen.

## Zug 7 — `~/.claude/`-Config

**Aktion:**
1. **RECON NEEDED (Check zuerst):** `head -5 ~/.claude/brain/brain-index.json` + `grep -n "index" ~/.claude/brain/brain.mjs | head` — ist der Index generiert? **Trigger:** Wenn generiert → nach Zug 6 einfach neu bauen (Aufruf-Form aus brain.mjs ablesen, vermutlich `node ~/.claude/brain/brain.mjs --reindex` o.ä.); die 3 „Framework OS"-Treffer verschwinden von selbst. Wenn handgepflegt → die 3 Treffer per Edit auf „Uriel".
2. `~/.claude/skills/domain-modeling/SKILL.md` (~Z.19+25): Beispiel „frameworkos.de / brand-os" → „uriel (Repo `~/Kevin OS/02 Projekte/uriel`)". Die anderen Skills (herrmann-outreach, klar-branding, kunden-feedback, video-to-vault) referenzieren nur `~/Kevin OS/…`-Pfade → **unangetastet**.
3. `~/.claude/CLAUDE.md` → **unangetastet** (nur Ablage-Pfade).
4. Memories in `~/.claude/projects/-Users-kevinherrmann-Claude-Code/memory/` → **unangetastet, bereits erledigt** (Fable hat am 19.07. `project_uriel.md` angelegt und den Index aktualisiert).

**Erwartete Beobachtung:** `grep -rn "Framework OS\|brand-os" ~/.claude/skills/ ~/.claude/brain/ 2>/dev/null` → 0 relevante Treffer (Binär-/Cache-Dateien ignorieren).

## Zug 8 — health-app-Querverweise (Kür, kein Blocker)

**Aktion:** `grep -rn "brand-os" "/Users/kevinherrmann/Kevin OS/02 Projekte/health-app/"` → Treffer in `README.md`, `src/lib/supabase.ts`, `supabase/migrations/0001_init.sql` sind laut Inventur nur Doku-/Kommentar-Verweise („Setup wie brand-os"). Markdown + Kommentare → „wie uriel"; **Code-Logik/SQL-Statements niemals ändern** — wenn ein Treffer in echtem Code/SQL-Statement steckt (nicht Kommentar), stehen lassen + im Report listen.
**Erwartete Beobachtung:** grep → 0 Treffer außer ggf. gelisteten Code-Stellen. Kein Build nötig.

## Zug 9 — Abschluss-Verifikation + Übergabe

**Aktion:**
```bash
cd "/Users/kevinherrmann/Kevin OS/02 Projekte/uriel"
grep -rn "KEVIN OS\|Framework OS\|FrameworkOS" --include="*.{ts,tsx,mjs,md,json,sh}" . | grep -v node_modules
(cd app && npm run build)
curl -s http://127.0.0.1:4711/agents | head -c 200
git add -A && git commit -m "Rebrand: Framework OS -> Uriel (UI, Doku, Identifier-Politik siehe docs/wargames/rebrand-uriel.md)"
```
**Erwartete Beobachtung:** grep zeigt NUR die Ausnahmen-Liste (unten); Build grün; Runner antwortet; Commit auf `cockpit-rebuild`. **KEIN Push auf `main`** — Live-Schaltung entscheidet Kevin.
**Abschluss-Report an Kevin (Pflichtformat):** (1) geänderte Dateien gruppiert, (2) Ausnahmen-Liste mit Begründung je Datei, (3) geSKIPte Vertrags-/Angebots-Dateien, (4) was Kevin selbst klicken muss: optional Netlify-Site-Name im UI, `main`-FF-Push für Live, Domain-Entscheidung.

---

## Explizit NICHT anfassen (v1 — bewusste Ausnahmen)

| Stelle | Warum |
|---|---|
| localStorage-Namespace `brand-os` (`app/src/lib/storage.ts`, `uiThemeStorage.ts`, `app/index.html:9`, `cockpitLayoutStorage.ts`, `sectionScrollPref.ts`, `contactFollowUpSync.ts`, `useNotifications.ts`, `ActivityModalHost.tsx`, `deliverProjectCoercion.ts`, `seedBrandFoundation.ts`) | Rename verwirft gespeicherte UI-Zustände (Theme, Layout, Notifications) aller Nutzer. Unsichtbar für Kevin. Migration = eigene spätere Mission, falls je nötig. |
| `frameworkos.de` in `supabase/functions/email-inbound/index.ts` (Lead-Regex!), `send-email/index.ts`, `ContactBccHint.tsx` | **Funktionaler Lead-Eingang** `leads+slug@frameworkos.de`. Änderung ohne Domain-Umzug = Lead-Verlust. |
| CORS/Origin-Einträge `frameworkos.de` in `runner/index.mjs` | Live-Site läuft weiter auf dieser Domain. |
| Supabase-Projekt-Ref `aegovajwkzukhvkjwiun`, Edge-Function-Namen (`brand-assistant` etc.), Netlify-siteId | Interne Identifier, Umbenennen = Bruchrisiko ohne Sichtbarkeitsgewinn. |
| Ablage-Wurzel `~/Kevin OS/` | Runner-Hardcodes (`runner/index.mjs:58,66`), 5 Skills, CLAUDE.md, cockpit-kunden.json hängen dran. Ablage ≠ Produkt. |

## Abbruchbedingungen (STOPP + melden statt improvisieren)

1. Zug 0: uncommitted Code-Änderungen oder roter Baseline-Build.
2. Zug 1/2: Build nach 2 Fix-Versuchen weiter rot → `git checkout -- .` (Rollback) + Report.
3. Zug 4: Runner nach 2 Neuinstallations-Versuchen im Crash-Loop → alte plist-Sicherung zurück (vor Zug 4 `cp` der alten plist nach `/tmp/`), Report.
4. Zug 6: Git-Konflikt im Vault, der sich nicht per einmaligem `pull --rebase` löst.
5. Irgendein Schritt verlangt einen Push auf `main` oder eine Domain-/DNS-Änderung → das ist NIE Teil dieser Mission.

## Folge-Missionen (bewusst NICHT hier drin)

- **Domain-Umzug → uriel-os.de** (Stand 19.07. frei; uriel.de vergeben, urielos.de auch frei): eigenes Wargame — Domain kaufen, Netlify-Domain hinzufügen, `email-inbound`-Regex auf BEIDE Domains erweitern, BCC-Hints umstellen, Übergangsphase, alte Domain als Redirect. Erst nach Kevins Kauf-Entscheidung.
- localStorage-Migration `brand-os` → `uriel` (nur falls je ein echter Grund entsteht).
- Netlify-Site-Rename `frameworkos1` → `uriel` (kosmetisch, Kevin im UI, 2 Minuten).

## LEDGER — offene Variablen

| Variable | Wer klärt | Wie |
|---|---|---|
| `{{uncommitted_stand}}` | Executor, Zug 0 | `git status --short` |
| `{{brain_index_generiert}}` | Executor, Zug 7 | brain.mjs lesen |
| `{{install_script_pfadlogik}}` | Executor, Zug 4 RECON | Script lesen |
| `{{domain_kauf}}` | **Kevin** | uriel-os.de ~15 €/J — Entscheidung steht aus, blockiert diese Mission NICHT |

## Red-Team-Protokoll (Angriffe gegen den Plan, vor Freigabe)

- **Angriff:** „Blindes `sed -i 's/brand-os/uriel/'` über den ganzen Repo-Baum wäre schneller." → **Durchgekommen wäre:** localStorage-Keys zerstört (State-Verlust) + E-Mail-Regex zerstört (Lead-Verlust). **Patch:** sed nur auf Markdown; Code ausschließlich Einzel-Edits; Ausnahmen-Tabelle ist Pflichtlektüre vor Zug 1. ✅ eingearbeitet.
- **Angriff:** „Ordner umbenennen, launchd läuft weiter." → KeepAlive-Crash-Loop auf totem Pfad. **Patch:** bootout zwingend VOR mv (Zug 3 Schritt 1). ✅ eingearbeitet.
- **Angriff:** „Vault-sed über alle 12 Treffer." → hätte die CoLective-Partnerschaftsvereinbarung umgeschrieben (Vertragsdokument!). **Patch:** SKIP-Regel per Dateinamens-Trigger. ✅ eingearbeitet.
- **Angriff (gescheitert):** „GitHub-Rename bricht alte Clones/CI." → GitHub redirects alte URLs dauerhaft; kein CI außerhalb Netlify; Netlify-GitHub-App zieht Renames nach. Kein Patch nötig, nur Verify-Trigger in Zug 5.

## SUCCESS — bestanden wenn

1. Jeder Zug wurde mit seiner Beobachtung verifiziert (grep-0-Stände, Build grün, Runner-200).
2. Ausnahmen-Liste unangetastet (grep in Zug 9 zeigt exakt sie und nichts anderes).
3. Vault gepusht ohne Konflikt, Vertrags-Dateien unverändert.
4. `launchctl list` kennt `de.uriel.runner`, `de.kevinos.cockpit-runner` existiert nicht mehr.
5. Kein Push auf `main`, keine Domain-Änderung.
6. Abschluss-Report im Pflichtformat liegt vor.
