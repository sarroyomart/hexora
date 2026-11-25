import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { loadSettings } from './game/storage.ts'
import './index.css'

document.documentElement.dataset.theme = loadSettings().theme

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
