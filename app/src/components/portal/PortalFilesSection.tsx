import { useCallback, useEffect, useRef, useState } from 'react'
import {
  deleteProjectFile,
  formatFileSize,
  getProjectFileUrl,
  listProjectFiles,
  uploadProjectFile,
} from '../../lib/projectFiles'
import type { ProjectFile } from '../../lib/projectFiles'
import type { ClientDocumentLink } from '../../types/db'

/**
 * Geteilte Dateien eines Projekts (Bucket `project-files`, Migration 0051) —
 * gemischt mit den bestehenden client_documents-Links. Beide Seiten (Portal
 * hell / Cockpit dunkel) nutzen dieselbe Komponente; `dark` schaltet die Optik,
 * `canDelete` nur für den Owner.
 */
export function PortalFilesSection({
  projectId,
  documents = [],
  dark = false,
  canDelete = false,
  title = 'Dateien & Dokumente',
}: {
  projectId: string
  documents?: ClientDocumentLink[]
  dark?: boolean
  canDelete?: boolean
  title?: string
}) {
  const [files, setFiles] = useState<ProjectFile[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const reload = useCallback(async () => {
    try {
      setFiles(await listProjectFiles(projectId))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Dateien konnten nicht geladen werden.')
    }
  }, [projectId])

  useEffect(() => {
    void reload()
  }, [reload])

  const handleFiles = useCallback(
    async (list: FileList | null) => {
      if (!list?.length) return
      setBusy(true)
      setError(null)
      try {
        for (const file of Array.from(list)) {
          await uploadProjectFile(projectId, file)
        }
        await reload()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Upload fehlgeschlagen.')
      } finally {
        setBusy(false)
      }
    },
    [projectId, reload],
  )

  const openFile = useCallback(async (path: string) => {
    try {
      const url = await getProjectFileUrl(path)
      window.open(url, '_blank', 'noopener')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download fehlgeschlagen.')
    }
  }, [])

  const colors = dark
    ? {
        border: 'var(--glass-border-1)',
        surface: 'var(--glass-1)',
        text: 'var(--text-primary)',
        sub: 'var(--text-tertiary)',
        accent: 'var(--accent-blue)',
        danger: 'var(--accent-coral)',
      }
    : {
        border: 'var(--portal-border)',
        surface: 'var(--portal-surface)',
        text: 'var(--portal-text)',
        sub: 'var(--portal-text-secondary)',
        accent: 'var(--portal-accent, #C5A059)',
        danger: 'var(--status-danger)',
      }

  const links = documents.filter((d) => d.url && d.url !== '#')

  const row = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: '9px 12px',
    border: `1px solid ${colors.border}`,
    borderRadius: 10,
    fontSize: 13,
    color: colors.text,
  } as const

  return (
    <section aria-label={title}>
      <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 4px', color: colors.text }}>
        {title}
      </h3>
      <p style={{ fontSize: 12, color: colors.sub, margin: '0 0 12px' }}>
        Alles, was zu deinem Projekt geteilt wurde — Uploads landen direkt beim Team.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {links.map((doc, i) => (
          <div key={`link-${doc.url}-${i}`} style={row}>
            <a
              href={doc.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: colors.accent, textDecoration: 'none', fontWeight: 500, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {doc.label || doc.url}
            </a>
            <span style={{ fontSize: 10.5, color: colors.sub, flexShrink: 0 }}>Link</span>
          </div>
        ))}

        {files.map((f) => (
          <div key={f.path} style={row}>
            <button
              type="button"
              onClick={() => void openFile(f.path)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                color: colors.accent,
                fontWeight: 500,
                fontSize: 13,
                cursor: 'pointer',
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {f.name}
            </button>
            <span style={{ display: 'inline-flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 10.5, color: colors.sub }}>{formatFileSize(f.size)}</span>
              {canDelete ? (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`„${f.name}" wirklich löschen?`)) {
                      void deleteProjectFile(f.path).then(reload, (e: Error) => setError(e.message))
                    }
                  }}
                  aria-label={`${f.name} löschen`}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: colors.danger,
                    cursor: 'pointer',
                    fontSize: 12,
                    padding: 0,
                  }}
                >
                  ✕
                </button>
              ) : null}
            </span>
          </div>
        ))}

        {links.length === 0 && files.length === 0 ? (
          <p style={{ fontSize: 12.5, color: colors.sub, margin: 0 }}>Noch keine Dateien geteilt.</p>
        ) : null}
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          void handleFiles(e.dataTransfer.files)
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
        }}
        aria-label="Datei hochladen"
        style={{
          marginTop: 10,
          padding: '14px 12px',
          border: `1.5px dashed ${dragOver ? colors.accent : colors.border}`,
          borderRadius: 10,
          textAlign: 'center',
          fontSize: 12.5,
          color: colors.sub,
          cursor: 'pointer',
          background: dragOver ? colors.surface : 'transparent',
        }}
      >
        {busy ? 'Wird hochgeladen…' : 'Datei hierher ziehen oder klicken (max. 50 MB)'}
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            void handleFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {error ? (
        <p style={{ fontSize: 12, color: colors.danger, marginTop: 8 }}>{error}</p>
      ) : null}
    </section>
  )
}
