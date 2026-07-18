import type {
  Trip, Member, Place, TimelineEvent, Photo, Expense, Voucher, GooglePlaceResult,
  ArchiveItem, DayNote, DayPhoto, PlaceDetail, Country, City, FlightDetail, ValetDetail, LodgingDetail, ReservationDetail, CurrencyRate,
  DashboardData, ActivityLogEntry,
  ChecklistItem, ChecklistScope, BucketItem, TransitSegment, CityPlaceSummary, Airline,
} from '../shared/types'
import { toast } from './toast'

export const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? 'http://localhost:8787'

export class ApiError extends Error {}

// 로그인/로그아웃/세션 확인은 자체적으로 인라인 에러 메시지를 보여주므로(Login.tsx),
// 여기서 세션 만료 리다이렉트나 중복 토스트를 띄우지 않는다.
const AUTH_PATHS = new Set(['/api/login', '/api/logout', '/api/session'])

// 세션이 끊긴 상태로 아무 요청이나 눌렀을 때 화면이 조용히 그대로 있던 문제를 고치기 위해,
// 401을 여기 한 곳에서 잡아 App.tsx가 로그인 화면으로 전환하도록 전역 이벤트를 쏜다.
async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      credentials: 'include',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    if (!AUTH_PATHS.has(path)) {
      toast.error(navigator.onLine
        ? '네트워크 오류가 발생했어요. 연결을 확인해주세요.'
        : '오프라인 상태예요. 온라인일 때 한 번 열어본 화면은 오프라인에서도 볼 수 있어요.')
    }
    throw new ApiError('NETWORK_ERROR')
  }
  if (res.status === 401 && !AUTH_PATHS.has(path)) {
    window.dispatchEvent(new Event('app:unauthorized'))
    throw new ApiError('UNAUTHORIZED')
  }
  if (!res.ok && res.status !== 401) {
    // 503 + 오프라인 = 서비스워커가 "캐시에 없어서 못 보여줌"이라고 응답한 것 (sw.js 참고)
    if (!AUTH_PATHS.has(path)) {
      toast.error(res.status === 503 && !navigator.onLine
        ? '오프라인이라 아직 이 화면을 못 봤어요. 온라인일 때 한 번 열어두면 다음부턴 오프라인에서도 보여요.'
        : `요청이 실패했어요 (${res.status}). 잠시 후 다시 시도해주세요.`)
    }
    throw new ApiError(`요청 실패 (${res.status})`)
  }
  return (await res.json()) as T
}

