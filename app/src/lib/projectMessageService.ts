import { supabase } from './supabase'
import type { ProjectMessage } from '../types/db'

/**
 * Eine Projekt-Nachricht schreiben — der EINE Weg dorthin.
 *
 * Lag vorher nur in `useProjectMessages.send`, also im Portal-Hook. Seit der
 * Kunden-Posteingang in /freigaben aus einer Liste heraus antwortet (viele
 * Projekte, ein Bildschirm — ein Hook je Projekt geht nicht), braucht es die
 * Logik ohne React drumherum. Wichtig ist, dass beide Seiten denselben Pfad
 * nehmen: Insert UND die Benachrichtigungs-Mail. Sonst bekäme der Kunde bei
 * einer Antwort aus dem Posteingang stillschweigend keine Mail.
 */

export function rowToProjectMessage(row: Record<string, unknown>): ProjectMessage {
  return {
    id: String(row.id ?? ''),
    project_id: String(row.project_id ?? ''),
    sender_role: row.sender_role === 'client' ? 'client' : 'owner',
    sender_name: typeof row.sender_name === 'string' ? row.sender_name : null,
    body: String(row.body ?? ''),
    read_at: typeof row.read_at === 'string' ? row.read_at : null,
    deleted_at: typeof row.deleted_at === 'string' ? row.deleted_at : null,
    created_at: typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
  }
}

export type SendeErgebnis =
  | { ok: true; message: ProjectMessage }
  | { ok: false; error: string }

export async function sendeProjektNachricht(opts: {
  projectId: string
  senderRole: 'owner' | 'client'
  senderName: string
  body: string
}): Promise<SendeErgebnis> {
  const trimmed = opts.body.trim()
  if (!trimmed) return { ok: false, error: 'leer' }
  if (!supabase) return { ok: false, error: 'Supabase nicht verbunden' }

  const { data, error } = await supabase
    .from('project_messages')
    .insert({
      project_id: opts.projectId,
      sender_role: opts.senderRole,
      sender_name: opts.senderName.trim() || null,
      body: trimmed,
    })
    .select('*')
    .maybeSingle()

  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Senden fehlgeschlagen' }
  }

  const message = rowToProjectMessage(data as Record<string, unknown>)

  // Benachrichtigung ist Beiwerk: Wenn die Function klemmt, steht die Nachricht
  // trotzdem im Portal. Deshalb bewusst nicht awaiten und nicht scheitern lassen.
  void supabase.functions.invoke('send-email', {
    body: {
      mode: 'project_message',
      project_id: opts.projectId,
      message_id: message.id,
      sender_role: opts.senderRole,
    },
  })

  return { ok: true, message }
}
