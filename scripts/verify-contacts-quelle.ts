/**
 * Drift-Wache für O1 (docs/BACKLOG.md, 06.08.2026): Supabase ist die einzige
 * Wahrheit für Kontakte, localStorage ist nur noch Lese-Cache.
 *
 * Der Hook ist React und lässt sich nicht ohne DOM aufrufen — geprüft wird
 * deshalb die Struktur der Datei: die Bausteine der alten Doppelwelt dürfen
 * nicht zurückkommen. Genau sie haben Geister-Kontakte über Geräte hinweg
 * erzeugt, und die Freigaben-Queue verschickt auf dieser Basis echte E-Mails.
 *
 * Start: npx tsx scripts/verify-contacts-quelle.ts
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const hookPfad = join(wurzel, 'app/src/hooks/useContacts.ts')
const hookRoh = readFileSync(hookPfad, 'utf8')

/**
 * Kommentare raus, bevor gesucht wird: Die Datei erklärt an mehreren Stellen,
 * *warum* `localOnlyRef` und die Tombstone-Liste gefallen sind. Ohne diesen
 * Schnitt würde die Wache genau an ihrer eigenen Begründung anschlagen.
 */
const hook = hookRoh.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

let pass = 0
let fail = 0
function check(label: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    pass++
  } else {
    fail++
    console.error(`FEHLGESCHLAGEN: ${label} — erwartet ${JSON.stringify(expected)}, bekommen ${JSON.stringify(actual)}`)
  }
}

// 1. Die Bausteine der Doppelwelt sind weg und dürfen nicht zurückkommen.
const verboten: Array<[string, string]> = [
  ['enrichContactFromLocal', 'Merge Server↔localStorage'],
  ['contacts-deleted-ids', 'Tombstone-Liste'],
  ['markContactDeleted', 'Tombstone schreiben'],
  ['readDeletedContactIds', 'Tombstone lesen'],
  ['withoutDeleted', 'Tombstone anwenden'],
  ['localOnlyRef', 'Browser wird zur Wahrheit'],
  ['syncWarning', 'lokal gespeichert, Sync später'],
]
for (const [muster, was] of verboten) {
  check(`1 ohne ${muster} (${was})`, hook.includes(muster), false)
}

// 2. Kein Wiederbeleben: nirgends darf eine lokale Zeile in die Liste wandern,
//    nur weil der Server sie nicht kennt.
check('2 kein Merge über byId', /byId\.set\(\s*l\.id/.test(hook), false)
check('2b reload setzt genau die Serverzeilen', hook.includes('setItems(serverRows)'), true)

// 3. Schreiben ohne Server ist gesperrt — in allen drei Pfaden.
const schreibpfade = ['create', 'update', 'remove']
const guards = hook.split('readOnlyRef.current').length - 1
check(`3 readOnly-Guard in ${schreibpfade.length} Schreibpfaden (+1 Setter)`, guards >= 3, true)
check('3b readOnly ist Teil des Hook-Ergebnisses', /return \{[^}]*readOnly/.test(hook), true)

// 4. Insert erst, dann anzeigen: kein optimistischer Einschub vor dem Server.
const insertPos = hook.indexOf("supabase.from('contacts').insert(row)")
const createPos = hook.indexOf('const create = useCallback')
const setItemsNachInsert = hook.indexOf('setItems(next)', insertPos)
check('4 insert steht im create-Pfad', insertPos > createPos, true)
check('4b setItems folgt dem insert', setItemsNachInsert > insertPos, true)

// 5. Der Cache bleibt lesbar — dafür gibt es ihn.
check('5 readContactsLocal wird weiter exportiert', hook.includes('export function readContactsLocal'), true)

console.log(`${pass} bestanden, ${fail} fehlgeschlagen`)
if (fail > 0) process.exit(1)
