import type {
  Trip, Member, Place, TimelineEvent, Photo, Expense, Voucher, GooglePlaceResult,
  ArchiveItem, DayNote, DayPhoto, PlaceDetail, Country, City, FlightDetail, ValetDetail, LodgingDetail, CurrencyRate,
  DashboardData,
  ChecklistItem, ChecklistScope, BucketItem, TransitSegment,
} from '../shared/types'

export const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? 'http://localhost:8787'

export class ApiError extends Error {}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: 'include',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (res.status === 401) throw new ApiError('UNAUTHORIZED')
  if (!res.ok) throw new ApiError(`요청 실패 (${res.status})`)
  return (await res.json()) as T
}

async function upload<T>(path: string, files: File[], fields?: Record<string, string>): Promise<T> {
  const form = new FormData()
  for (const f of files) form.append('files', f)
  if (fields) for (const [k, v] of Object.entries(fields)) form.append(k, v)
  const res = await fetch(`${API_BASE}${path}`, { method: 'POST', credentials: 'include', body: form })
  if (res.status === 401) throw new ApiError('UNAUTHORIZED')
  if (!res.ok) throw new ApiError(`업로드 실패 (${res.status})`)
  return (await res.json()) as T
}

export function fileUrl(relPath: string): string {
  return `${API_BASE}/api/files/${relPath.split('/').map(encodeURIComponent).join('/')}`
}

export const auth = {
  session: () => req<{ authed: boolean }>('GET', '/api/session'),
  login: (passcode: string) => req<{ ok: true } | { error: string }>('POST', '/api/login', { passcode }),
  logout: () => req<{ ok: true }>('POST', '/api/logout'),
}

