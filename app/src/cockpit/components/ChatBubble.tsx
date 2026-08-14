import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useContacts } from '../../hooks/useContacts'
import type { Contact } from '../../types/db'
import { useActiveBrand } from '../lib/activeBrand'
import type { ChatMessage, ChatThread } from '../lib/useChatThreads'
import { useChatThreads } from '../lib/useChatThreads'

/**
 * Chat-Blase (v2-Backlog #1): LinkedIn-Style Multi-Chat unten rechts.
 * Jeder Thread optional an einen CRM-Kontakt gebunden — der Assistent
 * kennt dann Stage & Kontext und entwirft Antworten in Kevins Stimme.
 * Antwort-Motor: bestehende brand-assistant Edge Function (Brand-DNA).
 */
export function ChatBubble() {
  const [open, setOpen] = useState(false)
  const [activeThread, setActiveThread] = useState<ChatThread | null>(null)
  const chat = useChatThreads()

  return (
    <>
      {open ? (
        <ChatPanel
          chat={chat}
          activeThread={activeThread}
          setActiveThread={setActiveThread}
          onClose={() => setOpen(false)}
        />
      ) : null}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Chat schließen' : 'Chat öffnen'}
        className="ck-chat-fab"
        style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          border: '1px solid var(--ck-border-strong)',
          background: open ? 'var(--ck-accent-dim)' : 'var(--ck-panel)',
          color: open ? 'var(--ck-accent)' : 'var(--ck-text-1)',
          fontSize: 20,
          cursor: 'pointer',
          boxShadow: 'var(--ck-schatten-schwebend)',
        }}
      >
        {open ? '✕' : '💬'}
      </button>
    </>
  )
}

function ChatPanel({
  chat,
  activeThread,
  setActiveThread,
  onClose,
}: {
  chat: ReturnType<typeof useChatThreads>
  activeThread: ChatThread | null
  setActiveThread: (t: ChatThread | null) => void
  onClose: () => void
}) {
  const { activeBrand } = useActiveBrand()
  const contacts = useContacts(activeBrand?.slug)

  const contactById = useMemo(
    () => new Map(contacts.items.map((c) => [c.id, c])),
    [contacts.items],
  )

  return (
    <div
      className="ck-root ck-chat-panel"
      role="dialog"
      aria-label="Chats"
      style={{
        width: 'min(400px, calc(100vw - 40px))',
        // svh statt vh: mit eingeblendeter Safari-Leiste misst vh den GROSSEN
        // Viewport (HANDOFF, Falle #2). Den mobilen Deckel setzt cockpit.css —
        // dort steht auch der Anker (bottom: 130px + Safe-Area).
        height: 'min(540px, calc(100svh - 120px))',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--ck-panel)',
        border: '1px solid var(--ck-border-strong)',
        borderRadius: 'var(--ck-radius-innen)',
        overflow: 'hidden',
        boxShadow: 'var(--ck-schatten-panel)',
      }}
    >
      {chat.tableMissing ? (
        <div style={{ padding: 16 }}>
          <div className="ck-label" style={{ color: 'var(--ck-warn)', marginBottom: 6 }}>Migration ausstehend</div>
          <p style={{ fontSize: 12.5, color: 'var(--ck-text-2)', lineHeight: 1.6 }}>
            Führe <code>supabase/migrations/0050_chat_threads.sql</code> im Supabase-SQL-Editor aus
            und öffne die Blase neu.
          </p>
        </div>
      ) : activeThread ? (
        <Conversation
          key={activeThread.id}
          thread={activeThread}
          contact={activeThread.contact_id ? contactById.get(activeThread.contact_id) ?? null : null}
          chat={chat}
          onBack={() => setActiveThread(null)}
        />
      ) : (
        <ThreadList
          chat={chat}
          contacts={contacts.items}
          contactById={contactById}
          onOpenThread={setActiveThread}
          onClose={onClose}
        />
      )}
    </div>
  )
}

