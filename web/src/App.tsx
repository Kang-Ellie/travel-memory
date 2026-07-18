import { useEffect, useMemo, useState } from "react";
import type { Trip } from "../shared/types";
import { auth } from "./api";
import { flagEmoji } from "./categories";
import { useCountries, useCities } from "./queries";
import { toast } from "./toast";
import ToastHost from "./components/ToastHost";
import Login from "./Login";
import DashboardScreen from "./components/DashboardScreen";
import TripsScreen from "./components/TripsScreen";
import TripWindow, { type TripTab } from "./components/TripWindow";
import BookmarksScreen, { type BookmarkSection } from "./components/BookmarksScreen";
import CountriesScreen from "./components/CountriesScreen";
import MembersScreen from "./components/MembersScreen";
import SettingsScreen from "./components/SettingsScreen";
import SearchPalette, { type QuickAddTarget } from "./components/SearchPalette";

type Screen =
  | "dashboard"
  | "trips"
  | "bookmarks"
  | "countries"
  | "members"
  | "settings";

const NAV: Array<{ key: Screen; icon: string; label: string; eng: string }> = [
  { key: "dashboard", icon: "🏠", label: "대시보드", eng: "HOME" },
  { key: "trips", icon: "🏝", label: "여행", eng: "TRIPS" },
  { key: "bookmarks", icon: "📚", label: "북마크", eng: "BOOKMARKS" },
  { key: "countries", icon: "🌍", label: "국가 도감", eng: "ATLAS" },
  { key: "members", icon: "👥", label: "동행인", eng: "PEOPLE" },
];

const SETTINGS_NAV = { key: "settings" as const, icon: "⚙️", label: "설정", eng: "SETTINGS" };

export interface SharePrefill {
  title: string;
  url: string;
}

