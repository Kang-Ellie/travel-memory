// TanStack Query 공용 훅. 화면마다 따로 useState+useEffect로 같은 엔드포인트를 반복
// 호출하던 걸(예: countries/cities가 6곳에서 각자 fetch) 쿼리 키로 캐시를 공유하게 만들고,
// 변경 후에는 영향받는 쿼리만 무효화해서 "뭐 하나 바뀌었다고 전부 다시 불러오는" 낭비를 없앤다.
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { api } from './api'
import type { ChecklistScope } from '../shared/types'

export const queryKeys = {
  trips: ['trips'] as const,
  countries: ['countries'] as const,
  cities: ['cities'] as const,
  cityPlaces: (cityId: string) => ['cityPlaces', cityId] as const,
  members: ['members'] as const,
  tripMembers: (tripId: string) => ['tripMembers', tripId] as const,
  places: ['places'] as const,
  placeDetail: (placeId: string) => ['placeDetail', placeId] as const,
  events: (tripId: string) => ['events', tripId] as const,
  transit: (tripId: string) => ['transit', tripId] as const,
  expenses: (tripId: string) => ['expenses', tripId] as const,
  rates: (tripId: string) => ['rates', tripId] as const,
  vouchers: (tripId: string) => ['vouchers', tripId] as const,
  bucket: ['bucket'] as const,
  checklist: (tripId: string, scope: ChecklistScope, dayNumber?: number) =>
    ['checklist', tripId, scope, dayNumber ?? null] as const,
  archive: (tripId: string) => ['archive', tripId] as const,
  archiveGlobal: ['archive', 'global'] as const,
  dayNotes: (tripId: string) => ['dayNotes', tripId] as const,
  dashboard: ['dashboard'] as const,
  activity: (limit: number) => ['activity', limit] as const,
}

export function useTrips() {
  return useQuery({ queryKey: queryKeys.trips, queryFn: api.trips.list })
}

export function useCountries() {
  return useQuery({ queryKey: queryKeys.countries, queryFn: api.countries.list })
}

export function useCities() {
  return useQuery({ queryKey: queryKeys.cities, queryFn: api.cities.list })
}

export function useCityPlaces(cityId: string) {
  return useQuery({ queryKey: queryKeys.cityPlaces(cityId), queryFn: () => api.cities.places(cityId) })
}

export function useMembers() {
  return useQuery({ queryKey: queryKeys.members, queryFn: api.members.list })
}

export function useTripMembers(tripId: string) {
  return useQuery({ queryKey: queryKeys.tripMembers(tripId), queryFn: () => api.tripMembers.list(tripId) })
}

export function usePlaces() {
  return useQuery({ queryKey: queryKeys.places, queryFn: api.places.list })
}

export function usePlaceDetail(placeId: string) {
  return useQuery({ queryKey: queryKeys.placeDetail(placeId), queryFn: () => api.places.detail(placeId) })
}

export function useEvents(tripId: string) {
  return useQuery({ queryKey: queryKeys.events(tripId), queryFn: () => api.events.list(tripId) })
}

export function useTransit(tripId: string) {
  return useQuery({ queryKey: queryKeys.transit(tripId), queryFn: () => api.transit.list(tripId) })
}

export function useExpenses(tripId: string) {
  return useQuery({ queryKey: queryKeys.expenses(tripId), queryFn: () => api.expenses.list(tripId) })
}

export function useRates(tripId: string) {
  return useQuery({ queryKey: queryKeys.rates(tripId), queryFn: () => api.rates.list(tripId) })
}

export function useVouchers(tripId: string) {
  return useQuery({ queryKey: queryKeys.vouchers(tripId), queryFn: () => api.vouchers.list(tripId) })
}

export function useBucket() {
  return useQuery({ queryKey: queryKeys.bucket, queryFn: api.bucket.list })
}

export function useChecklist(tripId: string, scope: ChecklistScope, dayNumber?: number) {
  return useQuery({
    queryKey: queryKeys.checklist(tripId, scope, dayNumber),
    queryFn: () => api.checklist.list(tripId, scope, dayNumber),
  })
}

export function useArchive(tripId: string) {
  return useQuery({ queryKey: queryKeys.archive(tripId), queryFn: () => api.archive.list(tripId) })
}

export function useArchiveGlobal() {
  return useQuery({ queryKey: queryKeys.archiveGlobal, queryFn: api.archive.listGlobal })
}

export function useDayNotes(tripId: string) {
  return useQuery({ queryKey: queryKeys.dayNotes(tripId), queryFn: () => api.dayNotes.list(tripId) })
}

export function useDashboard() {
  return useQuery({ queryKey: queryKeys.dashboard, queryFn: api.dashboard.get })
}

export function useActivity(limit = 20) {
  return useQuery({ queryKey: queryKeys.activity(limit), queryFn: () => api.activity.list(limit) })
}

// TripWorkspace처럼 한 여행 화면에서 리소스 여러 개를 한꺼번에 쓰는 곳을 위한 무효화 묶음.
// 이벤트 CRUD가 photos/flight/valet/lodging/reservation을 전부 events 안에 내려주므로
// (attachEventDetails), 사진·티켓 관련 변경은 전부 'events'만 무효화하면 된다.
export function invalidateTripScope(queryClient: QueryClient, tripId: string) {
  return {
    events: () => queryClient.invalidateQueries({ queryKey: queryKeys.events(tripId) }),
    transit: () => queryClient.invalidateQueries({ queryKey: queryKeys.transit(tripId) }),
    expenses: () => queryClient.invalidateQueries({ queryKey: queryKeys.expenses(tripId) }),
    rates: () => queryClient.invalidateQueries({ queryKey: queryKeys.rates(tripId) }),
    vouchers: () => queryClient.invalidateQueries({ queryKey: queryKeys.vouchers(tripId) }),
    bucket: () => queryClient.invalidateQueries({ queryKey: queryKeys.bucket }),
    dayNotes: () => queryClient.invalidateQueries({ queryKey: queryKeys.dayNotes(tripId) }),
    members: () => queryClient.invalidateQueries({ queryKey: queryKeys.tripMembers(tripId) }),
    places: () => queryClient.invalidateQueries({ queryKey: queryKeys.places }),
    all: () => queryClient.invalidateQueries({ queryKey: ['events', tripId] })
      .then(() => queryClient.invalidateQueries({ queryKey: ['transit', tripId] }))
      .then(() => queryClient.invalidateQueries({ queryKey: ['expenses', tripId] }))
      .then(() => queryClient.invalidateQueries({ queryKey: ['rates', tripId] }))
      .then(() => queryClient.invalidateQueries({ queryKey: ['vouchers', tripId] }))
      .then(() => queryClient.invalidateQueries({ queryKey: queryKeys.bucket }))
      .then(() => queryClient.invalidateQueries({ queryKey: ['dayNotes', tripId] }))
      .then(() => queryClient.invalidateQueries({ queryKey: queryKeys.tripMembers(tripId) }))
      .then(() => queryClient.invalidateQueries({ queryKey: queryKeys.places })),
  }
}

export { useQueryClient }
