import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useLocation } from 'react-router-dom'
import type { Contact } from '../types/db'

export type PostCallSource = 'daily' | 'contact'

/**
 * Ein Posten der Anruf-Warteschlange. Lag früher in `useDailyWorkList` — der
 * Hook ist mit der alten Brand-Sales-Welt gefallen (Etappe 4/2), der Typ ist
 * das Einzige, was der Post-Call-Flow davon je gebraucht hat.
 */
export interface PostCallQueueItem {
  contact: Contact
}

export interface PostCallSession {
  contactId: string
  queue?: PostCallQueueItem[]
  queueIndex?: number
  source: PostCallSource
}

interface PostCallFlowContextValue {
  session: PostCallSession | null
  openPostCall: (opts: PostCallSession) => void
  closePostCall: () => void
  advanceQueue: () => PostCallSession | null
}

const PostCallFlowContext = createContext<PostCallFlowContextValue | null>(null)

export function PostCallFlowProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const [session, setSession] = useState<PostCallSession | null>(null)

  const openPostCall = useCallback((opts: PostCallSession) => {
    setSession(opts)
  }, [])

  const closePostCall = useCallback(() => {
    setSession(null)
  }, [])

  useEffect(() => {
    setSession(null)
  }, [pathname])

  const advanceQueue = useCallback((): PostCallSession | null => {
    if (!session?.queue?.length) {
      setSession(null)
      return null
    }
    const idx = (session.queueIndex ?? 0) + 1
    if (idx >= session.queue.length) {
      setSession(null)
      return null
    }
    const item = session.queue[idx]
    const next: PostCallSession = {
      contactId: item.contact.id,
      queue: session.queue,
      queueIndex: idx,
      source: session.source,
    }
    setSession(next)
    return next
  }, [session])

  const value = useMemo(
    () => ({ session, openPostCall, closePostCall, advanceQueue }),
    [session, openPostCall, closePostCall, advanceQueue],
  )

  return (
    <PostCallFlowContext.Provider value={value}>{children}</PostCallFlowContext.Provider>
  )
}

export function usePostCallFlow(): PostCallFlowContextValue {
  const ctx = useContext(PostCallFlowContext)
  if (!ctx) {
    throw new Error('usePostCallFlow must be used within PostCallFlowProvider')
  }
  return ctx
}

export function usePostCallFlowOptional(): PostCallFlowContextValue | null {
  return useContext(PostCallFlowContext)
}
