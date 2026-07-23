import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useFakeProgress } from '../lib/useFakeProgress'
import ProgressBar from './ProgressBar'

// Plain, uncontrolled contentEditable text — deliberately NOT a controlled
// React input. A controlled contentEditable (value prop re-applied via
// textContent/innerHTML on every keystroke's re-render) resets the cursor to
// the start on every render, which is exactly the "feels broken" opposite of
// a Google Doc. Instead: seed the DOM once on mount (each entry keeps its own
// node across re-renders via its stable `key`, so this never re-fires for an
// entry that already exists), let the browser own the text after that, and
// only read it back out via onInput/onBlur for the debounced save.
function EditableText({ initialValue, onChange, className, placeholder, multiline, elRef }) {
  const ref = useRef(null)

  useEffect(() => {
    if (ref.current) ref.current.textContent = initialValue || ''
    // Intentionally mount-only — see comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function read(el) {
    // innerText (not textContent) so <br> line breaks inserted below come
    // back out as real "\n" characters instead of being silently dropped.
    onChange(el.innerText.replace(/\n+$/, ''))
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      if (multiline) {
        e.preventDefault()
        document.execCommand('insertLineBreak')
      } else {
        e.preventDefault()
        e.currentTarget.blur()
      }
    }
  }

  return (
    <div
      // Callback ref sets both this component's own mount-only seeding ref
      // AND the parent's externally-owned elRef (so NotesEditor can hit-test
      // and focus this exact node when a click lands in the surrounding
      // whitespace, not literally on the text itself) — see handleEntryClick.
      ref={node => { ref.current = node; if (elRef) elRef.current = node }}
      className={className}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      onInput={e => read(e.currentTarget)}
      onBlur={e => read(e.currentTarget)}
      onKeyDown={handleKeyDown}
    />
  )
}

// Focuses `el` and places the caret as close as possible to (clientX,
// clientY) — the actual point the user clicked — rather than just dumping
// the cursor at the start or end. This is what makes clicking in the
// whitespace around a paragraph (not literally on a letter) still land the
// cursor exactly where a real document editor would put it.
function focusAtPoint(el, clientX, clientY) {
  if (!el) return
  el.focus()
  let range = null
  if (document.caretRangeFromPoint) {
    range = document.caretRangeFromPoint(clientX, clientY)
  } else if (document.caretPositionFromPoint) {
    const pos = document.caretPositionFromPoint(clientX, clientY)
    if (pos) { range = document.createRange(); range.setStart(pos.offsetNode, pos.offset) }
  }
  const sel = window.getSelection()
  sel.removeAllRanges()
  if (range && el.contains(range.startContainer)) {
    range.collapse(true)
    sel.addRange(range)
  } else {
    // Neither caret API resolved inside this element (e.g. clicked past the
    // last line) — land at the very end of its text instead of doing nothing.
    const fallback = document.createRange()
    fallback.selectNodeContents(el)
    fallback.collapse(false)
    sel.addRange(fallback)
  }
}

function buildSectionText(section) {
  const objs = section.objectives.map(o => o.text).join('; ')
  return `${section.letter}. ${section.title}: ${objs}`
}

// Server response entries -> editor entries: adds a client-generated id
// (stable React key / delete target, never sent back to /api/notes) and
// custom:false (distinguishes AI-generated entries from ones the user adds
// themselves in the editor below).
function normalizeFetchedNotes(notes) {
  return (notes || []).map(n => ({
    id: crypto.randomUUID(),
    objective_num: n.objective_num,
    heading: n.heading || '',
    body: n.body || '',
    custom: false,
  }))
}

