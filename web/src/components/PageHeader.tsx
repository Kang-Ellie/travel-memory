export default function PageHeader({
  icon, title, eng, description,
}: { icon: string; title: string; eng?: string; description?: string }) {
  return (
    <div className="page-header">
      <div className="page-header-row">
        <h1 className="page-header-title">{icon} {title}</h1>
        {eng && <span className="chip yellow page-header-eng">{eng}</span>}
      </div>
      {description && <p className="page-header-desc">{description}</p>}
    </div>
  )
}
