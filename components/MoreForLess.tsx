"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MMHeader } from "./MMHeader";
import { MobileTabBar } from "./MobileTabBar";
import { MMIcon } from "@/lib/icons";
import { usePersona } from "@/lib/usePersona";
import { DEFAULT_METRICS, METRICS, METRIC_IDS, type MetricId } from "@/lib/alternatives";
import { marketPrice, priceLabel, ROOM_LABEL, type Deal, type RoomKey, type SizePrices } from "@/lib/market";

export type HomeOption = { id: string; he: string; cityId: string; cityHe: string; rent: SizePrices; buy: SizePrices };

type Place = { label: string; lng: number; lat: number };

type Result = {
  id: string;
  he: string;
  citySlug: string;
  cityHe: string;
  price: number;
  saving: number;
  values: Record<MetricId, number | null>;
  deltas: Record<MetricId, number | null>;
  minutes: number | null;
};
type Response = {
  home: { he: string; cityHe: string; sourcePrice: number | null; minutes: number | null } | null;
  estimated: boolean;
  /** The measures this answer was ranked on. */
  metrics: MetricId[];
  considered: number;
  results: Result[];
};

/** Common workplaces, one tap each. Points are the middle of each area. */
const HUBS: Place[] = [
  { label: "תל אביב · עזריאלי", lng: 34.7915, lat: 32.0745 },
  { label: "תל אביב · רמת החייל", lng: 34.837, lat: 32.1095 },
  { label: "רמת גן · הבורסה", lng: 34.8035, lat: 32.084 },
  { label: "הרצליה פיתוח", lng: 34.8085, lat: 32.1625 },
  { label: "פתח תקווה · קריית אריה", lng: 34.859, lat: 32.101 },
  { label: "נתב״ג · איירפורט סיטי", lng: 34.906, lat: 31.99 },
  { label: "רחובות · פארק המדע", lng: 34.809, lat: 31.913 },
  { label: "ירושלים · הר חוצבים", lng: 35.213, lat: 31.805 },
  { label: "חיפה · מת״ם", lng: 34.959, lat: 32.788 },
  { label: "באר שבע · פארק ההייטק", lng: 34.812, lat: 31.264 },
];

const MINUTES = [20, 30, 45];
const METRIC_ICON: Record<MetricId, string> = { schools: "school", green: "tree", safety: "info", quiet: "leaf", kids: "kid" };
const METRIC_NOTE: Record<MetricId, string> = {
  schools: "ציוני מיצ״ב",
  green: "פארקים וצמחייה",
  safety: "נתוני משטרה",
  quiet: "רחוק מכבישים ראשיים",
  kids: "הרבה ילדים בשכונה",
};
const STORE_KEY = "mishpachamap.moreforless.v1";
const OTHER = "__other__";

