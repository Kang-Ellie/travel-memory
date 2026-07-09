export interface Trip {
  id: string
  title: string
  startDate: string
  endDate: string
  budget: number
  createdAt: string
}

export interface Member {
  id: string
  name: string
}

export interface Place {
  id: string
  name: string
  address: string
  category: string
  lat: number | null
  lng: number | null
  memo: string | null
  createdAt: string
}

export interface Photo {
  id: string
  eventId: string
  filePath: string
}

export interface TimelineEvent {
  id: string
  tripId: string
  placeId: string
  dayNumber: number
  sequence: number
  plannedTime: string | null
  rating: number | null
  review: string | null
  mustTry: string | null
  linkUrl: string | null
  createdAt: string
  place: Place
  photos: Photo[]
}

export const EXPENSE_CATEGORIES = ['식비', '숙소', '교통', '쇼핑', '기타'] as const
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

export interface Expense {
  id: string
  tripId: string
  eventId: string | null
  amount: number
  currency: string
  category: string
  description: string
  paidBy: string
  payerName: string
  splitWith: string[]
  spentAt: string
}

export interface Voucher {
  id: string
  tripId: string
  title: string
  fileType: string
  filePath: string
  createdAt: string
}

export type ArchiveKind = 'memo' | 'link' | 'image'

export interface ArchiveItem {
  id: string
  tripId: string
  kind: ArchiveKind
  title: string
  body: string | null
  filePath: string | null
  createdAt: string
}

export interface DayNote {
  tripId: string
  dayNumber: number
  note: string | null
  weather: string | null
}

export interface PlaceVisit extends TimelineEvent {
  tripTitle: string
}

export interface PlaceDetail {
  place: Place
  visits: PlaceVisit[]
  expenseTotals: Array<{ currency: string; total: number }>
}

export interface GooglePlaceResult {
  name: string
  address: string
  lat: number
  lng: number
  category: string
  googleRating: number | null
}
