/**
 * Drift-Wache für die Schleuse (18.08.2026).
 *
 * Die Schleuse hält im Zweifel ALLE Agenten an. Ein falsches Urteil ist damit
 * teurer als jedes einzelne, das sie ersetzt: Ein zu strenges Tor bedeutet
 * einen Tag ohne Morgenbrief, ein zu laxes bringt genau die vier roten Zeilen
 * zurück, wegen denen es sie gibt.
 *
 * Start: npx tsx scripts/verify-schleuse.ts
 */
import { bewerteSchleuse, pruefeAnmeldung, pruefeDurchgang, pruefeSupabase, pruefeVault } from '../runner/schleuse.mjs'
import { homedir } from 'node:os'
import { join } from 'node:path'

let pass = 0
let fail = 0
function check(label: string, ok: boolean, hinweis = '') {
  if (ok) pass++
  else {
    fail++
    console.error(`FAIL ${label}${hinweis ? `\n  ${hinweis}` : ''}`)
  }
}

// --- 1. Das Urteil ----------------------------------------------------------
const alleGut = [
  { was: 'Vault', ok: true },
  { was: 'Anmeldung', ok: true },
  { was: 'Datenbank', ok: true },
]
check('alles grün öffnet die Schleuse', bewerteSchleuse(alleGut).offen === true)
check('und nennt keinen Grund', bewerteSchleuse(alleGut).grund === '')

const abgemeldet = [
  { was: 'Datenbank', ok: false, meldung: 'Supabase nicht erreichbar', hinweis: 'kommt mit dem Netz zurück', handeln: false },
  { was: 'Anmeldung', ok: false, meldung: 'Claude-CLI ist abgemeldet', hinweis: 'Im Terminal `claude` neu anmelden', handeln: true },
]
const urteil = bewerteSchleuse(abgemeldet)
check('ein roter Punkt schließt sie', urteil.offen === false)
check(
  'was Kevin selbst beheben muss, steht vorn',
  urteil.rot[0]?.was === 'Anmeldung',
  'Sonst liest er morgens „Supabase nicht erreichbar", während in Wahrheit das Login hängt.',
)
check('der Handgriff kommt vom handelnden Befund', urteil.hinweis === 'Im Terminal `claude` neu anmelden')
check('handeln wird nach oben durchgereicht', urteil.handeln === true)
check('beide Gründe stehen in der Meldung', urteil.grund.includes('abgemeldet') && urteil.grund.includes('Supabase'))

// Nur Vorübergehendes: geschlossen, aber ohne Handgriff für Kevin.
const nurNetz = bewerteSchleuse([{ was: 'Datenbank', ok: false, meldung: 'Supabase nicht erreichbar', handeln: false }])
check('vorübergehende Störung schließt auch', nurNetz.offen === false)
check('verlangt aber nichts von Kevin', nurNetz.handeln === false)

check('leere Liste ist offen', bewerteSchleuse([]).offen === true)
check('undefined kippt nicht', bewerteSchleuse(undefined as never).offen === true)

// --- 2. Die Fälle, für die es die Schleuse gibt ------------------------------
// Mit eingesetztem Prozessstarter, damit „abgemeldet" prüfbar ist, ohne Kevins
// echte Anmeldung anzufassen. Genau diese Zustände sind am 12./13. und 17.08.
// eingetreten — und wurden damals von jedem Agenten einzeln entdeckt.
const antwort = (aus: string, code = 0, grund: string | null = null) => async () => ({ code, aus, fehler: '', grund })

const abgemeldetEcht = await pruefeAnmeldung({ laufImpl: antwort('{"loggedIn":false}') })
check('„loggedIn: false" schließt die Schleuse', abgemeldetEcht.ok === false)
check('und schickt Kevin ins Terminal', /claude/.test(abgemeldetEcht.hinweis ?? ''))
check('als Fall, den nur er beheben kann', abgemeldetEcht.handeln === true)

const angemeldetEcht = await pruefeAnmeldung({ laufImpl: antwort('{"loggedIn":true,"email":"k@x.de"}') })
check('„loggedIn: true" öffnet', angemeldetEcht.ok === true)
check('und nennt das Konto', /k@x\.de/.test(angemeldetEcht.meldung ?? ''))

const kaputt = await pruefeAnmeldung({ laufImpl: antwort('command not found', 127) })
check('unlesbare Antwort gilt NICHT als angemeldet', kaputt.ok === false, 'Im Zweifel zu, sonst startet alles ins Leere.')

const haengt = await pruefeAnmeldung({ laufImpl: antwort('', null, 'timeout') })
check('eine hängende Abfrage schließt ebenfalls', haengt.ok === false)

// Der Fall vom 12.08.: `auth status` sieht gültig aus, der echte Zug nicht.
const abgelaufen = await pruefeDurchgang({
  laufImpl: antwort('Failed to authenticate: OAuth session expired and could not refresh', 1),
})
check('der Probelauf erkennt die abgelaufene Sitzung', abgelaufen.ok === false)
check('und nennt sie beim Namen', abgelaufen.meldung === 'Anmeldung abgelaufen')
check('Handeln nötig', abgelaufen.handeln === true)

const limit = await pruefeDurchgang({ laufImpl: antwort('Error: usage limit reached', 1) })
check('ein erschöpftes Kontingent schließt auch', limit.ok === false)
check('verlangt aber KEINEN Handgriff — es läuft von selbst wieder', limit.handeln === false)

const durch = await pruefeDurchgang({ laufImpl: antwort('ok', 0) })
check('ein sauberer Probelauf öffnet', durch.ok === true)

// --- 3. Die echten Prüfungen ------------------------------------------------
// Gegen die laufende Maschine, nicht gegen Attrappen: Genau hier lag der Fehler
// am 12.08. — geprüft wurde, was gedacht war, nicht was die CLI tatsächlich tut.
const anmeldung = await pruefeAnmeldung({})
check(
  'die echte CLI meldet sich als angemeldet',
  anmeldung.ok === true,
  `Bekommen: ${anmeldung.meldung}. Ist das hier rot, ist es KEIN Testfehler — dann ist die Anmeldung wirklich weg.`,
)

const vaultOk = await pruefeVault(join(homedir(), 'Second Brain', 'System', 'Runs'))
check('der echte Run-Ordner ist beschreibbar', vaultOk.ok === true, vaultOk.meldung ?? '')

const vaultWeg = await pruefeVault('/gibt/es/nicht/System/Runs')
check('ein fehlender Ordner wird erkannt', vaultWeg.ok === false)
check('und verlangt Handeln', vaultWeg.handeln === true)

// Ohne Zugangsdaten darf die Schleuse NICHT zufallen — sonst stünde ein Runner
// ohne service_role-Key dauerhaft still, obwohl er lokal alles kann.
const ohneKey = await pruefeSupabase({})
check('ohne Supabase-Zugang wird übersprungen statt blockiert', ohneKey.ok === true)

// Ein 401 ist etwas anderes als ein Netzfehler: falscher Key, echter Handgriff.
const falscherKey = await pruefeSupabase({
  url: 'https://example.invalid',
  key: 'x',
  timeoutMs: 3000,
})
check('eine unerreichbare Datenbank ist rot', falscherKey.ok === false)
check('aber kein Fall für Kevin', falscherKey.handeln === false)

console.log(`\n${pass} ok, ${fail} fehlgeschlagen`)
process.exit(fail === 0 ? 0 : 1)
