import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { rowToProjectMessage as rowToMessage, sendeProjektNachricht } from '../lib/projectMessageService'
import type { ProjectMessage } from '../types/db'

export function useProjectMessages(
  projectId: string | undefined,
  viewerRole: 'owner' | 'client',
  senderName: string,
) {
  const [messages, setMessages] = useState<ProjectMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const reload = useCallback(async () => {
    if (!projectId || !supabase) {
      setMessages([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: err } = await supabase
      .from('project_messages')
      .select('*')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })

    if (err) {
      setError(err.message)
      setMessages([])
    } else {
      setError(null)
      setMessages((data ?? []).map((r) => rowToMessage(r as Record<string, unknown>)))
    }
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    void reload()
    const interval = window.setInterval(() => void reload(), 30_000)
    return () => window.clearInterval(interval)
  }, [reload])

  const markThreadRead = useCallback(async () => {
    if (!projectId || !supabase) return
    const oppositeRole = viewerRole === 'owner' ? 'client' : 'owner'
    const hasUnread = messages.some((m) => m.sender_role === oppositeRole && !m.read_at)
    if (!hasUnread) return

    const now = new Date().toISOString()
    const { error: err } = await supabase
      .from('project_messages')
      .update({ read_at: now })
      .eq('project_id', projectId)
      .eq('sender_role', oppositeRole)
      .is('read_at', null)
      .is('deleted_at', null)

    if (!err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.sender_role === oppositeRole && !m.read_at ? { ...m, read_at: now } : m,
        ),
      )
    }
  }, [messages, projectId, viewerRole])

  useEffect(() => {
    if (!loading) {
      void markThreadRead()
    }
  }, [loading, messages, markThreadRead])

  const send = useCallback(
    async (body: string) => {
      if (!projectId) return { ok: false as const, error: 'empty' }
      setSending(true)
      setError(null)

      // Gemeinsamer Pfad mit dem Kunden-Posteingang (projectMessageService) —
      // Insert plus Benachrichtigungs-Mail an die Gegenseite.
      const res = await sendeProjektNachricht({
        projectId,
        senderRole: viewerRole,
        senderName,
        body,
      })

      if (!res.ok) {
        setSending(false)
        if (res.error !== 'leer') setError(res.error)
        return { ok: false as const, error: res.error }
      }

      setMessages((prev) => [...prev, res.message])
      setSending(false)
      return { ok: true as const, message: res.message }
    },
    [projectId, senderName, viewerRole],
  )

  const softDelete = useCallback(
    async (messageId: string) => {
      if (!projectId || !supabase || viewerRole !== 'owner') return
      const now = new Date().toISOString()
      const { error: err } = await supabase
        .from('project_messages')
        .update({ deleted_at: now })
        .eq('id', messageId)
        .eq('project_id', projectId)

      if (!err) {
        setMessages((prev) => prev.filter((m) => m.id !== messageId))
      }
    },
    [projectId, viewerRole],
  )

  const unreadCount = messages.filter(
    (m) => m.sender_role !== viewerRole && !m.read_at,
  ).length

  return { messages, loading, error, sending, send, softDelete, reload, unreadCount }
}
