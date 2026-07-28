import { NavLink } from 'react-router-dom'

const TABS = [
  { to: '/aufgaben', label: 'Aufgaben' },
  { to: '/termine', label: 'Termine' },
  { to: '/freigaben', label: 'Freigaben' },
  { to: '/linkedin', label: 'LinkedIn' },
]

/** Sub-Nav für die zusammengefassten „Heute"-Bereiche (Aufgaben · Termine · Freigaben · LinkedIn). */
export function HeuteTabs() {
  return (
    <div
      style={{
        display: 'flex',
        gap: 2,
        marginBottom: 14,
        borderBottom: '1px solid var(--ck-border)',
      }}
    >
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end
          style={({ isActive }) => ({
            padding: '7px 14px',
            fontSize: 12,
            fontWeight: isActive ? 600 : 400,
            color: isActive ? 'var(--ck-accent)' : 'var(--ck-text-2)',
            borderBottom: `2px solid ${isActive ? 'var(--ck-accent)' : 'transparent'}`,
            marginBottom: -1,
            textDecoration: 'none',
          })}
        >
          {t.label}
        </NavLink>
      ))}
    </div>
  )
}
