import { useEffect, useRef, useState } from "react";
import type {
  Trip,
  Country,
  City,
  BucketItem,
  Place,
  BucketKind,
} from "../../shared/types";
import { BUCKET_KIND_LABEL, BUCKET_KIND_CATEGORY, bucketKindOf } from "../../shared/types";
import { api, fileUrl } from "../api";
import { flagEmoji } from "../categories";
import Modal from "./Modal";
import Select from "./Select";
import DropdownMenu from "./DropdownMenu";
import InfoCardGrid from "./InfoCardGrid";

const KIND_PLACEHOLDER: Record<BucketKind, string> = {
  bucket: "해보고 싶은 것",
  food: "먹어보고 싶은 것 (예: 멘타이코 정식)",
  wish: "사고 싶은 것 (예: 캐리어)",
};

const KIND_EMOJI: Record<BucketKind, string> = { bucket: "🪣", food: "🍽", wish: "🛍" };
const KIND_ENG: Record<BucketKind, string> = { bucket: "BUCKET LIST", food: "FOOD LIST", wish: "WISH LIST" };

function BaseListCard({
  item,
  kind,
  places,
  tripId,
  onChanged,
}: {
  item: BucketItem;
  kind: BucketKind;
  places: Place[];
  tripId: string;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [linkingPlace, setLinkingPlace] = useState(false);
  const [placeId, setPlaceId] = useState("");
  const photoInput = useRef<HTMLInputElement>(null);
  const linkedPlace = item.linkedPlaceId
    ? places.find((p) => p.id === item.linkedPlaceId)
    : undefined;
  const inTrip = item.linkedTripId === tripId;
  const coverPhoto = item.imagePath ?? linkedPlace?.coverPhoto ?? null;

  const toggleDone = async () => {
    await api.bucket.update(item.id, { done: !item.done });
    onChanged();
  };
  const addToTrip = async () => {
    await api.bucket.update(item.id, { linkedTripId: tripId });
    onChanged();
  };
  const linkPlace = async () => {
    if (!placeId) return;
    await api.bucket.update(item.id, { linkedPlaceId: placeId });
    setLinkingPlace(false);
    onChanged();
  };
  const unlinkPlace = async () => {
    await api.bucket.update(item.id, { linkedPlaceId: null });
    onChanged();
  };
  const onPhotoPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await api.bucket.uploadPhoto(item.id, file);
    if (!item.done) await api.bucket.update(item.id, { done: true });
    onChanged();
  };
  const removePhoto = async () => {
    await api.bucket.deletePhoto(item.id);
    onChanged();
  };

  const placeLine = () => {
    if (!linkedPlace) return null;
    if (kind === "food") {
      return (
        <>
          📍 {linkedPlace.name}
          {linkedPlace.recommendedMenu
            ? ` · 여기서 ${linkedPlace.recommendedMenu} 잘해요`
            : ""}
        </>
      );
    }
    if (kind === "wish") return <>🛍 여기서 살 수 있어요: {linkedPlace.name}</>;
    return <>📍 {linkedPlace.name}</>;
  };

  return (
    <>
      <div className={`card bucket-row ${item.done ? "done" : ""}`} onClick={() => setOpen(true)}>
        <button
          type="button"
          className="check-stamp"
          onClick={(e) => { e.stopPropagation(); toggleDone(); }}
          title={item.done ? "미완료로 표시" : "완료로 표시"}
        >
          <span className="mark">DONE</span>
        </button>
        {coverPhoto && <img className="bucket-row-thumb" src={fileUrl(coverPhoto)} alt="" />}
        <div className="grow" style={{ minWidth: 0 }}>
          <div
            style={{
              fontWeight: 800,
              textDecoration: item.done ? "line-through" : undefined,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {item.title}
          </div>
          {linkedPlace && (
            <div className="muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {placeLine()}
            </div>
          )}
        </div>
      </div>
      {open && (
        <Modal
          title={`${KIND_EMOJI[kind]} ${item.title}`}
          onClose={() => setOpen(false)}
          headerActions={
            <DropdownMenu
              actions={[
                {
                  label: item.done ? "🔲 미완료로 표시" : "✅ 완료로 표시",
                  onClick: toggleDone,
                },
                {
                  label: item.imagePath ? "📷 사진 변경" : "📷 사진 추가",
                  onClick: () => photoInput.current?.click(),
                },
                ...(item.imagePath
                  ? ([
                      {
                        label: "🗑 사진 삭제",
                        danger: true,
                        onClick: removePhoto,
                      },
                    ] as const)
                  : []),
                "divider" as const,
                ...(linkedPlace
                  ? ([
                      { label: "장소 연결 해제", onClick: unlinkPlace },
                    ] as const)
                  : ([
                      {
                        label: "📍 장소 족보와 연결",
                        onClick: () => setLinkingPlace(true),
                      },
                    ] as const)),
                ...(!inTrip
                  ? ([
                      { label: "＋ 이 여행에 담기", onClick: addToTrip },
                    ] as const)
                  : []),
              ]}
            />
          }
        >
          <input
            ref={photoInput}
            type="file"
            accept="image/*"
            hidden
            onChange={onPhotoPicked}
          />
          {coverPhoto ? (
            <img
              src={fileUrl(coverPhoto)}
              alt=""
              style={{
                width: "100%",
                borderRadius: 10,
                marginBottom: 12,
                display: "block",
              }}
            />
          ) : (
            <button
              type="button"
              className="diary-cover-empty"
              style={{ borderRadius: 10, marginBottom: 12 }}
              onClick={() => photoInput.current?.click()}
            >
              📷 사진 추가
            </button>
          )}
          {item.memo && (
            <p style={{ whiteSpace: "pre-wrap", marginTop: 0 }}>{item.memo}</p>
          )}
          {linkedPlace ? (
            <div className="muted" style={{ marginBottom: 12 }}>
              {placeLine()}
            </div>
          ) : (
            <div className="muted" style={{ marginBottom: 12 }}>
              오른쪽 위 메뉴(⋮)에서 장소 족보와 연결해두면, 어디서 하는지가 여기 붙어요.
            </div>
          )}
          {linkingPlace && (
            <div className="row" style={{ border: "none", padding: 0 }}>
              <Select
                value={placeId}
                onChange={(e) => setPlaceId(e.target.value)}
              >
                <option value="">— 장소 선택 —</option>
                {places.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.category}] {p.name}
                  </option>
                ))}
              </Select>
              <button className="btn small primary" onClick={linkPlace}>
                연결
              </button>
              <button
                className="btn small"
                onClick={() => setLinkingPlace(false)}
              >
                취소
              </button>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}

export default function TripBaseSection({ trip }: { trip: Trip }) {
  const [countries, setCountries] = useState<Country[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [bucket, setBucket] = useState<BucketItem[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [addingKind, setAddingKind] = useState<BucketKind | null>(null);
  const [newTitle, setNewTitle] = useState("");

  const refresh = () => {
    api.countries.list().then(setCountries);
    api.cities.list().then(setCities);
    api.bucket.list().then(setBucket);
    api.places.list().then(setPlaces);
  };
  useEffect(refresh, [trip.id]);

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
      countryIds: [...countryIds],
      cityIds: [],
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
          <div className="base-where-dests">
            {tripCityRecords.map((c) => {
              const co = countries.find((x) => x.id === c.countryId);
              return (
                <span key={c.id} className="base-where-chip">
                  {flagEmoji(co?.code)} {c.name}
                </span>
              );
            })}
          </div>
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
                    ]}
                  />
                  {(co.prepDocs || co.prepDocsUrl) && (
                    <div
                      style={{
                        fontSize: 12,
                        marginTop: 12,
                        fontWeight: 800,
                        color: "var(--ink)",
                        background: "var(--yellow-soft)",
                        border: "1.5px solid var(--ink)",
                        borderRadius: 10,
                        padding: "8px 10px",
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span>📋 준비서류 : {co.prepDocs || "—"}</span>
                      {co.prepDocsUrl && (
                        <a className="btn small primary" href={co.prepDocsUrl} target="_blank" rel="noreferrer">
                          🔗 온라인 신청
                        </a>
                      )}
                    </div>
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
                      <BaseListCard
                        key={b.id}
                        item={b}
                        kind={kind}
                        places={places}
                        tripId={trip.id}
                        onChanged={refresh}
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
