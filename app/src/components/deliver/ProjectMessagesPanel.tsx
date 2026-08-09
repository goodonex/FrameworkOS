import { useState } from 'react'
import { AutoSizeTextarea } from '../AutoSizeTextarea'
import { CollapsibleSection } from '../CollapsibleSection'
import { useProjectMessages } from '../../hooks/useProjectMessages'
import { ABNAHME_LABEL, abnahmeTitel, leseAbnahme } from '../../lib/abnahme'

interface ProjectMessagesPanelProps {
  projectId: string
  senderName: string
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('de-DE', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

export function ProjectMessagesPanel({ projectId, senderName }: ProjectMessagesPanelProps) {
  const { messages, loading, error, sending, send, unreadCount } = useProjectMessages(
    projectId,
    'owner',
    senderName,
  )
  const [draft, setDraft] = useState('')

  const handleSend = async () => {
    if (!draft.trim()) return
    const result = await send(draft)
    if (result.ok) setDraft('')
  }

  return (
    <CollapsibleSection
      title="Nachrichten (Client)"
      meta={unreadCount > 0 ? `${unreadCount} ungelesen` : undefined}
      status={messages.length > 0 ? 'partial' : 'empty'}
      defaultOpen={unreadCount > 0}
    >
      <div className="flex flex-col gap-3">
        {error ? (
          <p className="font-mono" style={{ fontSize: 11, color: 'var(--ck-warn)' }}>
            {error}
          </p>
        ) : null}
        {loading && messages.length === 0 ? (
          <p className="font-mono" style={{ fontSize: 11, color: 'var(--ck-text-3)' }}>
            Nachrichten werden geladen…
          </p>
        ) : null}
        {!loading && messages.length === 0 ? (
          <p className="font-mono" style={{ fontSize: 11, color: 'var(--ck-text-3)' }}>
            Noch keine Nachrichten. Schreib deinem Kunden hier.
          </p>
        ) : null}
        <div className="flex flex-col gap-2">
          {messages.map((msg) => {
            const isClient = msg.sender_role === 'client'
            const unread = isClient && !msg.read_at
            // O11: Freigabe/Änderungswunsch sind Nachrichten mit Präfix — als
            // Badge zeigen, Präfix aus dem Fließtext nehmen.
            const abnahme = isClient ? leseAbnahme(msg.body) : null
            return (
              <div
                key={msg.id}
                className="rounded-xl p-3"
                style={{
                  border: unread
                    ? '1px solid var(--ck-accent)'
                    : '1px solid var(--ck-border-strong)',
                  background: unread ? 'color-mix(in srgb, var(--ck-accent) 8%, transparent)' : 'var(--ck-panel)',
                }}
              >
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <span
                    className="font-mono"
                    style={{
                      fontSize: 10,
                      color: isClient ? 'var(--ck-accent)' : 'var(--ck-text-2)',
                    }}
                  >
                    {isClient ? (msg.sender_name ?? 'Kunde') : 'Du'}
                    {unread ? ' · neu' : ''}
                  </span>
                  {abnahme ? (
                    <span
                      className="font-mono"
                      style={{
                        fontSize: 10,
                        borderRadius: 999,
                        padding: '1px 8px',
                        border: `1px solid ${abnahme.art === 'freigabe' ? 'var(--ck-accent)' : 'var(--ck-warn)'}`,
                        color: abnahme.art === 'freigabe' ? 'var(--ck-accent)' : 'var(--ck-warn)',
                      }}
                    >
                      {abnahme.art === 'freigabe' ? '✓' : '✎'} {ABNAHME_LABEL[abnahme.art]}:{' '}
                      {abnahmeTitel(abnahme.deliverableId)}
                    </span>
                  ) : null}
                  <span className="font-mono" style={{ fontSize: 9, color: 'var(--ck-text-3)' }}>
                    {formatTime(msg.created_at)}
                  </span>
                </div>
                <p
                  className="font-body whitespace-pre-wrap"
                  style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--ck-text-1)', margin: 0 }}
                >
                  {abnahme
                    ? abnahme.text ||
                      (abnahme.art === 'freigabe'
                        ? `${abnahmeTitel(abnahme.deliverableId)} ist freigegeben.`
                        : `Änderungswunsch zu ${abnahmeTitel(abnahme.deliverableId)}.`)
                    : msg.body}
                </p>
              </div>
            )
          })}
        </div>
        <AutoSizeTextarea
          value={draft}
          onChange={setDraft}
          placeholder="Nachricht an den Kunden…"
          minHeight={72}
        />
        <button
          type="button"
          className="font-mono self-start"
          disabled={sending || !draft.trim()}
          onClick={() => void handleSend()}
          style={{
            fontSize: 11,
            padding: '8px 16px',
            borderRadius: 10,
            border: '1px solid var(--ck-accent)',
            background: 'color-mix(in srgb, var(--ck-accent) 15%, transparent)',
            color: 'var(--ck-accent)',
            opacity: sending || !draft.trim() ? 0.5 : 1,
          }}
        >
          {sending ? 'Senden…' : 'Senden'}
        </button>
      </div>
    </CollapsibleSection>
  )
}
