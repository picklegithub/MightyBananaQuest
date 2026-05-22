import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import './styles/global.css'

// HashRouter is used instead of BrowserRouter so the app works on:
//   • Capacitor (Android / iOS) — runs on file:// URLs, no server for history fallback
//   • PWA — hash routing keeps identical behaviour across native + web builds
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
)
