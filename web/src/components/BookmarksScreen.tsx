import { useEffect, useState } from 'react'
import type { SharePrefill } from '../App'
import PlacesScreen from './PlacesScreen'
import BucketListScreen from './BucketListScreen'
import SnsArchiveScreen from './SnsArchiveScreen'
import FolderIcon, { type FolderColor } from './FolderIcon'

type BookmarkSection = 'places' | 'bucket' | 'sns'

const SECTIONS: Array<{ key: BookmarkSection; label: string; color: FolderColor }> = [
  { key: 'places', label: '📍 장소 북마크', color: 'blue' },
  { key: 'bucket', label: '✨ 버킷리스트', color: 'purple' },
  { key: 'sns', label: '🔗 SNS 아카이브', color: 'yellow' },
]

export default function BookmarksScreen({
  prefill, onConsumedPrefill,
}: { prefill: SharePrefill | null; onConsumedPrefill: () => void }) {
  const [section, setSection] = useState<BookmarkSection>(prefill ? 'sns' : 'places')

  useEffect(() => { if (prefill) setSection('sns') }, [prefill])

  return (
    <div>
      <div className="folder-tabs">
        {SECTIONS.map((s) => (
          <button key={s.key} className={`folder-tab ${section === s.key ? 'active' : ''}`}
            onClick={() => setSection(s.key)}>
            <FolderIcon color={s.color} />
            <span>{s.label}</span>
          </button>
        ))}
      </div>
      {section === 'places' && <PlacesScreen />}
      {section === 'bucket' && <BucketListScreen />}
      {section === 'sns' && <SnsArchiveScreen prefill={prefill} onConsumedPrefill={onConsumedPrefill} />}
    </div>
  )
}