// One section's notes doc — read-only (signed out) or editable + autosaving
// (signed in). Signed-in load order: look for this user's own saved copy in
// `user_notes` first; only fall through to POST /api/notes (the shared,
// globally-cached generation endpoint — unchanged) the first time a section
// has no personal copy yet, then seed a new user_notes row from that result.
export default function NotesEditor({ org, event, section, user, onNeedAccount, onBack, onSaved }) {
  const [entries, setEntries] = useState(null) // null = loading
  const [rowId, setRowId] = useState(null)
  const [error, setError] = useState(null)
  const [saveState, setSaveState] = useState('idle') // 'idle' | 'saving' | 'saved'
  const progress = useFakeProgress(entries === null && !error, 6000)
  // First entries value after a load/seed is the data we just read — never
  // re-save that unchanged, only save once the user actually edits it.
  const skipNextSave = useRef(true)

  useEffect(() => {
    let cancelled = false
    skipNextSave.current = true
    setEntries(null); setRowId(null); setError(null); setSaveState('idle')

    async function load() {
      if (user) {
        const { data, error: selErr } = await supabase.from('user_notes').select('*')
          .eq('user_id', user.id).eq('org', org).eq('event', event).eq('section_letter', section.letter)
          .maybeSingle()
        if (cancelled) return
        if (selErr) { setError(selErr.message); return }
        if (data) { setEntries(data.entries || []); setRowId(data.id); return }
      }

      try {
        const res = await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ org, event, objective: buildSectionText(section), objectives: section.objectives }),
        })
        const d = await res.json()
        if (cancelled) return
        if (d.error) { setError(d.error); return }
        const fresh = normalizeFetchedNotes(d.notes)

        if (user) {
          const title = `${section.letter}. ${section.title}`
          const { data: inserted, error: insErr } = await supabase.from('user_notes')
            .insert({ user_id: user.id, org, event, section_letter: section.letter, section_title: title, entries: fresh })
            .select().single()
          if (cancelled) return
          if (insErr) { setError(insErr.message); return }
          setEntries(inserted.entries); setRowId(inserted.id)
          onSaved?.()
        } else {
          setEntries(fresh)
        }
      } catch (e) {
        if (!cancelled) setError(e.message)
      }
    }
    load()
    return () => { cancelled = true }
  }, [org, event, section.letter, user?.id])

  // Debounced autosave — only once signed in and a row exists to save into.
  useEffect(() => {
    if (!user || !rowId || entries === null) return
    if (skipNextSave.current) { skipNextSave.current = false; return }
    setSaveState('saving')
    const t = setTimeout(async () => {
      const { error: saveErr } = await supabase.from('user_notes')
        .update({ entries, updated_at: new Date().toISOString() })
        .eq('id', rowId)
      if (!saveErr) {
        setSaveState('saved')
        setTimeout(() => setSaveState('idle'), 1600)
      }
    }, 800)
    return () => clearTimeout(t)
  }, [entries])

  function updateEntry(id, field, value) {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e))
  }
  function deleteEntry(id) {
    setEntries(prev => prev.filter(e => e.id !== id))
  }
  function addEntry() {
    const id = crypto.randomUUID()
    setEntries(prev => [...(prev || []), { id, objective_num: null, heading: '', body: '', custom: true }])
    requestAnimationFrame(() => {
      document.querySelector(`[data-entry-id="${id}"] .notes-editor-heading`)?.focus()
    })
  }

  // Plain objects (not useRef — refs can't be created inside a loop/callback)
  // holding each entry's live heading/body DOM nodes, keyed by entry id, so
  // clicking anywhere in an entry's row — its padding, next to the number
  // badge, the gap below its last line — can still find and focus the right
  // text, exactly like clicking anywhere on a real document page does.
  const entryRefsMap = useRef(new Map())
  function getEntryRefs(id) {
    if (!entryRefsMap.current.has(id)) {
      entryRefsMap.current.set(id, { heading: { current: null }, body: { current: null } })
    }
    return entryRefsMap.current.get(id)
  }

  // A click anywhere within one entry's row that DIDN'T land directly on its
  // own editable text (or the delete button) still places the cursor in
  // whichever of heading/body is vertically closer to the click — so there's
  // no dead space around a short line or next to the number badge.
  function handleEntryClick(e, id) {
    if (e.target.closest('[contenteditable="true"]') || e.target.closest('button')) return
    const refs = getEntryRefs(id)
    if (!refs.heading.current || !refs.body.current) return
    const midpoint = (refs.heading.current.getBoundingClientRect().bottom + refs.body.current.getBoundingClientRect().top) / 2
    focusAtPoint(e.clientY < midpoint ? refs.heading.current : refs.body.current, e.clientX, e.clientY)
    e.stopPropagation() // handled here — don't also let it fall through to handleDocClick below
  }

  // A click in genuine empty page space — the margin below the last entry,
  // above the "+ Add your own note" row — continues the last entry's body,
  // the way clicking past the end of a document's text does. Deliberately
  // excludes the kicker/title area at the very top (.notes-doc-header),
  // which isn't editable content at all.
  function handleDocClick(e) {
    if (!editable || !entries || entries.length === 0) return
    if (e.target.closest('[contenteditable="true"]') || e.target.closest('button') || e.target.closest('.notes-doc-header')) return
    const lastEntry = entries[entries.length - 1]
    const bodyEl = getEntryRefs(lastEntry.id).body.current
    if (!bodyEl) return
    bodyEl.focus()
    const sel = window.getSelection()
    const range = document.createRange()
    range.selectNodeContents(bodyEl)
    range.collapse(false)
    sel.removeAllRanges()
    sel.addRange(range)
  }

  const editable = Boolean(user && rowId)

  return (
    <div className="notes-editor">
      <div className="notes-editor-topbar">
        <button className="back-btn" onClick={onBack}>← Back to Notes</button>
        <span className={`notes-save-indicator ${saveState !== 'idle' ? 'visible' : ''}`}>
          {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved ✓' : ''}
        </span>
      </div>

      {error && (
        <div className="pane-error">
          <div className="pane-error-icon">⚠</div>
          <p>Couldn't load notes:</p>
          <p className="pane-error-msg">{error}</p>
        </div>
      )}

      {!error && entries === null && (
        <div className="pane-loading">
          <div className="pane-orb"><span className="pane-orb-ring" /><span className="pane-orb-core" /></div>
          <p className="pane-loading-title">Writing notes… {progress}%</p>
          <ProgressBar percent={progress} />
        </div>
      )}

      {!error && entries && (
        <div className="notes-doc-wrap">
          <div className={`notes-doc ${editable ? 'notes-doc-editable' : ''}`} onClick={handleDocClick}>
            <div className="notes-doc-header">
              <p className="notes-doc-kicker">One-Page Notes</p>
              <h1 className="notes-doc-title">{section.letter}. {section.title}</h1>
              <div className="notes-doc-rule" />
            </div>

            {!user && (
              <div className="notes-signin-banner">
                <span>Sign in to save your own editable copy of these notes.</span>
                <button className="notes-signin-btn" onClick={onNeedAccount}>Sign In</button>
              </div>
            )}

            {entries.map(n => (
              <div
                key={n.id} className="notes-entry notes-editor-entry" data-entry-id={n.id}
                onClick={editable ? e => handleEntryClick(e, n.id) : undefined}
              >
                {n.objective_num != null && <span className="notes-entry-num">{n.objective_num}</span>}
                <div className="notes-entry-body">
                  {editable ? (
                    <>
                      <EditableText
                        className="notes-editor-heading"
                        initialValue={n.heading}
                        placeholder="Heading"
                        onChange={val => updateEntry(n.id, 'heading', val)}
                        elRef={getEntryRefs(n.id).heading}
                      />
                      <EditableText
                        className="notes-editor-body-text"
                        initialValue={n.body}
                        placeholder="Write your notes…"
                        multiline
                        onChange={val => updateEntry(n.id, 'body', val)}
                        elRef={getEntryRefs(n.id).body}
                      />
                      <button
                        className="notes-editor-delete-btn" onClick={() => deleteEntry(n.id)}
                        aria-label="Delete note" title="Delete note"
                      >✕</button>
                    </>
                  ) : (
                    <>
                      <h3 className="notes-entry-heading">{n.heading}</h3>
                      <p className="notes-entry-text">{n.body}</p>
                    </>
                  )}
                </div>
              </div>
            ))}

            {editable && (
              <button className="notes-editor-add-btn" onClick={addEntry}>+ Click to add your own note</button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
