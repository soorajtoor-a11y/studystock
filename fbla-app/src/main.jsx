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

// Hidden dev-team login route (vye-waitlist-dev-bypass-spec.md). Unlinked
// from any nav/sitemap; while the site is in waitlist mode this is where the
// dev team signs in through the normal auth form to bypass the gate. The
// obscurity of the path is NOT the security — the server-side DEV_ALLOWLIST
// check is (see /api/gate-status + the gate middleware in server.js). Passed
// into App so it can force the login form even when the public sees only the
// waitlist. noindex for this path is set from inside App on mount.
const teamAccess = path === '/team-access'

const Root = path === '/privacy' ? PrivacyPolicy
  : path === '/terms' ? TermsOfService
  : () => <App teamAccess={teamAccess} />

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
