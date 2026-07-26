import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
)

// Cached access token, kept current so apiFetch doesn't have to await
// getSession() before every request. Seeded on load and updated on every
// auth state change (sign in/out/token refresh).
let accessToken = null
supabase.auth.getSession().then(({ data }) => { accessToken = data.session?.access_token ?? null })
supabase.auth.onAuthStateChange((_event, session) => { accessToken = session?.access_token ?? null })

// fetch() wrapper for this app's OWN Express API (the /api/* routes). Attaches
// the current Supabase session as a Bearer token so the server's waitlist
// access gate can verify the caller is a dev-allowlisted user. Use this for
// every call to our /api/* endpoints; keep using supabase.from(...) directly
// for database reads/writes (those are gated by RLS, not this token).
export function apiFetch(url, options = {}) {
  const headers = { ...(options.headers || {}) }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  return fetch(url, { ...options, headers })
}