// 안드로이드 PWA 공유 대상(share_target)으로 들어온 요청에서 링크·제목을 뽑아낸다.
// 인스타 등은 링크를 url이 아니라 text에 실어 보내는 경우가 많아 text에서도 URL을 찾는다.
function extractSharePrefill(): SharePrefill | null {
  if (window.location.pathname !== "/share-target") return null;
  const params = new URLSearchParams(window.location.search);
  const rawTitle = (params.get("title") ?? "").trim();
  const rawText = (params.get("text") ?? "").trim();
  const rawUrl = (params.get("url") ?? "").trim();
  const urlMatch = `${rawUrl} ${rawText} ${rawTitle}`.match(/https?:\/\/\S+/);
  const url = /^https?:\/\//.test(rawUrl)
    ? rawUrl
    : urlMatch
      ? urlMatch[0]
      : "";
  if (!url) return null;
  const title = rawTitle || rawText.replace(url, "").trim();
  return { title, url };
}

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [openTrip, setOpenTrip] = useState<Trip | null>(null);
  const [openTripTab, setOpenTripTab] = useState<TripTab | undefined>(undefined);
  const [sharePrefill, setSharePrefill] = useState<SharePrefill | null>(null);
  const { data: countries = [] } = useCountries();
  const { data: cities = [] } = useCities();
  const [bookmarkSection, setBookmarkSection] = useState<BookmarkSection>("places");
  const [showSearch, setShowSearch] = useState(false);
  const [quickAdd, setQuickAdd] = useState<QuickAddTarget | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowSearch(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    auth
      .session()
      .then((r) => setAuthed(r.authed))
      .catch(() => {
        // 세션 확인 요청 자체가 안 될 때(오프라인 등)는 로그아웃시키지 않고 일단 로그인된
        // 것으로 보고 캐시된 화면을 보여준다 — 실제로 세션이 끊겼다면 이후 어떤 요청에서든
        // 401을 받으면 그때 app:unauthorized로 로그인 화면으로 전환된다.
        setAuthed(true);
      });
    const prefill = extractSharePrefill();
    if (prefill) {
      setSharePrefill(prefill);
      setScreen("bookmarks");
      window.history.replaceState(null, "", "/");
    }
  }, []);

  // 세션 만료 후 아무 버튼이나 누르면 요청만 조용히 실패하던 문제 — api.ts가 401을 감지하면
  // 여기서 한 곳에서 로그인 화면으로 돌려보내고 이유를 토스트로 알려준다.
  useEffect(() => {
    const onUnauthorized = () => {
      setAuthed((prev) => {
        if (prev) toast.info("세션이 만료됐어요. 다시 로그인해주세요.");
        return false;
      });
    };
    window.addEventListener("app:unauthorized", onUnauthorized);
    return () => window.removeEventListener("app:unauthorized", onUnauthorized);
  }, []);

  // 오프라인 읽기 — 신호가 끊기면 배너로 알려주고(최근 본 화면은 sw.js 캐시로 계속 보임),
  // 다시 붙으면 토스트로 짧게 알려준다.
  useEffect(() => {
    const onOffline = () => setIsOffline(true);
    const onOnline = () => { setIsOffline(false); toast.success("다시 연결됐어요."); };
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  const visitedFlags = useMemo(() => {
    const visitedCountryIds = new Set(
      cities.filter((c) => c.visited).map((c) => c.countryId),
    );
    return countries
      .filter((c) => visitedCountryIds.has(c.id))
      .map((c) => flagEmoji(c.code));
  }, [countries, cities]);

  // 대시보드의 "오늘" 요약에서 바로 그 여행의 [일정] 탭으로 한 번에 들어가기 위한 헬퍼.
  const openTripAt = (t: Trip, tab?: TripTab) => {
    setOpenTrip(t);
    setOpenTripTab(tab);
  };

  const handleQuickAdd = (target: QuickAddTarget) => {
    setOpenTrip(null);
    if (target === "trip") setScreen("trips");
    else if (target === "bucket") { setScreen("bookmarks"); setBookmarkSection("bucket"); }
    else if (target === "place") { setScreen("bookmarks"); setBookmarkSection("places"); }
    else if (target === "country") setScreen("countries");
    else if (target === "member") setScreen("members");
    setQuickAdd(target);
  };

  if (authed === null) return null;
  if (!authed) return (
    <>
      <Login onSuccess={() => setAuthed(true)} />
      <ToastHost />
    </>
  );

  return (
    <div className="app">
      {isOffline && (
        <div className="offline-banner">📡 오프라인 상태예요 — 최근에 열어본 화면만 볼 수 있어요.</div>
      )}
      <div className="app-body">
        <nav className="nav sidebar-nav">
          <div className="sidebar-logo">
            <div className="passport-emblem">✈</div>
            <span className="sidebar-logo-kr">여 백 여 권</span>
            <span className="sidebar-logo-eng">YEOBAEK TRAVEL PASSPORT</span>
            <span className="sidebar-logo-sub">나를 채우는, 여백</span>
          </div>
          <button
            className="sidebar-nav-btn sidebar-search-btn"
            onClick={() => setShowSearch(true)}
          >
            <span className="sidebar-nav-icon">🔍</span>
            <span className="sidebar-nav-text">
              <span className="sidebar-nav-label">검색</span>
              <span className="sidebar-nav-eng">⌘K</span>
            </span>
          </button>
          {NAV.map((n) => (
            <button
              key={n.key}
              className={`sidebar-nav-btn ${screen === n.key && !openTrip ? "active" : ""}`}
              onClick={() => {
                setScreen(n.key);
                setOpenTrip(null);
              }}
            >
              <span className="sidebar-nav-icon">{n.icon}</span>
              <span className="sidebar-nav-text">
                <span className="sidebar-nav-label">{n.label}</span>
                <span className="sidebar-nav-eng">{n.eng}</span>
              </span>
            </button>
          ))}
          {visitedFlags.length > 0 && (
            <div className="sidebar-flags-row" title="내가 간 나라">
              {visitedFlags.map((f, i) => (
                <span key={i}>{f}</span>
              ))}
            </div>
          )}
          {openTrip && (
            <button className="sidebar-nav-btn active">
              <span className="sidebar-nav-icon">✈️</span>
              <span className="sidebar-nav-text">
                <span className="sidebar-nav-label">{openTrip.title}</span>
                <span className="sidebar-nav-eng">TRIP</span>
              </span>
            </button>
          )}
          <button
            className={`sidebar-nav-btn settings-btn ${screen === "settings" && !openTrip ? "active" : ""}`}
            onClick={() => {
              setScreen("settings");
              setOpenTrip(null);
            }}
          >
            <span className="sidebar-nav-icon">{SETTINGS_NAV.icon}</span>
            <span className="sidebar-nav-text">
              <span className="sidebar-nav-label">{SETTINGS_NAV.label}</span>
              <span className="sidebar-nav-eng">{SETTINGS_NAV.eng}</span>
            </span>
          </button>
          <button
            className="sidebar-nav-btn logout"
            onClick={() => auth.logout().then(() => setAuthed(false))}
          >
            <span className="sidebar-nav-icon">🚪</span>
            <span className="sidebar-nav-text">
              <span className="sidebar-nav-label">로그아웃</span>
              <span className="sidebar-nav-eng">LOGOUT</span>
            </span>
          </button>
          <div className="passport-chip" aria-hidden="true" />
        </nav>

        <main className="content">
          {openTrip ? (
            <TripWindow
              trip={openTrip}
              initialTab={openTripTab}
              onClose={() => { setOpenTrip(null); setOpenTripTab(undefined); }}
              onTripChanged={setOpenTrip}
            />
          ) : (
            <>
              {screen === "dashboard" && (
                <DashboardScreen onOpenTrip={openTripAt} />
              )}
              {screen === "trips" && (
                <TripsScreen
                  onOpenTrip={setOpenTrip}
                  autoOpenAdd={quickAdd === "trip"}
                  onConsumedAutoOpenAdd={() => setQuickAdd(null)}
                />
              )}
              {screen === "bookmarks" && (
                <BookmarksScreen
                  prefill={sharePrefill}
                  onConsumedPrefill={() => setSharePrefill(null)}
                  initialSection={bookmarkSection}
                  autoOpenAdd={quickAdd === "bucket" || quickAdd === "place"}
                  onConsumedAutoOpenAdd={() => setQuickAdd(null)}
                />
              )}
              {screen === "countries" && (
                <CountriesScreen
                  autoOpenAdd={quickAdd === "country"}
                  onConsumedAutoOpenAdd={() => setQuickAdd(null)}
                />
              )}
              {screen === "members" && (
                <MembersScreen
                  autoOpenAdd={quickAdd === "member"}
                  onConsumedAutoOpenAdd={() => setQuickAdd(null)}
                />
              )}
              {screen === "settings" && <SettingsScreen />}
            </>
          )}
        </main>
      </div>

      {showSearch && (
        <SearchPalette
          onClose={() => setShowSearch(false)}
          onOpenTrip={(t) => {
            setOpenTrip(t);
            setShowSearch(false);
          }}
          onNavigate={(nextScreen, section) => {
            setScreen(nextScreen);
            if (section) setBookmarkSection(section);
            setOpenTrip(null);
          }}
          onQuickAdd={handleQuickAdd}
        />
      )}
      <ToastHost />
    </div>
  );
}
