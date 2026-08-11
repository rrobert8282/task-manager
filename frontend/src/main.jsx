import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { warmBackend } from './network.js'

// Fire immediately, but do NOT await it.
// React/local state should be allowed to load concurrently.
warmBackend()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)