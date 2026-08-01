import { parseIcal } from '../app/src/cockpit/lib/icalParse'

const arbeit = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:a1@google.com
SUMMARY:Quali-Call Reichentrog
DTSTART:20260803T090000Z
END:VEVENT
END:VCALENDAR`

const gesundheit = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:g1@google.com
SUMMARY:Physio
DTSTART;VALUE=DATE:20260804
END:VEVENT
BEGIN:VEVENT
UID:g2@google.com
SUMMARY:Sport
DTSTART:20260805T170000Z
END:VEVENT
END:VCALENDAR`

const zusammen = [arbeit, gesundheit].join('\n')
const ev = parseIcal(zusammen)
let ok = 0, fail = 0
const pruefe = (name: string, bed: boolean) => { bed ? ok++ : (fail++, console.log('FEHLER:', name)) }

pruefe('drei Termine aus zwei Kalendern', ev.length === 3)
pruefe('Termin aus Kalender 1 da', ev.some(e => e.title === 'Quali-Call Reichentrog'))
pruefe('Termine aus Kalender 2 da', ev.some(e => e.title === 'Physio') && ev.some(e => e.title === 'Sport'))
pruefe('Ganztag korrekt erkannt', ev.find(e => e.title === 'Physio')?.allDay === true)
pruefe('Uhrzeit-Termin hat Zeit', !!ev.find(e => e.title === 'Quali-Call Reichentrog')?.time)
pruefe('IDs eindeutig', new Set(ev.map(e => e.id)).size === ev.length)
pruefe('Einzelkalender unverändert', parseIcal(arbeit).length === 1)

console.log(`${ok}/${ok + fail} Fälle korrekt`)
process.exit(fail ? 1 : 0)
