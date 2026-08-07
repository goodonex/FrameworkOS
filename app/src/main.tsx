import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { applyUiTheme, loadUiTheme } from './lib/uiThemeStorage'
import './index.css'

applyUiTheme(loadUiTheme())

/**
 * Service Worker registrieren (O3, Zug 1) — Voraussetzung für Web Push.
 *
 * Fehlertolerant: ohne Secure Context, im Privatfenster oder bei abgeschalteten
 * Workern schlägt das fehl. Das darf die App nicht aufhalten — Push ist ein
 * Zusatz, kein Fundament. Registrierung nach `load`, damit der Worker nicht mit
 * dem ersten Rendern um Bandbreite konkurriert.
 */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((e) => {
      console.warn('[push] Service Worker nicht registriert:', e?.message ?? e)
    })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
