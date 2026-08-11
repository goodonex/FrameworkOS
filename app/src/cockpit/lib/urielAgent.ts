import { supabase } from '../../lib/supabase'
import { URIEL_TOOLS } from './urielTools'

/**
 * Uriel-Agenten-Schleife (Client-seitig). Pro Zug ein Anthropic-Roundtrip über
 * die Edge Function `uriel`; kommt ein tool_use zurück, führt der Client das
 * Werkzeug lokal aus (UI-State oder eingeloggte Supabase-Queries) und schickt
 * das tool_result als nächste Nachricht zurück — bis Uriel fertig ist.
 */

// Anthropic content blocks — heterogen, bewusst lose typisiert.
type Block =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | Record<string, unknown>

export interface UrielMessage {
  role: 'user' | 'assistant'
  content: string | Block[]
}

export interface UrielAction {
  name: string
  summary: string
  ok: boolean
}

/** Ergebnis eines Werkzeug-Aufrufs: `data` geht als tool_result an Uriel zurück. */
export interface ToolResult {
  ok: boolean
  summary: string
  data?: unknown
}

export type ToolExecutor = (
  name: string,
  input: Record<string, unknown>,
) => Promise<ToolResult>

/**
 * Wie viel Zeit Uriel sich nehmen darf (11.08.2026).
 *
 * `schnell` ist der Standard und bleibt es: Zahlen buchen, navigieren, kurz
 * antworten. `gruendlich` schaltet in der Edge Function auf das groessere
 * Modell — fuer die Fragen, bei denen ein schnelles Modell anfaengt zu raten
 * statt nachzusehen.
 */
export type UrielTiefe = 'schnell' | 'gruendlich'

export interface UrielTurnContext {
  brandName?: string
  brandSlug?: string
  date?: string
  area?: string
  /** Uriels „remember"-Fakten — pro Zug frisch eingespeist, nicht in der History persistiert. */
  memory?: string[]
}

export interface UrielTurnResult {
  finalText: string
  actions: UrielAction[]
  messages: UrielMessage[]
}

const MAX_STEPS = 6

function isToolUse(b: Block): b is { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> } {
  return (b as { type?: string }).type === 'tool_use'
}

function textFrom(content: Block[]): string {
  return content
    .filter((b): b is { type: 'text'; text: string } => (b as { type?: string }).type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim()
}

interface EdgeReply {
  ok?: boolean
  stop_reason?: string
  content?: Block[]
  message?: string
}

/**
 * Führt einen kompletten Uriel-Zug aus: nimmt die bisherige History + die neue
 * Nutzer-Nachricht, iteriert Anthropic↔Werkzeuge, gibt finalen Text + die
 * ausgeführten Aktionen + die erweiterte History zurück.
 */
export async function runUrielTurn(
  history: UrielMessage[],
  userText: string,
  execute: ToolExecutor,
  context: UrielTurnContext,
  tiefe: UrielTiefe = 'schnell',
): Promise<UrielTurnResult> {
  if (!supabase) throw new Error('Supabase nicht konfiguriert.')

  // Gedächtnis als kurzer Vorspann in DIESEN Request (nicht in die persistierte
  // History gebacken → nächster Zug bekommt den dann aktuellen Stand).
  const memoryPrefix: UrielMessage[] =
    context.memory && context.memory.length
      ? [
          {
            role: 'user',
            content: `[GEDÄCHTNIS — Hintergrundwissen über Kevin, nutze es beiläufig, erwähne es nicht ungefragt]\n${context.memory
              .map((m) => `- ${m}`)
              .join('\n')}`,
          },
          { role: 'assistant', content: 'Verstanden.' },
        ]
      : []

  const messages: UrielMessage[] = [
    ...memoryPrefix,
    ...history,
    { role: 'user', content: userText },
  ]
  const actions: UrielAction[] = []

  for (let step = 0; step < MAX_STEPS; step++) {
    const { data, error } = await supabase.functions.invoke<EdgeReply>('uriel', {
      body: { messages, tools: URIEL_TOOLS, context, tiefe },
    })

    if (error) {
      throw new Error(
        (error as Error).message?.toLowerCase().includes('function not found')
          ? 'Edge Function „uriel" ist nicht erreichbar (noch nicht deployed?). Im Projektordner: supabase functions deploy uriel'
          : (error as Error).message || 'Uriel-Anfrage fehlgeschlagen.',
      )
    }
    if (!data || data.ok === false) {
      throw new Error(data?.message || 'Uriel lieferte keine Antwort.')
    }

    const content = (data.content ?? []) as Block[]
    messages.push({ role: 'assistant', content })

    const toolUses = content.filter(isToolUse)
    if (data.stop_reason !== 'tool_use' || toolUses.length === 0) {
      return { finalText: textFrom(content), actions, messages: messages.slice(memoryPrefix.length) }
    }

    const resultBlocks: Block[] = []
    for (const tu of toolUses) {
      let result: ToolResult
      try {
        result = await execute(tu.name, tu.input ?? {})
      } catch (e) {
        result = { ok: false, summary: (e as Error).message, data: { error: (e as Error).message } }
      }
      actions.push({ name: tu.name, summary: result.summary, ok: result.ok })
      resultBlocks.push({
        type: 'tool_result',
        tool_use_id: tu.id,
        content: JSON.stringify(result.data ?? { ok: result.ok, summary: result.summary }),
        ...(result.ok ? {} : { is_error: true }),
      })
    }
    messages.push({ role: 'user', content: resultBlocks })
  }

  return {
    finalText: 'Ich habe das Schritt-Limit erreicht — sag mir, wie ich weitermachen soll.',
    actions,
    messages: messages.slice(memoryPrefix.length),
  }
}
