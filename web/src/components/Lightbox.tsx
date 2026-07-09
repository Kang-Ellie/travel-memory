import { useEffect, useState } from 'react'

export default function Lightbox({
  images, index, onClose,
}: { images: string[]; index: number; onClose: () => void }) {
  const [i, setI] = useState(index)

  useEffect(() => { setI(index) }, [index])

  const prev = () => setI((v) => (v - 1 + images.length) % images.length)
  const next = () => setI((v) => (v + 1) % images.length)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, images.length])

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <button className="lightbox-close" onClick={onClose}>×</button>
      {images.length > 1 && (
        <button className="lightbox-nav lightbox-prev" onClick={(e) => { e.stopPropagation(); prev() }}>‹</button>
      )}
      <img className="lightbox-img" src={images[i]} alt="" onClick={(e) => e.stopPropagation()} />
      {images.length > 1 && (
        <button className="lightbox-nav lightbox-next" onClick={(e) => { e.stopPropagation(); next() }}>›</button>
      )}
      {images.length > 1 && <div className="lightbox-counter">{i + 1} / {images.length}</div>}
    </div>
  )
}
