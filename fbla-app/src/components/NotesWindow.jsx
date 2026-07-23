import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import Reveal from './Reveal'
import NotesEditor from './NotesEditor'

// No relative-time helper exists elsewhere in the app yet (History/Explain
// History only show absolute previews, not "2h ago") — small and local
// rather than a dependency, since this is the only place that needs it.
function timeAgo(iso) {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day}d ago`
  const mo = Math.floor(day / 30)
  if (mo < 12) return `${mo}mo ago`
  return `${Math.floor(mo / 12)}y ago`
}

// The Notes tab's content — a "Sections" grid to generate/open each
// section's notes, and a "History" list of the signed-in user's own saved
// (and possibly edited) copies, both feeding into the same NotesEditor.
export default function NotesWindow({ org, event, outline, user, onNeedAccount }) {
  const [view, setView] = useState('sections') // 'sections' | 'history'
  const [activeSection, setActiveSection] = useState(null)
  const [savedDocs, setSavedDocs] = useState(null) // null = loading, [] once resolved
  const [docsError, setDocsError] = useState(null)

  function refreshSavedDocs() {
    if (!user) { setSavedDocs([]); return }
    supabase.from('user_notes').select('id, section_letter, section_title, updated_at')
      .eq('user_id', user.id).eq('org', org).eq('event', event)
      .order('updated_at', { ascending: false })
      .then(({ data, error }) => { if (error) setDocsError(error.message); else setSavedDocs(data || []) })
  }

  useEffect(() => {
    setSavedDocs(null); setDocsError(null); setActiveSection(null); setView('sections')
    refreshSavedDocs()
  }, [org, event, user?.id])

  if (activeSection) {
    return (
      <NotesEditor
        org={org} event={event} section={activeSection} user={user}
        onNeedAccount={onNeedAccount}
        onBack={() => setActiveSection(null)}
        onSaved={refreshSavedDocs}
      />
    )
  }

  const docBySection = new Map((savedDocs || []).map(d => [d.section_letter, d]))

  return (
    <div className="notes-window">
      <div className="notes-view-toggle">
        <button className={`notes-view-btn ${view === 'sections' ? 'active' : ''}`} onClick={() => setView('sections')}>Sections</button>
        <button className={`notes-view-btn ${view === 'history' ? 'active' : ''}`} onClick={() => setView('history')}>
          History{savedDocs && savedDocs.length > 0 ? ` · ${savedDocs.length}` : ''}
        </button>
      </div>

      {view === 'sections' && (
        <div className="notes-section-grid">
          {outline.map((section, i) => {
            const doc = docBySection.get(section.letter)
            return (
              <Reveal key={section.letter} delay={i * 40} className="notes-section-card">
                <div className="sp-card-header">
                  <span className="sp-letter">{section.letter}</span>
                  <div>
                    <div className="sp-card-title">{section.title}</div>
                    <div className="sp-card-sub">{section.objectives.length} objectives</div>
                  </div>
                </div>
                <button className="notes-gen-btn" onClick={() => setActiveSection(section)}>
                  {doc ? '📖 Open Notes' : '✨ Generate Notes'}
                </button>
              </Reveal>
            )
          })}
        </div>
      )}

      {view === 'history' && (
        <div className="notes-history-list">
          {!user && (
            <div className="notes-signin-banner notes-signin-banner-block">
              <span>Sign in to keep a saved, editable history of your notes.</span>
              <button className="notes-signin-btn" onClick={onNeedAccount}>Sign In</button>
            </div>
          )}

          {user && docsError && (
            <div className="pane-error">
              <div className="pane-error-icon">⚠</div>
              <p className="pane-error-msg">{docsError}</p>
            </div>
          )}

          {user && !docsError && savedDocs === null && <div className="loading">Loading…</div>}

          {user && !docsError && savedDocs && savedDocs.length === 0 && (
            <div className="chat-empty-state">
              <span className="chat-empty-icon">📄</span>
              <p>No saved notes yet — generate notes for a section to see it here.</p>
            </div>
          )}

          {user && !docsError && savedDocs && savedDocs.length > 0 && (
            <div className="convo-list">
              {savedDocs.map(doc => (
                <div key={doc.id} className="convo-card notes-history-card">
                  <div className="convo-card-preview notes-history-preview">
                    <span className="sp-letter notes-history-letter">{doc.section_letter}</span>
                    <div>
                      <div className="notes-history-title">{doc.section_title}</div>
                      <div className="notes-history-meta">Updated {timeAgo(doc.updated_at)}</div>
                    </div>
                  </div>
                  <button
                    className="convo-card-continue"
                    onClick={() => {
                      const section = outline.find(s => s.letter === doc.section_letter)
                      if (section) setActiveSection(section)
                    }}
                  >Open →</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
