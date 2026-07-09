import type {
  Trip, Member, Place, TimelineEvent, Photo, Expense, Voucher, GooglePlaceResult,
  ArchiveItem, DayNote, PlaceDetail,
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

async function upload<T>(path: string, files: File[]): Promise<T> {
  const form = new FormData()
  for (const f of files) form.append('files', f)
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
    create: (data: { title: string; startDate: string; endDate: string; budget: number; memberIds: string[] }) =>
      req<Trip>('POST', '/api/trips', data),
    update: (id: string, data: { title: string; startDate: string; endDate: string; budget: number }) =>
      req<void>('PUT', `/api/trips/${id}`, data),
    delete: (id: string) => req<void>('DELETE', `/api/trips/${id}`),
  },

  members: {
    list: () => req<Member[]>('GET', '/api/members'),
    create: (name: string) => req<Member | { error: string }>('POST', '/api/members', { name }),
    delete: (id: string) => req<{ error?: string }>('DELETE', `/api/members/${id}`),
  },

  tripMembers: {
    list: (tripId: string) => req<Member[]>('GET', `/api/trips/${tripId}/members`),
    set: (tripId: string, memberIds: string[]) => req<void>('PUT', `/api/trips/${tripId}/members`, { memberIds }),
  },

  places: {
    list: () => req<Place[]>('GET', '/api/places'),
    create: (data: { name: string; address: string; category: string; lat?: number | null; lng?: number | null; memo?: string | null }) =>
      req<Place>('POST', '/api/places', data),
    update: (id: string, data: { name: string; address: string; category: string; memo: string | null }) =>
      req<void>('PUT', `/api/places/${id}`, data),
    delete: (id: string) => req<{ error?: string }>('DELETE', `/api/places/${id}`),
    detail: (id: string) => req<PlaceDetail>('GET', `/api/places/${id}/detail`),
    googleSearch: (query: string) =>
      req<GooglePlaceResult[] | { error: string }>('GET', `/api/places/google-search?q=${encodeURIComponent(query)}`),
  },

  events: {
    list: (tripId: string) => req<TimelineEvent[]>('GET', `/api/trips/${tripId}/events`),
    create: (data: { tripId: string; placeId: string; dayNumber: number }) =>
      req<{ id: string }>('POST', `/api/trips/${data.tripId}/events`, data),
    update: (id: string, data: {
      rating: number | null; review: string | null; linkUrl: string | null
      mustTry: string | null; plannedTime: string | null
    }) => req<void>('PUT', `/api/events/${id}`, data),
    reorder: (data: { tripId: string; dayNumber: number; orderedIds: string[] }) =>
      req<void>('POST', `/api/trips/${data.tripId}/events/reorder`, data),
    delete: (id: string) => req<void>('DELETE', `/api/events/${id}`),
  },

  expenses: {
    list: (tripId: string) => req<Expense[]>('GET', `/api/trips/${tripId}/expenses`),
    create: (data: {
      tripId: string; eventId: string | null; amount: number; currency: string; category: string
      description: string; paidBy: string; splitWith: string[]; spentAt: string
    }) => req<void>('POST', `/api/trips/${data.tripId}/expenses`, data),
    delete: (id: string) => req<void>('DELETE', `/api/expenses/${id}`),
  },

  vouchers: {
    list: (tripId: string) => req<Voucher[]>('GET', `/api/trips/${tripId}/vouchers`),
    add: (tripId: string, files: File[]) => upload<Voucher[]>(`/api/trips/${tripId}/vouchers`, files),
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
  },

  dayNotes: {
    list: (tripId: string) => req<DayNote[]>('GET', `/api/trips/${tripId}/day-notes`),
    set: (tripId: string, dayNumber: number, data: { note: string | null; weather: string | null }) =>
      req<void>('PUT', `/api/trips/${tripId}/day-notes/${dayNumber}`, data),
  },

  settings: {
    get: (key: string) => req<{ value: string | null }>('GET', `/api/settings/${key}`).then((r) => r.value),
    set: (key: string, value: string) => req<void>('PUT', `/api/settings/${key}`, { value }),
  },
}
