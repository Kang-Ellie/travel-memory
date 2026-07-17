import { useState } from "react";
import type {
  Trip,
  City,
  BucketKind,
} from "../../shared/types";
import { BUCKET_KIND_LABEL, BUCKET_KIND_CATEGORY, bucketKindOf } from "../../shared/types";
import { api } from "../api";
import { useCountries, useCities, useBucket, useTrips, usePlaces, useQueryClient, queryKeys } from "../queries";
import { flagEmoji } from "../categories";
import Modal from "./Modal";
import Select from "./Select";
import InfoCardGrid from "./InfoCardGrid";
import BucketCard from "./BucketCard";

const KIND_PLACEHOLDER: Record<BucketKind, string> = {
  bucket: "해보고 싶은 것",
  food: "먹어보고 싶은 것 (예: 멘타이코 정식)",
  wish: "사고 싶은 것 (예: 캐리어)",
};

const KIND_ENG: Record<BucketKind, string> = { bucket: "BUCKET LIST", food: "FOOD LIST", wish: "WISH LIST" };

export default function TripBaseSection({ trip }: { trip: Trip }) {
  const { data: countries = [] } = useCountries();
  const { data: cities = [] } = useCities();
  const { data: bucket = [] } = useBucket();
  const { data: places = [] } = usePlaces();
  const { data: trips = [] } = useTrips();
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.bucket });
  const [collapsed, setCollapsed] = useState(false);
  const [addingKind, setAddingKind] = useState<BucketKind | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [addCountryId, setAddCountryId] = useState("");
  const [addCityId, setAddCityId] = useState("");

  if (trip.cities.length === 0) {
    return (
      <div className="empty">
        🌍 국가·도시가 아직 연결 안 됐어요 — 상단 "⚙️ 수정"에서 어디로 가는지 먼저 등록해주세요.
      </div>
    );
  }

  const tripCityRecords = trip.cities
    .map((tc) => cities.find((c) => c.id === tc.id))
    .filter((c): c is City => !!c);
  const countryIds = new Set(tripCityRecords.map((c) => c.countryId));
  const tripCountries = countries.filter((c) => countryIds.has(c.id));
  const itemsForBase = bucket.filter(
    (b) =>
      b.countryIds.some((id) => countryIds.has(id)) ||
      b.linkedTripId === trip.id,
  );
  const byKind = (kind: BucketKind) =>
    itemsForBase.filter((b) => bucketKindOf(b.category) === kind);

  const addQuick = async () => {
    const kind = addingKind;
    const title = newTitle.trim();
    if (!kind || !title) return;
    await api.bucket.create({
      title,
      memo: null,
      countryIds: addCountryId ? [addCountryId] : [...countryIds],
      cityIds: addCityId ? [addCityId] : [],
      category: BUCKET_KIND_CATEGORY[kind],
      linkedTripId: trip.id,
    });
    setNewTitle("");
    setAddingKind(null);
    refresh();
  };

  return (
    <div>
      <div className="base-where-head" style={{ marginBottom: collapsed ? 0 : 12 }}>
        <div className="base-where-title">
          <strong>🧭 이번엔 어디?</strong>
        </div>
        <button className="btn small ghost" onClick={() => setCollapsed((v) => !v)}>
          {collapsed ? "펼치기" : "접기"}
        </button>
      </div>
      {!collapsed && (
        <>
          <div className="trip-ticket-grid">
          {tripCountries.map((co) => {
            const citiesOfCountry = tripCityRecords.filter(
              (c) => c.countryId === co.id,
            );
            const citiesWithInfo = citiesOfCountry.filter(
              (c) => c.flightDuration || c.timeDiff || c.caution,
            );
            return (
              <div
                key={co.id}
                className="boarding-pass"
              >
                <div className="boarding-pass-head">
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <span style={{ fontSize: 20 }}>{flagEmoji(co.code)}</span>
                    <span style={{ fontWeight: 800 }}>{co.name}</span>
                  </div>
                  {citiesOfCountry.length > 0 && (
                    <div style={{ textAlign: "right" }}>
                      <div
                        className="muted"
                        style={{ fontSize: 10, letterSpacing: "0.06em" }}
                      >
                        CITIES
                      </div>
                      <div style={{ fontWeight: 800 }}>
                        {citiesOfCountry.map((c) => c.name).join(", ")}
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ padding: "14px 16px" }}>
                  <InfoCardGrid
                    items={[
                      { icon: "🏛", label: "수도", value: co.capital },
                      { icon: "🛂", label: "비자", value: co.visa },
                      { icon: "🗣", label: "언어", value: co.language },
                      { icon: "💴", label: "통화", value: co.currency },
                      { icon: "☎️", label: "국가번호", value: co.phoneCode },
                      { icon: "🔌", label: "전압", value: co.voltage },
                      { icon: "💰", label: "팁", value: co.tip },
                      { icon: "📈", label: "물가", value: co.priceLevel },
                      { icon: "🚓", label: "경찰", value: co.emergencyPolice, emphasis: true },
                      { icon: "🚑", label: "응급", value: co.emergencyMedical, emphasis: true },
                      { icon: "📋", label: "준비서류", value: co.prepDocs },
                    ]}
                  />
                  {co.prepDocsUrl && (
                    <a
                      className="btn small ghost"
                      href={co.prepDocsUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{ marginTop: 10 }}
                    >
                      🔗 준비서류 온라인 신청
                    </a>
                  )}
                </div>

                {citiesWithInfo.length > 0 && (
                  <div style={{ padding: "0 16px 16px" }}>
                    {/* 공항 출발 전광판(FIDS) — 도시별 항공시간·시차·경유를 다크 보드로 */}
                    <div className="fids-board">
                      <div className="fids-title">
                        <span>DEPARTURES</span>
                        <span>KOREA → {co.name}</span>
                      </div>
                      <div className="fids-row head">
                        <span>DESTINATION</span>
                        <span>FLIGHT</span>
                        <span>TIME DIFF</span>
                        <span>VIA / REMARK</span>
                      </div>
                      {citiesWithInfo.map((c) => (
                        <div key={c.id} className="fids-row">
                          <span className="fids-dest">{c.name}</span>
                          <span>{c.flightDuration ?? "—"}</span>
                          <span>{c.timeDiff ?? "—"}</span>
                          <span className="fids-remark">
                            {[c.flightAirport, c.flightType].filter(Boolean).join(" · ") || "—"}
                            {c.caution ? ` ⚠ ${c.caution}` : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          </div>

          {/* 버킷·먹킷·위시 — 세로로 길게 쌓지 않고 3열 컬럼으로 나란히.
              체크리스트는 [🎒 여행 준비] 탭으로 이사했다 (준비는 준비 탭에). */}
          <div className="base-lists">
          {(["bucket", "food", "wish"] as BucketKind[]).map((kind) => {
            const items = byKind(kind);
            return (
              <div key={kind} className={`base-list-col ${kind}`}>
                <div className="base-list-eng">{KIND_ENG[kind]}</div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 10,
                  }}
                >
                  <strong>{BUCKET_KIND_LABEL[kind]}</strong>
                  {items.length > 0 && (
                    <span className={`chip ${items.every((b) => b.done) ? "green" : "yellow"}`}>
                      {items.every((b) => b.done) && (
                        <img src="/할일목록 v.png" alt="" className="done-check-icon" />
                      )}
                      {items.filter((b) => b.done).length}/{items.length}
                    </span>
                  )}
                  <span className="grow" />
                  <button
                    className="btn small ghost"
                    onClick={() => {
                      setNewTitle("");
                      setAddCountryId(tripCountries[0]?.id ?? "");
                      setAddCityId("");
                      setAddingKind(kind);
                    }}
                  >
                    ＋ 추가
                  </button>
                </div>
                {items.length === 0 ? (
                  <div className="muted" style={{ textAlign: "center", padding: "18px 4px" }}>
                    {KIND_PLACEHOLDER[kind]}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {items.map((b) => (
                      <BucketCard
                        key={b.id}
                        item={b}
                        trips={trips}
                        places={places}
                        countries={countries}
                        cities={cities}
                        onChanged={refresh}
                        tripContext={{ tripId: trip.id }}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          </div>

          {addingKind && (
            <Modal
              title={`${BUCKET_KIND_LABEL[addingKind]} 추가`}
              onClose={() => setAddingKind(null)}
            >
              <div className="field grow">
                <label>{BUCKET_KIND_LABEL[addingKind]}</label>
                <input
                  type="text"
                  value={newTitle}
                  placeholder={KIND_PLACEHOLDER[addingKind]}
                  autoFocus
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addQuick()}
                />
              </div>
              {tripCountries.length > 1 && (
                <div className="field" style={{ marginTop: 12 }}>
                  <label>🌍 어느 나라예요?</label>
                  <Select
                    value={addCountryId}
                    onChange={(e) => { setAddCountryId(e.target.value); setAddCityId(""); }}
                  >
                    {tripCountries.map((co) => (
                      <option key={co.id} value={co.id}>{flagEmoji(co.code)} {co.name}</option>
                    ))}
                  </Select>
                </div>
              )}
              {(() => {
                const citiesOfSelCountry = tripCityRecords.filter((c) => c.countryId === addCountryId);
                if (citiesOfSelCountry.length <= 1) return null;
                return (
                  <div className="field" style={{ marginTop: 12 }}>
                    <label>📍 어느 도시예요? (선택)</label>
                    <Select value={addCityId} onChange={(e) => setAddCityId(e.target.value)}>
                      <option value="">전체</option>
                      {citiesOfSelCountry.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </Select>
                  </div>
                );
              })()}
              <div style={{ marginTop: 12 }}>
                <button className="btn primary" onClick={addQuick}>
                  ＋ 추가
                </button>
              </div>
            </Modal>
          )}
        </>
      )}
    </div>
  );
}
