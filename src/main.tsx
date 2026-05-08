import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import './shared/styles/utilities.css'
import './graph/graphMotion.css'
import App from './App.tsx'
import { applyThemeColorMeta } from './services/theme'

applyThemeColorMeta()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