// 여러 장 업로드가 끝날 때까지 화면이 무반응이던 문제 — fetch는 업로드 진행률을 못 주므로
// XHR로 바꿔서 xhr.upload.onprogress로 실시간 바이트 진행률(0~1)을 onProgress에 흘려보낸다.
async function upload<T>(
  path: string, files: File[], fields?: Record<string, string>, onProgress?: (fraction: number) => void,
): Promise<T> {
  const form = new FormData()
  for (const f of files) form.append('files', f)
  if (fields) for (const [k, v] of Object.entries(fields)) form.append(k, v)
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_BASE}${path}`)
    xhr.withCredentials = true
    if (onProgress) {
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total) }
    }
    xhr.onerror = () => {
      toast.error('네트워크 오류가 발생했어요. 연결을 확인해주세요.')
      reject(new ApiError('NETWORK_ERROR'))
    }
    xhr.onload = () => {
      if (xhr.status === 401) {
        window.dispatchEvent(new Event('app:unauthorized'))
        reject(new ApiError('UNAUTHORIZED'))
        return
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        toast.error(`업로드가 실패했어요 (${xhr.status}). 잠시 후 다시 시도해주세요.`)
        reject(new ApiError(`업로드 실패 (${xhr.status})`))
        return
      }
      try {
        resolve(JSON.parse(xhr.responseText) as T)
      } catch {
        reject(new ApiError('업로드 응답을 읽을 수 없어요.'))
      }
    }
    xhr.send(form)
  })
}

export function fileUrl(relPath: string): string {
  return `${API_BASE}/api/files/${relPath.split('/').map(encodeURIComponent).join('/')}`
}

// 업로드 시 함께 생성된 목록/그리드용 축소본 URL (서버 upload.ts의 thumbKeyOf와 동일한 규칙).
// 이미지가 아닌 파일(PDF 등)이나, 이 기능이 생기기 전에 올라간 과거 사진에는 썸네일이 없을 수
// 있으므로 반드시 Thumb 컴포넌트(원본 폴백 포함)를 통해서만 쓴다.
export function thumbUrl(relPath: string): string {
  const parts = relPath.split('/')
  const filename = parts.pop()!
  return fileUrl([...parts, `thumb_${filename}`].join('/'))
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
      title: string; startDate: string; endDate: string; budget: number; nights?: number | null; memberIds: string[]; cityIds: string[]
    }) => req<Trip>('POST', '/api/trips', data),
    update: (id: string, data: {
      title: string; startDate: string; endDate: string; budget: number; nights?: number | null; cityIds: string[]
    }) => req<{ ok: true; unassignedCount: number }>('PUT', `/api/trips/${id}`, data),
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
      flightAirport?: string | null; flightType?: string | null
      bestSeason?: string | null; caution?: string | null
    }) => req<City>('POST', '/api/cities', data),
    update: (id: string, data: {
      name: string; flightDuration: string | null; timeDiff: string | null
      flightAirport?: string | null; flightType?: string | null
      bestSeason?: string | null; caution?: string | null
    }) => req<void>('PUT', `/api/cities/${id}`, data),
    delete: (id: string) => req<{ error?: string }>('DELETE', `/api/cities/${id}`),
    places: (id: string) => req<CityPlaceSummary[]>('GET', `/api/cities/${id}/places`),
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
      grade?: string | null; stayType?: string | null; airportCode?: string | null; bookingUrl?: string | null
      valetDropoffLocation?: string | null; valetReturnLocation?: string | null
      checkInTime?: string | null; checkOutTime?: string | null
      directions?: string | null; babyMenu?: string | null
      recommend?: boolean | null; tip?: string | null
    }) => req<Place>('POST', '/api/places', data),
    update: (id: string, data: {
      name: string; address: string; category: string; memo: string | null; mapUrl: string | null
      rating: number | null; pros: string | null; cons: string | null
      countryId: string | null; cityId: string | null
      lat?: number | null; lng?: number | null
      hours: string | null; reservationNeeded: boolean; recommendedMenu: string | null; breakTime: string | null
      valetCompany?: string | null; bookingChannel?: string | null
      grade?: string | null; stayType?: string | null; airportCode?: string | null; bookingUrl?: string | null
      valetDropoffLocation?: string | null; valetReturnLocation?: string | null
      checkInTime?: string | null; checkOutTime?: string | null
      directions?: string | null; babyMenu?: string | null
      recommend?: boolean | null; tip?: string | null
    }) => req<void>('PUT', `/api/places/${id}`, data),
    delete: (id: string) => req<{ error?: string }>('DELETE', `/api/places/${id}`),
    detail: (id: string) => req<PlaceDetail>('GET', `/api/places/${id}/detail`),
    setCoverPhoto: (id: string, filePath: string | null) => req<void>('PUT', `/api/places/${id}/cover-photo`, { filePath }),
    googleSearch: (query: string) =>
      req<GooglePlaceResult[] | { error: string }>('GET', `/api/places/google-search?q=${encodeURIComponent(query)}`),
    resolveMapLink: (url: string) =>
      req<{ name: string | null; address: string | null; lat: number | null; lng: number | null } | { error: string }>(
        'GET', `/api/places/resolve-map-link?url=${encodeURIComponent(url)}`),
  },

  airlines: {
    list: () => req<Airline[]>('GET', '/api/airlines'),
    create: (data: { name: string }) => req<Airline>('POST', '/api/airlines', data),
    uploadLogo: (id: string, file: File) => upload<Airline>(`/api/airlines/${id}/logo`, [file]),
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
    setReservation: (id: string, data: ReservationDetail) => req<void>('PUT', `/api/events/${id}/reservation`, data),
    deleteReservation: (id: string) => req<void>('DELETE', `/api/events/${id}/reservation`),
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
      title: string; memo: string | null; tip?: string | null; countryIds: string[]; cityIds: string[]
      category: string | null; linkedPlaceId?: string | null; linkedTripId?: string | null
    }) => req<BucketItem>('POST', '/api/bucket', data),
    update: (id: string, data: {
      done?: boolean; linkedTripId?: string | null; linkedPlaceId?: string | null
      memo?: string | null; tip?: string | null
    }) => req<void>('PUT', `/api/bucket/${id}`, data),
    delete: (id: string) => req<void>('DELETE', `/api/bucket/${id}`),
    uploadPhoto: (id: string, file: File) => upload<BucketItem>(`/api/bucket/${id}/photo`, [file]),
    deletePhoto: (id: string) => req<void>('DELETE', `/api/bucket/${id}/photo`),
  },

  vouchers: {
    list: (tripId: string) => req<Voucher[]>('GET', `/api/trips/${tripId}/vouchers`),
    add: (tripId: string, files: File[], category: string, onProgress?: (fraction: number) => void) =>
      upload<Voucher[]>(`/api/trips/${tripId}/vouchers`, files, { category }, onProgress),
    delete: (id: string) => req<void>('DELETE', `/api/vouchers/${id}`),
  },

  photos: {
    add: (eventId: string, files: File[], onProgress?: (fraction: number) => void) =>
      upload<Photo[]>(`/api/events/${eventId}/photos`, files, undefined, onProgress),
    delete: (id: string) => req<void>('DELETE', `/api/photos/${id}`),
  },

  archive: {
    list: (tripId: string) => req<ArchiveItem[]>('GET', `/api/trips/${tripId}/archive`),
    addMemo: (data: { tripId: string; title: string; body: string }) =>
      req<ArchiveItem>('POST', `/api/trips/${data.tripId}/archive/memo`, data),
    addLink: (data: { tripId: string; title: string; url: string }) =>
      req<ArchiveItem>('POST', `/api/trips/${data.tripId}/archive/link`, data),
    addImage: (tripId: string, files: File[], onProgress?: (fraction: number) => void) =>
      upload<ArchiveItem[]>(`/api/trips/${tripId}/archive/image`, files, undefined, onProgress),
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
    addPhotos: (tripId: string, dayNumber: number, files: File[], onProgress?: (fraction: number) => void) =>
      upload<DayPhoto[]>(`/api/trips/${tripId}/day-notes/${dayNumber}/photos`, files, undefined, onProgress),
    addPhotosAuto: (tripId: string, files: File[], onProgress?: (fraction: number) => void) =>
      upload<{ photos: DayPhoto[]; dayCount: number }>(`/api/trips/${tripId}/day-notes/photos/auto`, files, undefined, onProgress),
    deletePhoto: (id: string) => req<void>('DELETE', `/api/day-note-photos/${id}`),
  },

  settings: {
    get: (key: string) => req<{ value: string | null }>('GET', `/api/settings/${key}`).then((r) => r.value),
    set: (key: string, value: string) => req<void>('PUT', `/api/settings/${key}`, { value }),
  },

  dashboard: {
    get: () => req<DashboardData>('GET', '/api/dashboard'),
  },

  directions: {
    duration: (originPlaceId: string, destPlaceId: string, mode: string) =>
      req<{ durationText: string } | { error: string }>(
        'GET',
        `/api/directions/duration?originPlaceId=${encodeURIComponent(originPlaceId)}&destPlaceId=${encodeURIComponent(destPlaceId)}&mode=${encodeURIComponent(mode)}`,
      ),
  },

  activity: {
    list: (limit = 20) => req<ActivityLogEntry[]>('GET', `/api/activity?limit=${limit}`),
  },
}
