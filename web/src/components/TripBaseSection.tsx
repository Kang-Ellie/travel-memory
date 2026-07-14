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
import Window from "./Window";
import Modal from "./Modal";
import Select from "./Select";
import ChecklistPanel from "./ChecklistPanel";
import DropdownMenu from "./DropdownMenu";
import InfoCardGrid from "./InfoCardGrid";

const KIND_PLACEHOLDER: Record<BucketKind, string> = {
  bucket: "해보고 싶은 것",
  food: "먹어보고 싶은 것 (예: 멘타이코 정식)",
  wish: "사고 싶은 것 (예: 캐리어)",
};

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
      <div className="card place-card" onClick={() => setOpen(true)}>
        {coverPhoto && (
          <img
            className="place-card-photo"
            src={fileUrl(coverPhoto)}
            alt=""
            style={{ opacity: item.done ? 0.5 : 1 }}
          />
        )}
        <div className="place-card-body">
          <span
            className={`chip ${item.done ? "green" : "yellow"}`}
            style={{ alignSelf: "flex-start" }}
          >
            {item.done ? "✅ 완료" : "⏳ 미완료"}
          </span>
          <div
            style={{
              fontWeight: 800,
              textDecoration: item.done ? "line-through" : undefined,
            }}
          >
            {item.title}
          </div>
        </div>
      </div>
      {open && (
        <Modal title={item.title} onClose={() => setOpen(false)}>
          <input
            ref={photoInput}
            type="file"
            accept="image/*"
            hidden
            onChange={onPhotoPicked}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginBottom: 10,
            }}
          >
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
          </div>
          {coverPhoto && (
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
          )}
          {item.memo && (
            <p style={{ whiteSpace: "pre-wrap", marginTop: 0 }}>{item.memo}</p>
          )}
          {linkedPlace && (
            <div className="muted" style={{ marginBottom: 12 }}>
              {placeLine()}
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
  const [newTitle, setNewTitle] = useState<Record<BucketKind, string>>({
    bucket: "",
    food: "",
    wish: "",
  });

  const refresh = () => {
    api.countries.list().then(setCountries);
    api.cities.list().then(setCities);
    api.bucket.list().then(setBucket);
    api.places.list().then(setPlaces);
  };
  useEffect(refresh, [trip.id]);

  if (trip.cities.length === 0) {
    return (
      <Window title="BASE.EXE" color="blue">
        <span style={{ color: "var(--ink)", opacity: 0.7 }}>
          🌍 국가·도시가 아직 연결 안 됐어요 — 상단 "✏️ 여행 정보 수정"에서
          어디로 가는지 먼저 등록해주세요.
        </span>
      </Window>
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

  const addQuick = async (kind: BucketKind) => {
    const title = newTitle[kind].trim();
    if (!title) return;
    await api.bucket.create({
      title,
      memo: null,
      countryIds: [...countryIds],
      cityIds: [],
      category: BUCKET_KIND_CATEGORY[kind],
      linkedTripId: trip.id,
    });
    setNewTitle((prev) => ({ ...prev, [kind]: "" }));
    refresh();
  };

  return (
    <Window title="BASE.EXE" color="blue">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: collapsed ? 0 : 10,
        }}
      >
        <strong className="grow">🧭 이번엔 어디?</strong>
        <button
          className="btn small ghost"
          onClick={() => setCollapsed((v) => !v)}
        >
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
                  <>
                    <div className="boarding-pass-divider" style={{ margin: "0 16px" }} />
                    <div className="city-tile-grid">
                      {citiesWithInfo.map((c) => (
                        <div key={c.id} className="city-tile">
                          <div style={{ fontWeight: 800, fontSize: 13 }}>🇰🇷→{c.name}</div>
                          {c.flightDuration && (
                            <div className="muted" style={{ fontSize: 11 }}>
                              ✈️ {c.flightDuration}{c.flightAirport ? ` · ${c.flightAirport}` : ""}
                            </div>
                          )}
                          {c.timeDiff && <div className="muted" style={{ fontSize: 11 }}>🕐 {c.timeDiff}</div>}
                          {c.caution && <div className="muted" style={{ fontSize: 11 }}>⚠️ {c.caution}</div>}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
          </div>

          <div style={{ marginTop: 14 }}>
            <strong style={{ fontSize: 15 }}>✅ 체크리스트</strong>
            <div className="prep-split" style={{ marginTop: 10 }}>
              <ChecklistPanel
                tripId={trip.id}
                scope="predeparture"
                title="🛫 여행 전 Todo"
                addPlaceholder="예: 여행자보험 가입"
              />
              <ChecklistPanel
                tripId={trip.id}
                scope="packing"
                title="🎒 여행 준비물"
                addPlaceholder="예: 여권, 충전기"
              />
            </div>
          </div>

          {(["bucket", "food", "wish"] as BucketKind[]).map((kind) => {
            const items = byKind(kind);
            return (
              <div
                key={kind}
                style={{
                  marginTop: 14,
                  paddingTop: 14,
                  borderTop: "1.5px solid rgba(45,42,62,0.15)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 10,
                  }}
                >
                  <strong className="grow">{BUCKET_KIND_LABEL[kind]}</strong>
                  <input
                    type="text"
                    value={newTitle[kind]}
                    placeholder={KIND_PLACEHOLDER[kind]}
                    style={{ width: 200 }}
                    onChange={(e) =>
                      setNewTitle((prev) => ({
                        ...prev,
                        [kind]: e.target.value,
                      }))
                    }
                    onKeyDown={(e) => e.key === "Enter" && addQuick(kind)}
                  />
                  <button
                    className="btn small ghost"
                    onClick={() => addQuick(kind)}
                  >
                    ＋
                  </button>
                </div>
                {items.length === 0 ? (
                  <div className="empty">
                    {KIND_PLACEHOLDER[kind]} — 아직 등록된 항목이 없어요.
                  </div>
                ) : (
                  <div className="city-grid">
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
        </>
      )}
    </Window>
  );
}
