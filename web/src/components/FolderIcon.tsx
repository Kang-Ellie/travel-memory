export type FolderColor = 'blue' | 'purple' | 'pink' | 'yellow' | 'green'

const FRONT: Record<FolderColor, string> = {
  blue: 'var(--blue-soft)', purple: 'var(--purple-soft)', pink: 'var(--pink-soft)',
  yellow: 'var(--yellow-soft)', green: 'var(--green-soft)',
}
const BACK: Record<FolderColor, string> = {
  blue: 'var(--blue-deep)', purple: 'var(--purple-deep)', pink: 'var(--pink-deep)',
  yellow: 'var(--yellow-deep)', green: 'var(--green-deep)',
}

export default function FolderIcon({ color, size = 56 }: { color: FolderColor; size?: number }) {
  return (
    <svg width={size} height={size * 0.8} viewBox="0 0 100 80" style={{ display: 'block' }}>
      <path
        d="M8 26 V15 Q8 10 13 10 H38 L46 18 H87 Q92 18 92 23 V26 Z"
        fill={BACK[color]} stroke="var(--ink)" strokeWidth="3" strokeLinejoin="round"
      />
      <rect x="8" y="24" width="84" height="47" rx="8"
        fill={FRONT[color]} stroke="var(--ink)" strokeWidth="3" strokeLinejoin="round" />
      <line x1="14" y1="63" x2="86" y2="63" stroke={BACK[color]} strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
    </svg>
  )
}
