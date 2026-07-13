// Small shared building blocks for the marketing landing page.
// Kept intentionally thin — they just apply the shared design-token classes
// defined in Landing.css so every section stays visually consistent.

export function Button({ as: Tag = 'button', variant = 'primary', size = 'md', className = '', children, ...rest }) {
  return (
    <Tag className={`btn btn-${variant} btn-${size} ${className}`} {...rest}>
      {children}
    </Tag>
  )
}

export function Card({ className = '', children, ...rest }) {
  return (
    <div className={`ui-card ${className}`} {...rest}>
      {children}
    </div>
  )
}

export function Section({ className = '', children, ...rest }) {
  return (
    <section className={`ui-section ${className}`} {...rest}>
      {children}
    </section>
  )
}

export function Eyebrow({ children }) {
  return <p className="ui-eyebrow">{children}</p>
}
