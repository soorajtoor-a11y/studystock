// Thin, always-visible, click-to-reopen strip a side panel collapses down
// to — same idea as Claude's collapsible sidebar rail. The label reads
// top-to-bottom via CSS writing-mode so it still fits in ~44px. Shared by
// every collapsible side panel (Study Panel, Explain History, Grade
// History) so they all collapse/expand identically.
export default function CollapsedRail({ label, icon, onExpand }) {
  return (
    <button className="panel-rail" onClick={onExpand} title={`Show ${label}`} aria-label={`Show ${label}`}>
      <svg className="panel-rail-chevron" viewBox="0 0 20 20" fill="currentColor" width="12" height="12" aria-hidden="true">
        <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
      </svg>
      <span className="panel-rail-icon" aria-hidden="true">{icon}</span>
      <span className="panel-rail-label">{label}</span>
    </button>
  )
}
