export default function UploadProgressBar({ progress, count }: { progress: number; count?: number }) {
  const pct = Math.round(progress * 100)
  return (
    <div className="upload-progress-wrap">
      <div className="upload-progress-label">
        📤 {count != null && count > 1 ? `${count}개 ` : ''}업로드 중… {pct}%
      </div>
      <div className="upload-progress-track">
        <div className="upload-progress-fill" style={{ width: `${Math.max(4, pct)}%` }} />
      </div>
    </div>
  )
}
