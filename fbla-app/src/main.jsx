import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './shadcn.css'
import App from './App.jsx'
import { PrivacyPolicy, TermsOfService } from './LegalPages.jsx'

// Standalone legal pages get a real URL (linked from the footer, and
// shareable/bookmarkable on their own) rather than living inside the app's
// internal page-state machine — there's no router library in this project,
// so a plain pathname check is enough for these two static routes.
const path = window.location.pathname
const Root = path === '/privacy' ? PrivacyPolicy
  : path === '/terms' ? TermsOfService
  : App

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
