import type { DeliverProject, DeliverProjectStage } from '../../types/db'
import { DELIVER_STAGE_ORDER } from '../../types/db'
import { DELIVER_STAGE_LABEL } from '../../pages/deliver/stageLabels'

interface ProjectTimelinePanelProps {
  project: DeliverProject
  onStageChange: (stage: DeliverProjectStage) => void
}

export function ProjectTimelinePanel({ project, onStageChange }: ProjectTimelinePanelProps) {
  const activeIdx = DELIVER_STAGE_ORDER.indexOf(project.internal_stage)

  const moveStage = (targetIdx: number) => {
    const target = DELIVER_STAGE_ORDER[targetIdx]
    if (!target || target === project.internal_stage) return
    const fromLabel = DELIVER_STAGE_LABEL[project.internal_stage]
    const toLabel = DELIVER_STAGE_LABEL[target]
    if (
      !window.confirm(
        `Interne Stage von „${fromLabel}" auf „${toLabel}" setzen?`,
      )
    ) {
      return
    }
    onStageChange(target)
  }

  return (
    <div
      className="rounded-2xl p-4"
      style={{ border: '1px solid var(--ck-border-strong)', background: 'var(--ck-panel)' }}
    >
      <div className="font-mono mb-3" style={{ fontSize: 11, color: 'var(--ck-text-2)' }}>
        Projekt-Fortschritt (intern)
      </div>
      <div className="hidden sm:flex items-center gap-1">
        {DELIVER_STAGE_ORDER.map((stage, i) => {
          const done = activeIdx >= 0 && activeIdx > i
          const current = activeIdx === i
          return (
            <div key={stage} className="flex min-w-0 flex-1 items-center gap-1">
              <button
                type="button"
                onClick={() => moveStage(i)}
                title={DELIVER_STAGE_LABEL[stage]}
                className="font-mono w-full"
                style={{
                  height: 36,
                  borderRadius: 10,
                  fontSize: 9,
                  border: current
                    ? '2px solid var(--ck-accent)'
                    : '1px solid var(--ck-border-strong)',
                  background: done
                    ? 'var(--ck-accent)'
                    : current
                      ? 'color-mix(in srgb, var(--ck-accent) 20%, transparent)'
                      : 'var(--ck-panel)',
                  color: done ? 'var(--ck-bg)' : 'var(--ck-text-2)',
                }}
              >
                {done ? '✓' : i + 1}
              </button>
              {i < DELIVER_STAGE_ORDER.length - 1 ? (
                <div
                  style={{
                    width: 8,
                    height: 2,
                    background: done ? 'var(--ck-accent)' : 'var(--ck-border-strong)',
                    flexShrink: 0,
                  }}
                />
              ) : null}
            </div>
          )
        })}
      </div>
      <div className="flex flex-col gap-2 sm:hidden">
        {DELIVER_STAGE_ORDER.map((stage, i) => {
          const done = activeIdx >= 0 && activeIdx > i
          const current = activeIdx === i
          return (
            <button
              key={stage}
              type="button"
              onClick={() => moveStage(i)}
              className="flex items-center gap-3 rounded-xl p-3 text-left"
              style={{
                border: current
                  ? '2px solid var(--ck-accent)'
                  : '1px solid var(--ck-border-strong)',
                background: done
                  ? 'color-mix(in srgb, var(--ck-accent) 15%, transparent)'
                  : 'var(--ck-panel)',
              }}
            >
              <span
                className="font-mono flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                style={{
                  fontSize: 11,
                  background: done ? 'var(--ck-accent)' : 'var(--ck-panel-2)',
                  color: done ? 'var(--ck-bg)' : 'var(--ck-text-2)',
                }}
              >
                {done ? '✓' : i + 1}
              </span>
              <span  style={{ fontSize: 14, color: 'var(--ck-text-1)' }}>
                {DELIVER_STAGE_LABEL[stage]}
              </span>
            </button>
          )
        })}
      </div>
      <div className="font-mono mt-3" style={{ fontSize: 10, color: 'var(--ck-accent)' }}>
        Aktuell: {DELIVER_STAGE_LABEL[project.internal_stage]}
      </div>
    </div>
  )
}
