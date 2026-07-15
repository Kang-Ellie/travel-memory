export default function PageHeader({
  icon, title, eng, description,
}: { icon: string; title: string; eng?: string; description?: string }) {
  return (
    <div className="page-header">
      <div className="page-header-eyebrow">TRAVEL ON{eng ? ` · ${eng}` : ''}</div>
      <div className="page-header-row">
        <h1 className="page-header-title">{icon} {title}</h1>
      </div>
      {description && <p className="page-header-desc">{description}</p>}
      <div className="page-header-rule" />
    </div>
  )
}