function ThreadList({
  chat,
  contacts,
  contactById,
  onOpenThread,
  onClose,
}: {
  chat: ReturnType<typeof useChatThreads>
  contacts: Contact[]
  contactById: Map<string, Contact>
  onOpenThread: (t: ChatThread) => void
  onClose: () => void
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    if (!query.trim()) return contacts.slice(0, 8)
    const q = query.toLowerCase()
    return contacts
      .filter((c) => c.name.toLowerCase().includes(q) || (c.company ?? '').toLowerCase().includes(q))
      .slice(0, 8)
  }, [contacts, query])

  const startThread = async (contact: Contact | null) => {
    const t = await chat.createThread(contact)
    if (t) onOpenThread(t)
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid var(--ck-border)' }}>
        <span className="ck-label">Chats</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="ck-btn" style={{ padding: '3px 10px' }} onClick={() => setPickerOpen((o) => !o)}>
            + Neu
          </button>
          <button className="ck-btn" style={{ padding: '3px 8px' }} onClick={onClose} aria-label="Schließen">✕</button>
        </div>
      </div>

      {pickerOpen ? (
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--ck-border)' }}>
          <input
            className="ck-input"
            style={{ width: '100%', marginBottom: 6 }}
            placeholder="Kontakt suchen … (leer = ohne Kontakt)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 180, overflowY: 'auto' }}>
            <button className="ck-nav-item" style={{ textTransform: 'none', letterSpacing: 0 }} onClick={() => void startThread(null)}>
              Ohne Kontakt starten
            </button>
            {filtered.map((c) => (
              <button
                key={c.id}
                className="ck-nav-item"
                style={{ textTransform: 'none', letterSpacing: 0, justifyContent: 'space-between' }}
                onClick={() => void startThread(c)}
              >
                <span>{c.name}</span>
                <span className="ck-label">{c.company || c.pipeline_stage}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {chat.threads.length === 0 ? (
          <p style={{ padding: 16, fontSize: 12.5, color: 'var(--ck-text-3)' }}>
            Noch keine Chats. „+ Neu" → Kontakt wählen → LinkedIn-Nachricht reinkopieren.
          </p>
        ) : (
          chat.threads.map((t) => {
            const contact = t.contact_id ? contactById.get(t.contact_id) : null
            return (
              <div key={t.id} style={{ display: 'flex', alignItems: 'stretch', borderBottom: '1px solid var(--ck-border)' }}>
                <button
                  onClick={() => onOpenThread(t)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    padding: '10px 4px 10px 14px',
                    cursor: 'pointer',
                    color: 'var(--ck-text-1)',
                    fontFamily: 'var(--ck-font)',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.title}
                  </div>
                  <div className="ck-label" style={{ marginTop: 2 }}>
                    {contact ? `${contact.pipeline_stage} · ` : ''}
                    {new Date(t.updated_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </button>
                <button
                  onClick={() => void chat.archiveThread(t.id)}
                  aria-label={`Chat ${t.title} archivieren`}
                  style={{ background: 'none', border: 'none', color: 'var(--ck-text-3)', cursor: 'pointer', padding: '0 12px', fontSize: 11 }}
                >
                  ✕
                </button>
              </div>
            )
          })
        )}
      </div>
    </>
  )
}

function Conversation({
  thread,
  contact,
  chat,
  onBack,
}: {
  thread: ChatThread
  contact: Contact | null
  chat: ReturnType<typeof useChatThreads>
  onBack: () => void
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    void chat.loadMessages(thread.id).then(setMessages)
  }, [chat, thread.id])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages, busy])

  const send = useCallback(async () => {
    const text = draft.trim()
    if (!text || busy) return
    setDraft('')
    setError(null)
    setBusy(true)
    const userMsg: ChatMessage = {
      id: `tmp-${Date.now()}`,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    }
    setMessages((m) => [...m, userMsg])
    try {
      const reply = await chat.sendMessage(thread, messages, text, contact)
      setMessages((m) => [...m, reply])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }, [draft, busy, chat, thread, messages, contact])

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: '1px solid var(--ck-border)' }}>
        <button className="ck-btn" style={{ padding: '3px 9px' }} onClick={onBack} aria-label="Zurück">←</button>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {thread.title}
          </div>
          {contact ? (
            <div className="ck-label">{contact.name} · {contact.pipeline_stage}</div>
          ) : (
            <div className="ck-label">ohne Kontakt</div>
          )}
        </div>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 4px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.length === 0 && !busy ? (
          <p style={{ fontSize: 12, color: 'var(--ck-text-3)', lineHeight: 1.6 }}>
            {contact
              ? 'Kopier die empfangene Nachricht hier rein — du bekommst einen Antwortentwurf in deiner Stimme.'
              : 'Freier Chat mit deiner Brand-Stimme.'}
          </p>
        ) : null}
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '88%',
              background: m.role === 'user' ? 'var(--ck-accent-dim)' : 'var(--ck-panel-2)',
              border: '1px solid var(--ck-border)',
              borderRadius: 'var(--ck-radius-innen)',
              padding: '7px 11px',
              fontSize: 12.5,
              lineHeight: 1.55,
            }}
          >
            {m.role === 'assistant' ? (
              <div className="ck-md">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
              </div>
            ) : (
              <span style={{ whiteSpace: 'pre-wrap' }}>{m.content}</span>
            )}
          </div>
        ))}
        {busy ? (
          <div style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 11px' }}>
            <span className="ck-dot ck-dot--pulse" />
            <span className="ck-label">denkt…</span>
          </div>
        ) : null}
        {error ? <p className="ck-label" style={{ color: 'var(--ck-warn)' }}>{error}</p> : null}
      </div>

      <div style={{ display: 'flex', gap: 6, padding: 10, borderTop: '1px solid var(--ck-border)' }}>
        <textarea
          className="ck-input"
          style={{ flex: 1, resize: 'none', height: 60, lineHeight: 1.45 }}
          placeholder={contact ? 'Nachricht von ' + contact.name + ' einfügen …' : 'Nachricht …'}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void send()
          }}
          aria-label="Chat-Eingabe"
        />
        <button className="ck-btn ck-btn--primary" disabled={busy || !draft.trim()} onClick={() => void send()}>
          ⏎
        </button>
      </div>
    </>
  )
}