export function MoreForLess({ options, mapboxToken }: { options: HomeOption[]; mapboxToken: string }) {
  const persona = usePersona();
  const [deal, setDeal] = useState<Deal>("rent");
  const [rooms, setRooms] = useState<RoomKey>("4");
  const [cityId, setCityId] = useState<string>("");
  const [homeId, setHomeId] = useState<string>("");
  const [price, setPrice] = useState<string>("");
  const [priceTouched, setPriceTouchedState] = useState(false);
  // Mirrored in a ref so the auto-fill effect below sees a value restored
  // earlier in the same effect pass (state would still read "untouched").
  const touchedRef = useRef(false);
  const setPriceTouched = (v: boolean) => {
    touchedRef.current = v;
    setPriceTouchedState(v);
  };
  const [work, setWork] = useState<Place | null>(null);
  const [maxMinutes, setMaxMinutes] = useState(30);
  const [metrics, setMetrics] = useState<MetricId[]>(DEFAULT_METRICS);
  const toggleMetric = (m: MetricId) =>
    setMetrics((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : METRIC_IDS.filter((x) => x === m || prev.includes(x))));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Response | null>(null);
  const [asked, setAsked] = useState<{ price: number; deal: Deal; rooms: RoomKey; work: Place; maxMinutes: number } | null>(null);
  const resultsRef = useRef<HTMLDivElement | null>(null);

  const cities = useMemo(() => {
    const seen = new Map<string, string>();
    for (const o of options) if (!seen.has(o.cityId)) seen.set(o.cityId, o.cityHe);
    return [...seen].map(([id, he]) => ({ id, he })).sort((a, b) => a.he.localeCompare(b.he, "he"));
  }, [options]);
  const hoods = useMemo(
    () => options.filter((o) => o.cityId === cityId).sort((a, b) => a.he.localeCompare(b.he, "he")),
    [options, cityId],
  );
  const home = hoods.find((o) => o.id === homeId) ?? null;
  const known = home ? marketPrice(home, deal, rooms) : null;

  // Start from the family profile, then from what they entered last time.
  useEffect(() => {
    setDeal(persona.deal);
    const r = Math.min(5, Math.max(3, persona.rooms.min));
    setRooms(String(r) as RoomKey);
  }, [persona.deal, persona.rooms.min]);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as Partial<{ cityId: string; homeId: string; price: string; work: Place; maxMinutes: number; deal: Deal; rooms: RoomKey; metrics: MetricId[] }>;
      if (s.deal) setDeal(s.deal);
      if (s.rooms) setRooms(s.rooms);
      if (s.cityId) setCityId(s.cityId);
      if (s.homeId) setHomeId(s.homeId);
      if (s.price) {
        setPrice(s.price);
        setPriceTouched(true);
      }
      if (s.work) setWork(s.work);
      if (s.maxMinutes) setMaxMinutes(s.maxMinutes);
      if (Array.isArray(s.metrics)) setMetrics(METRIC_IDS.filter((m) => s.metrics!.includes(m)));
    } catch {
      /* first visit, or storage unavailable */
    }
  }, []);

  // Until they type their own number, show the typical price for their choice.
  // (Only a typed number is saved between visits; the average is re-derived.)
  useEffect(() => {
    if (!touchedRef.current) setPrice(known != null ? String(known) : "");
  }, [known, priceTouched]);

  const priceNum = Number(price.replace(/[^\d]/g, ""));
  const ready = priceNum > 0 && work != null && cityId !== "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || !work) return;
    setLoading(true);
    setError(null);
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify({ cityId, homeId, price: priceTouched ? price : "", work, maxMinutes, deal, rooms, metrics }));
    } catch {
      /* not essential */
    }
    try {
      const res = await fetch("/api/alternatives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          homeId: home?.id,
          homeCityId: home?.cityId,
          deal,
          rooms,
          price: priceNum,
          work: { lng: work.lng, lat: work.lat },
          maxMinutes,
          metrics,
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setData((await res.json()) as Response);
      setAsked({ price: priceNum, deal, rooms, work, maxMinutes });
      requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch {
      setError("לא הצלחנו לחשב כרגע. נסו שוב בעוד רגע.");
    } finally {
      setLoading(false);
    }
  }

  const per = deal === "rent" ? " לחודש" : "";
  const [workEditing, setWorkEditing] = useState(false);
  const missing = [cityId === "" && "עיר", !(priceNum > 0) && "סכום", !work && "מקום עבודה"].filter(Boolean) as string[];

  return (
    <div className="mm-shell" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--hn-bg)" }}>
      <MMHeader activeNav="יותר בפחות" />
      <main className="mm-mfl">
        <header className="mm-mfl-hero">
          <h1>איפה נשלם פחות על אותה דירה?</h1>
          <p>ספרו איפה אתם גרים ואיפה אתם עובדים. נשווה מול כל השכונות ב-19 ערים.</p>
        </header>

        <form onSubmit={submit} className="mm-mfl-panel">
          <section className="mm-mfl-sec">
            <h2>הבית שלכם היום</h2>
            <div className="mm-sw" role="radiogroup" aria-label="שוכרים או קונים">
              {(["rent", "buy"] as Deal[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={deal === d}
                  onClick={() => {
                    setDeal(d);
                    setPriceTouched(false);
                  }}
                >
                  {d === "rent" ? "שוכרים" : "קונים"}
                </button>
              ))}
            </div>

            <div className="mm-mfl-two">
              <label className="mm-fld">
                <span>עיר</span>
                <select
                  value={cityId}
                  onChange={(e) => {
                    setCityId(e.target.value);
                    setHomeId("");
                    setPriceTouched(false);
                  }}
                >
                  <option value="">בחרו עיר</option>
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.he}
                    </option>
                  ))}
                  <option value={OTHER}>עיר אחרת</option>
                </select>
              </label>
              <label className="mm-fld">
                <span>שכונה</span>
                <select
                  value={homeId}
                  disabled={!cityId || cityId === OTHER}
                  onChange={(e) => {
                    setHomeId(e.target.value);
                    setPriceTouched(false);
                  }}
                >
                  <option value="">{cityId === OTHER ? "לא נדרש" : "בחרו שכונה"}</option>
                  {hoods.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.he}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mm-mfl-two">
              <div className="mm-fld">
                <span id="mm-mfl-rooms">חדרים</span>
                <div className="mm-sw" role="radiogroup" aria-labelledby="mm-mfl-rooms">
                  {(["3", "4", "5"] as RoomKey[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      role="radio"
                      aria-checked={rooms === k}
                      onClick={() => {
                        setRooms(k);
                        setPriceTouched(false);
                      }}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              </div>
              <label className="mm-fld">
                <span>{deal === "rent" ? "שכר דירה לחודש" : "מחיר הדירה"}</span>
                <div className="mm-fld-money">
                  <input
                    inputMode="numeric"
                    aria-describedby="mm-mfl-pricehint"
                    value={price ? Number(price.replace(/[^\d]/g, "")).toLocaleString("en-US") : ""}
                    placeholder={deal === "rent" ? "7,800" : "3,200,000"}
                    onChange={(e) => {
                      setPrice(e.target.value.replace(/[^\d]/g, ""));
                      setPriceTouched(true);
                    }}
                  />
                  <b aria-hidden>₪</b>
                </div>
              </label>
            </div>
            <p id="mm-mfl-pricehint" className="mm-mfl-hint">
              {known != null
                ? priceTouched && priceNum !== known
                  ? `הממוצע בשכונה לגודל הזה: ${priceLabel(known, deal)}${per}.`
                  : "מילאנו את הממוצע בשכונה. אפשר לתקן לסכום שלכם."
                : home
                  ? "אין לנו ממוצע לגודל הזה בשכונה, אז הקלידו את הסכום."
                  : "בחרו שכונה ונמלא את הממוצע שלה."}
            </p>
          </section>

          <section className="mm-mfl-sec">
            <h2>העבודה</h2>
            {work && !workEditing ? (
              <div className="mm-fld">
                <span>מקום העבודה</span>
                <div className="mm-fld-picked">
                  <MMIcon name="pin" size={16} />
                  <strong>{work.label}</strong>
                  <button type="button" onClick={() => setWorkEditing(true)}>
                    שינוי
                  </button>
                </div>
              </div>
            ) : (
              <WorkPicker
                token={mapboxToken}
                onPick={(p) => {
                  setWork(p);
                  setWorkEditing(false);
                }}
              />
            )}
            <div className="mm-fld">
              <span id="mm-mfl-min">זמן נסיעה מרבי ברכב</span>
              <div className="mm-sw" role="radiogroup" aria-labelledby="mm-mfl-min">
                {MINUTES.map((m) => (
                  <button key={m} type="button" role="radio" aria-checked={maxMinutes === m} onClick={() => setMaxMinutes(m)}>
                    {m} דק׳
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="mm-mfl-sec">
            <h2>מה חשוב לכם</h2>
            <div className="mm-mfl-opts" role="group" aria-label="מדדים להשוואה">
              {METRIC_IDS.map((m) => {
                const on = metrics.includes(m);
                return (
                  <button key={m} type="button" role="switch" aria-checked={on} className="mm-opt" onClick={() => toggleMetric(m)}>
                    <MMIcon name={METRIC_ICON[m]} size={18} />
                    <span>
                      {METRICS[m].label}
                      <small>{METRIC_NOTE[m]}</small>
                    </span>
                    <i aria-hidden />
                  </button>
                );
              })}
            </div>
          </section>

          <div className="mm-mfl-submit">
            <button type="submit" className="mm-mfl-cta" disabled={!ready || loading}>
              {loading ? "מחשבים…" : "חפשו שכונות"}
            </button>
            {missing.length > 0 && <p className="mm-mfl-hint">נשאר למלא: {missing.join(", ")}.</p>}
            {error && (
              <p role="alert" className="mm-mfl-hint" style={{ color: "var(--hn-negative)" }}>
                {error}
              </p>
            )}
          </div>
        </form>

        <div ref={resultsRef} style={{ scrollMarginTop: 16 }} aria-live="polite">
          {loading && !data && (
            <div className="mm-mfl-list" aria-hidden>
              {[0, 1, 2].map((i) => (
                <div key={i} className="mm-mfl-res mm-mfl-skel" />
              ))}
            </div>
          )}
          {data && asked && <Results data={data} asked={asked} />}
        </div>
      </main>
      <MobileTabBar />
    </div>
  );
}

function Results({
  data,
  asked,
}: {
  data: Response;
  asked: { price: number; deal: Deal; rooms: RoomKey; work: Place; maxMinutes: number };
}) {
  const { deal } = asked;
  const per = deal === "rent" ? " לחודש" : "";
  const size = ROOM_LABEL[asked.rooms];
  const n = data.results.length;
  const today = [
    data.home ? `${data.home.he}, ${data.home.cityHe}` : null,
    `${priceLabel(asked.price, deal)}${per}`,
    data.home?.minutes != null ? `${data.home.minutes} דק׳ לעבודה` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  if (n === 0) {
    return (
      <section className="mm-mfl-results">
        <h2>לא מצאנו שכונה זולה יותר בטווח הזה</h2>
        <p className="mm-mfl-today">
          עד {asked.maxMinutes} דקות מ{asked.work.label} אין אצלנו שכונה שבה {size} עולים פחות מ-{priceLabel(asked.price, deal)}
          {per}. נסו זמן נסיעה ארוך יותר או גודל דירה אחר.
        </p>
      </section>
    );
  }
  return (
    <section className="mm-mfl-results">
      <h2>{n === 1 ? "שכונה אחת שבה תשלמו פחות" : `${n} שכונות שבהן תשלמו פחות`}</h2>
      <p className="mm-mfl-today">היום: {today}</p>

      <div className="mm-mfl-list">
        {data.results.map((r) => (
          <a key={`${r.citySlug}-${r.id}`} href={`/map/${r.citySlug}?n=${r.id}`} className="mm-mfl-res">
            <div className="mm-mfl-res-top">
              <div style={{ minWidth: 0 }}>
                <h3>{r.he}</h3>
                <div className="mm-mfl-res-city">{r.cityHe}</div>
              </div>
              <div className="mm-mfl-res-save">
                <strong dir="ltr">−{priceLabel(r.saving, deal)}</strong>
                <span>{deal === "rent" ? `לחודש · ${priceLabel(r.saving * 12, deal)} בשנה` : "פחות"}</span>
              </div>
            </div>

            <dl className="mm-mfl-stats">
              <Stat label={`${size}${per}`} value={priceLabel(r.price, deal)} />
              {r.minutes != null && (
                <Stat
                  label="נסיעה לעבודה"
                  value={`${data.estimated ? "כ-" : ""}${r.minutes} דק׳`}
                  delta={data.home?.minutes != null ? r.minutes - data.home.minutes : null}
                  noise={1}
                  lowerIsBetter
                />
              )}
              {data.metrics.map((m) => (
                <Stat
                  key={m}
                  label={METRICS[m].label}
                  value={r.values[m] != null ? `${r.values[m]}${m === "kids" ? "%" : ""}` : "אין נתון"}
                  muted={r.values[m] == null}
                  delta={r.deltas[m]}
                  noise={METRICS[m].noise}
                />
              ))}
            </dl>

            <span className="mm-mfl-res-link">
              לשכונה במפה <MMIcon name="back" size={14} />
            </span>
          </a>
        ))}
      </div>

      <p className="mm-mfl-foot">
        המספר הצבעוני ליד כל נתון הוא ההפרש מהשכונה שלכם. המחירים הם ממוצע 12 החודשים האחרונים לשכונה (אתר הנדל״ן הממשלתי), ולא מחיר של דירה
        מסוימת. {data.metrics.includes("schools") && "בתי ספר: ממוצע המיצ״ב של בתי הספר במרחק הליכה. "}
        {data.metrics.includes("kids") && "משפחות עם ילדים: שיעור בני 0 עד 19 לפי מפקד האוכלוסין. "}
        {data.estimated ? "זמני הנסיעה הם הערכה לפי מרחק." : "זמני הנסיעה הם ברכב בלי עומסי תנועה."} נבדקו {data.considered} שכונות.
      </p>
    </section>
  );
}

/** One figure in a result card, with its difference from the family's home. */
function Stat({
  label,
  value,
  delta = null,
  noise = 0,
  lowerIsBetter = false,
  suffix = "",
  muted = false,
}: {
  label: string;
  value: string;
  delta?: number | null;
  /** A gap this small is within the data's noise — not shown as a difference. */
  noise?: number;
  lowerIsBetter?: boolean;
  suffix?: string;
  muted?: boolean;
}) {
  const show = delta != null && Math.abs(delta) > noise;
  const good = show && (lowerIsBetter ? delta! < 0 : delta! > 0);
  return (
    <div>
      <dt>{label}</dt>
      <dd className={muted ? "is-muted" : undefined}>
        {value}
        {show && (
          <em className={good ? "is-up" : "is-down"} dir="ltr">
            {delta! > 0 ? "+" : "−"}
            {Math.abs(delta!)}
            {suffix}
          </em>
        )}
      </dd>
    </div>
  );
}

/** Workplace chooser: an address search (Mapbox geocoding) or one-tap job areas. */
function WorkPicker({ onPick, token }: { onPick: (p: Place) => void; token: string }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Place[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 3 || !token) {
      setHits([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const url =
          `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(term)}` +
          `&country=il&language=he&limit=5&access_token=${token}`;
        const res = await fetch(url, { signal: ctrl.signal });
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as {
          features?: Array<{ geometry: { coordinates: [number, number] }; properties: { full_address?: string; name?: string } }>;
        };
        setHits(
          (json.features ?? []).map((f) => ({
            label: f.properties.name ?? f.properties.full_address ?? term,
            lng: f.geometry.coordinates[0],
            lat: f.geometry.coordinates[1],
          })),
        );
      } catch {
        setHits([]);
      } finally {
        setBusy(false);
      }
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, token]);

  return (
    <div className="mm-fld">
      <label htmlFor="mm-mfl-work">מקום העבודה</label>
      <div className="mm-fld-search">
        <MMIcon name="search" size={16} />
        <input id="mm-mfl-work" value={q} onChange={(e) => setQ(e.target.value)} placeholder="כתובת או שם של מקום" autoComplete="off" />
      </div>
      {(hits.length > 0 || busy) && (
        <ul className="mm-mfl-hits">
          {busy && hits.length === 0 && <li className="is-busy">מחפשים…</li>}
          {hits.map((h) => (
            <li key={`${h.lng},${h.lat}`}>
              <button type="button" onClick={() => onPick(h)}>
                {h.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mm-mfl-hubs" role="group" aria-label="אזורי תעסוקה נפוצים">
        {HUBS.map((h) => (
          <button key={h.label} type="button" onClick={() => onPick(h)}>
            {h.label}
          </button>
        ))}
      </div>
    </div>
  );
}
