export interface TripCity {
  id: string
  name: string
  countryName: string
  countryCode: string | null
}

export interface Trip {
  id: string
  title: string
  startDate: string
  endDate: string
  budget: number
  createdAt: string
  cities: TripCity[]
}

export interface Country {
  id: string
  name: string
  code: string | null
  capital: string | null
  phoneCode: string | null
  currency: string | null
  voltage: string | null
  language: string | null
  visa: string | null
  prepDocs: string | null
  emergencyPolice: string | null
  emergencyMedical: string | null
  createdAt: string
}

export interface City {
  id: string
  countryId: string
  name: string
  flightDuration: string | null
  timeDiff: string | null
  createdAt: string
  visited: boolean
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
  mapUrl: string | null
  rating: number | null
  pros: string | null
  cons: string | null
  countryId: string | null
  cityId: string | null
  countryName: string | null
  countryCode: string | null
  cityName: string | null
  createdAt: string
}

export interface TransitSegment {
  id: string
  tripId: string
  dayNumber: number
  afterEventId: string | null
  mode: string
  durationText: string | null
  note: string | null
  voucherId: string | null
  voucherTitle: string | null
  createdAt: string
}

export interface Photo {
  id: string
  eventId: string
  filePath: string
}

export interface FlightDetail {
  departAt: string | null
  arriveAt: string | null
  durationMinutes: number | null
  bookingRef: string | null
  bookedVia: string | null
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
  flight: FlightDetail | null
  bucketItemId: string | null
  bucketItemTitle: string | null
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
  paymentMethod: string | null
  memo: string | null
  purchaseItems: string | null
  isShared: boolean
  isPrebooked: boolean
}

export interface CurrencyRate {
  currency: string
  krwPerUnit: number
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
  diary: string | null
  weatherEmoji: string | null
  weatherTemp: number | null
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

export type ChecklistScope = 'day' | 'packing'

export interface ChecklistItem {
  id: string
  tripId: string
  scope: ChecklistScope
  dayNumber: number | null
  text: string
  done: boolean
  sequence: number
  createdAt: string
}

export interface BucketItem {
  id: string
  title: string
  memo: string | null
  countryId: string | null
  cityId: string | null
  countryName: string | null
  cityName: string | null
  category: string | null
  done: boolean
  linkedTripId: string | null
  linkedTripTitle: string | null
  linkedPlaceId: string | null
  linkedPlaceName: string | null
  createdAt: string
}