export const api = {
  trips: {
    list: () => req<Trip[]>('GET', '/api/trips'),
    create: (data: {
      title: string; startDate: string; endDate: string; budget: number; memberIds: string[]; cityIds: string[]
    }) => req<Trip>('POST', '/api/trips', data),
    update: (id: string, data: {
      title: string; startDate: string; endDate: string; budget: number; cityIds: string[]
    }) => req<void>('PUT', `/api/trips/${id}`, data),
    delete: (id: string) => req<void>('DELETE', `/api/trips/${id}`),
  },

  countries: {
    list: () => req<Country[]>('GET', '/api/countries'),
    create: (data: Omit<Country, 'id' | 'createdAt'>) => req<Country>('POST', '/api/countries', data),
    update: (id: string, data: Omit<Country, 'id' | 'createdAt'>) => req<void>('PUT', `/api/countries/${id}`, data),
    delete: (id: string) => req<{ error?: string }>('DELETE', `/api/countries/${id}`),
  },

  cities: {
    list: () => req<City[]>('GET', '/api/cities'),
    create: (data: {
      countryId: string; name: string; flightDuration: string | null; timeDiff: string | null
      flightAirport?: string | null
    }) => req<City>('POST', '/api/cities', data),
    update: (id: string, data: {
      name: string; flightDuration: string | null; timeDiff: string | null; flightAirport?: string | null
    }) => req<void>('PUT', `/api/cities/${id}`, data),
    delete: (id: string) => req<{ error?: string }>('DELETE', `/api/cities/${id}`),
  },

  members: {
    list: () => req<Member[]>('GET', '/api/members'),
    create: (name: string) => req<Member | { error: string }>('POST', '/api/members', { name }),
    update: (id: string, emoji: string | null) => req<void>('PUT', `/api/members/${id}`, { emoji }),
    delete: (id: string) => req<{ error?: string }>('DELETE', `/api/members/${id}`),
  },

  tripMembers: {
    list: (tripId: string) => req<Member[]>('GET', `/api/trips/${tripId}/members`),
    set: (tripId: string, memberIds: string[]) => req<void>('PUT', `/api/trips/${tripId}/members`, { memberIds }),
  },

  places: {
    list: () => req<Place[]>('GET', '/api/places'),
    create: (data: {
      name: string; address: string; category: string; lat?: number | null; lng?: number | null
      memo?: string | null; mapUrl?: string | null; rating?: number | null
      pros?: string | null; cons?: string | null; countryId?: string | null; cityId?: string | null
      hours?: string | null; reservationNeeded?: boolean; recommendedMenu?: string | null; breakTime?: string | null
      valetCompany?: string | null; bookingChannel?: string | null
      grade?: string | null; directions?: string | null; babyMenu?: string | null; recommend?: boolean | null
    }) => req<Place>('POST', '/api/places', data),
    update: (id: string, data: {
      name: string; address: string; category: string; memo: string | null; mapUrl: string | null
      rating: number | null; pros: string | null; cons: string | null
      countryId: string | null; cityId: string | null
      hours: string | null; reservationNeeded: boolean; recommendedMenu: string | null; breakTime: string | null
      valetCompany?: string | null; bookingChannel?: string | null
      grade?: string | null; directions?: string | null; babyMenu?: string | null; recommend?: boolean | null
    }) => req<void>('PUT', `/api/places/${id}`, data),
    delete: (id: string) => req<{ error?: string }>('DELETE', `/api/places/${id}`),
    detail: (id: string) => req<PlaceDetail>('GET', `/api/places/${id}/detail`),
    googleSearch: (query: string) =>
      req<GooglePlaceResult[] | { error: string }>('GET', `/api/places/google-search?q=${encodeURIComponent(query)}`),
    resolveMapLink: (url: string) =>
      req<{ name: string | null; address: string | null; lat: number | null; lng: number | null } | { error: string }>(
        'GET', `/api/places/resolve-map-link?url=${encodeURIComponent(url)}`),
  },

  events: {
    list: (tripId: string) => req<TimelineEvent[]>('GET', `/api/trips/${tripId}/events`),
    create: (data: { tripId: string; placeId: string; dayNumber: number | null }) =>
      req<{ id: string }>('POST', `/api/trips/${data.tripId}/events`, data),
    update: (id: string, data: {
      rating: number | null; review: string | null; linkUrl: string | null
      mustTry: string | null; memo: string | null; plannedTime: string | null; bucketItemId?: string | null
    }) => req<void>('PUT', `/api/events/${id}`, data),
    reorder: (data: { tripId: string; dayNumber: number; orderedIds: string[] }) =>
      req<void>('POST', `/api/trips/${data.tripId}/events/reorder`, data),
    assignDay: (tripId: string, id: string, dayNumber: number) =>
      req<void>('PUT', `/api/trips/${tripId}/events/${id}/assign-day`, { dayNumber }),
    delete: (id: string) => req<void>('DELETE', `/api/events/${id}`),
    setFlight: (id: string, data: FlightDetail) => req<void>('PUT', `/api/events/${id}/flight`, data),
    uploadFlightLogo: (id: string, file: File) => upload<FlightDetail>(`/api/events/${id}/flight/logo`, [file]),
    deleteFlight: (id: string) => req<void>('DELETE', `/api/events/${id}/flight`),
    setValet: (id: string, data: ValetDetail) => req<void>('PUT', `/api/events/${id}/valet`, data),
    setLodging: (id: string, data: LodgingDetail) => req<void>('PUT', `/api/events/${id}/lodging`, data),
  },

  transit: {
    list: (tripId: string, dayNumber?: number) =>
      req<TransitSegment[]>('GET', `/api/trips/${tripId}/transit${dayNumber != null ? `?day=${dayNumber}` : ''}`),
    create: (data: {
      tripId: string; dayNumber: number; afterEventId: string | null; mode: string
      durationText: string | null; note?: string | null
    }) => req<TransitSegment>('POST', `/api/trips/${data.tripId}/transit`, data),
    update: (id: string, data: {
      mode?: string; durationText?: string | null; note?: string | null
      voucherId?: string | null; afterEventId?: string | null
    }) => req<void>('PUT', `/api/transit/${id}`, data),
    delete: (id: string) => req<void>('DELETE', `/api/transit/${id}`),
  },

  expenses: {
    list: (tripId: string) => req<Expense[]>('GET', `/api/trips/${tripId}/expenses`),
    create: (data: {
      tripId: string; eventId: string | null; amount: number; currency: string; category: string
      description: string; paidBy: string; splitWith: string[]; spentAt: string
      paymentMethod: string | null; memo: string | null; purchaseItems: string | null
      isShared: boolean; isPrebooked: boolean
    }) => req<void>('POST', `/api/trips/${data.tripId}/expenses`, data),
    delete: (id: string) => req<void>('DELETE', `/api/expenses/${id}`),
  },

  rates: {
    list: (tripId: string) => req<CurrencyRate[]>('GET', `/api/trips/${tripId}/rates`),
    set: (tripId: string, currency: string, krwPerUnit: number) =>
      req<void>('PUT', `/api/trips/${tripId}/rates/${currency}`, { krwPerUnit }),
  },

  checklist: {
    list: (tripId: string, scope: ChecklistScope, dayNumber?: number) =>
      req<ChecklistItem[]>('GET', `/api/trips/${tripId}/checklist?scope=${scope}${dayNumber != null ? `&day=${dayNumber}` : ''}`),
    create: (data: { tripId: string; scope: ChecklistScope; dayNumber: number | null; text: string; category?: string | null }) =>
      req<ChecklistItem>('POST', `/api/trips/${data.tripId}/checklist`, data),
    update: (id: string, data: { text?: string; done?: boolean }) =>
      req<void>('PUT', `/api/checklist/${id}`, data),
    delete: (id: string) => req<void>('DELETE', `/api/checklist/${id}`),
    seedPresets: (tripId: string, scope: 'predeparture' | 'packing') =>
      req<void>('POST', `/api/trips/${tripId}/checklist/seed-presets`, { scope }),
  },

  bucket: {
    list: () => req<BucketItem[]>('GET', '/api/bucket'),
    create: (data: {
      title: string; memo: string | null; countryIds: string[]; cityIds: string[]
      category: string | null; linkedPlaceId?: string | null; linkedTripId?: string | null
    }) => req<BucketItem>('POST', '/api/bucket', data),
    update: (id: string, data: { done?: boolean; linkedTripId?: string | null; linkedPlaceId?: string | null }) =>
      req<void>('PUT', `/api/bucket/${id}`, data),
    delete: (id: string) => req<void>('DELETE', `/api/bucket/${id}`),
    uploadPhoto: (id: string, file: File) => upload<BucketItem>(`/api/bucket/${id}/photo`, [file]),
    deletePhoto: (id: string) => req<void>('DELETE', `/api/bucket/${id}/photo`),
  },

  vouchers: {
    list: (tripId: string) => req<Voucher[]>('GET', `/api/trips/${tripId}/vouchers`),
    add: (tripId: string, files: File[], category: string) =>
      upload<Voucher[]>(`/api/trips/${tripId}/vouchers`, files, { category }),
    delete: (id: string) => req<void>('DELETE', `/api/vouchers/${id}`),
  },

  photos: {
    add: (eventId: string, files: File[]) => upload<Photo[]>(`/api/events/${eventId}/photos`, files),
    delete: (id: string) => req<void>('DELETE', `/api/photos/${id}`),
  },

  archive: {
    list: (tripId: string) => req<ArchiveItem[]>('GET', `/api/trips/${tripId}/archive`),
    addMemo: (data: { tripId: string; title: string; body: string }) =>
      req<ArchiveItem>('POST', `/api/trips/${data.tripId}/archive/memo`, data),
    addLink: (data: { tripId: string; title: string; url: string }) =>
      req<ArchiveItem>('POST', `/api/trips/${data.tripId}/archive/link`, data),
    addImage: (tripId: string, files: File[]) => upload<ArchiveItem[]>(`/api/trips/${tripId}/archive/image`, files),
    delete: (id: string) => req<void>('DELETE', `/api/archive/${id}`),
    convertToEvent: (data: { archiveId: string; tripId: string; dayNumber: number }) =>
      req<void>('POST', `/api/archive/${data.archiveId}/convert`, data),
    // SNS 아카이브 — 여행에 속하지 않는 전역 링크 보관함
    listGlobal: () => req<ArchiveItem[]>('GET', '/api/archive'),
    addLinkGlobal: (data: { title: string; url: string }) => req<ArchiveItem>('POST', '/api/archive/link', data),
    linkPlace: (id: string, placeId: string | null) => req<void>('PUT', `/api/archive/${id}`, { linkedPlaceId: placeId }),
  },

  dayNotes: {
    list: (tripId: string) => req<DayNote[]>('GET', `/api/trips/${tripId}/day-notes`),
    set: (tripId: string, dayNumber: number, data: {
      note: string | null; diary: string | null; weatherEmoji: string | null; weatherTemp: number | null
      cityIds: string[]; budget: number | null
    }) => req<void>('PUT', `/api/trips/${tripId}/day-notes/${dayNumber}`, data),
    addPhotos: (tripId: string, dayNumber: number, files: File[]) =>
      upload<DayPhoto[]>(`/api/trips/${tripId}/day-notes/${dayNumber}/photos`, files),
    deletePhoto: (id: string) => req<void>('DELETE', `/api/day-note-photos/${id}`),
  },

  settings: {
    get: (key: string) => req<{ value: string | null }>('GET', `/api/settings/${key}`).then((r) => r.value),
    set: (key: string, value: string) => req<void>('PUT', `/api/settings/${key}`, { value }),
  },

  dashboard: {
    get: () => req<DashboardData>('GET', '/api/dashboard'),
  },
}
