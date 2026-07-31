/**
 * Uriel-Stimm-Einstellungen — Kevin wählt Stimme, Modell und Betonung selbst.
 * In localStorage gehalten; useUrielVoice.speak() liest sie frisch pro Ausgabe.
 * Modell = Latenz↔Ausdruck-Regler: flash = schnell, multilingual = ausdrucksstark.
 */
import { supabase } from '../../lib/supabase'

const SB_URL = import.meta.env.VITE_SUPABASE_URL ?? ''
const SB_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

export interface AccountVoice {
  id: string
  name: string
  category: string
}

/** Ruft die im ElevenLabs-Konto tatsächlich nutzbaren Stimmen ab (Free-tauglich). */
export async function fetchAccountVoices(): Promise<{ voices: AccountVoice[]; error: string | null }> {
  try {
    if (!supabase) return { voices: [], error: 'Supabase nicht konfiguriert.' }
    const { data: sess } = await supabase.auth.getSession()
    const token = sess.session?.access_token
    if (!token) return { voices: [], error: 'Keine Session.' }
    const res = await fetch(`${SB_URL}/functions/v1/uriel-voice`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, apikey: SB_ANON },
    })
    const j = (await res.json()) as { ok?: boolean; voices?: AccountVoice[]; message?: string }
    if (!res.ok || j.ok === false) return { voices: [], error: j.message ?? `HTTP ${res.status}` }
    return { voices: j.voices ?? [], error: null }
  } catch (e) {
    return { voices: [], error: (e as Error).message }
  }
}
export type UrielModelId = 'eleven_flash_v2_5' | 'eleven_turbo_v2_5' | 'eleven_multilingual_v2'

export interface UrielVoiceSettings {
  voiceId: string
  modelId: UrielModelId
  stability: number // 0..1 — niedriger = lebendigere Betonung, höher = ruhiger/monotoner
  style: number // 0..1 — Ausdruck (wirkt v.a. bei „ausdrucksstark")
  speed: number // 0.7..1.2 — Sprechtempo
}

// URIEL_VOICES (kuratierte Festliste) entfernt: die Auswahl kommt seit dem
// ElevenLabs-Anschluss aus fetchAccountVoices() — nur Stimmen, die im Konto
// wirklich nutzbar sind. Die Festliste hatte keinen Importeur mehr.

export const URIEL_MODELS: { id: UrielModelId; label: string; note: string }[] = [
  { id: 'eleven_flash_v2_5', label: 'Schnell', note: 'niedrigste Latenz' },
  { id: 'eleven_turbo_v2_5', label: 'Ausgewogen', note: 'Tempo + Qualität' },
  { id: 'eleven_multilingual_v2', label: 'Ausdrucksstark', note: 'beste Betonung, langsamer' },
]

export const URIEL_VOICE_SAMPLE =
  'Alles bereit. Ich bin Uriel — sag mir einfach, was du brauchst.'

const KEY = 'uriel.voice.settings'

const DEFAULTS: UrielVoiceSettings = {
  voiceId: 'onwK4e9ZLuTAKqWW03F9', // Daniel — Jarvis-nah
  modelId: 'eleven_flash_v2_5', // schnell (Kevins Latenz-Wunsch)
  stability: 0.35,
  style: 0.25,
  speed: 1.0,
}

export function loadVoiceSettings(): UrielVoiceSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULTS }
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<UrielVoiceSettings>) }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveVoiceSettings(s: UrielVoiceSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* egal */
  }
}
