/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          void: 'var(--bg-void)',
          base: 'var(--bg-base)',
          surface: 'var(--bg-surface)',
        },
        accent: {
          blue: 'var(--accent-blue)',
          purple: 'var(--accent-purple)',
          teal: 'var(--accent-teal)',
          amber: 'var(--accent-amber)',
          coral: 'var(--accent-coral)',
        },
        mode: {
          building: 'var(--mode-building)',
          promo: 'var(--mode-promo)',
          sales: 'var(--mode-sales)',
          intelligence: 'var(--mode-intelligence)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
        },
      },
      // Eine Wahrheit statt zweier: die Familien stehen in tokens.css. Bis
      // Phase 2 standen die alten Namen (Syne/DM Sans/JetBrains) hier hart —
      // und weil Tailwinds Utilities NACH tokens.css geladen werden, gewann
      // diese Liste. Die Anmelde- und Portal-Flaechen liefen deshalb nach dem
      // Font-Wechsel (Zug A1) auf System-Ersatzschriften statt auf Inter.
      fontFamily: {
        display: ['var(--font-display)'],
        body: ['var(--font-body)'],
        mono: ['var(--font-mono)'],
      },
      fontSize: {
        xs: 'var(--text-xs)',
        sm: 'var(--text-sm)',
        base: 'var(--text-base)',
        md: 'var(--text-md)',
        lg: 'var(--text-lg)',
        xl: 'var(--text-xl)',
        '2xl': 'var(--text-2xl)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.16, 1, 0.3, 1)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
    },
  },
  plugins: [],
}
