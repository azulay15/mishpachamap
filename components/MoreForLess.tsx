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

  return (
    <div className="mm-shell" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--hn-bg)" }}>
      <MMHeader activeNav="יותר בפחות" />
      <main style={{ flex: 1, width: "100%", maxWidth: 860, margin: "0 auto", padding: "clamp(16px, 3.5vw, 40px) clamp(16px, 3vw, 32px) 64px" }}>
        <p className="mm-home-eyebrow">יותר בפחות</p>
        <h1 className="mm-home-h1" style={{ marginTop: 6 }}>
          איפה משפחה כמוכם <span className="hl">משלמת פחות</span>?
        </h1>
        <p style={{ margin: "10px 0 0", fontSize: 15, lineHeight: 1.6, color: "var(--grey-700)", maxWidth: 620 }}>
          ספרו לנו איפה אתם גרים, כמה אתם משלמים ואיפה אתם עובדים. נחפש בכל הערים שכונות שבהן דירה באותו גודל עולה פחות, ונראה מה מרוויחים
          ומה מוותרים.
        </p>

        <form onSubmit={submit} className="mm-home-card mm-mfl-form" style={{ marginTop: 20 }}>
          <div className="mm-mfl-row">
            <span className="mm-mfl-label">אנחנו</span>
            <div className="mm-seg mm-seg-lg" role="radiogroup" aria-label="שוכרים או קונים">
              {(["rent", "buy"] as Deal[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={deal === d}
                  className={deal === d ? "is-on" : ""}
                  onClick={() => {
                    setDeal(d);
                    setPriceTouched(false);
                  }}
                >
                  {d === "rent" ? "שוכרים" : "קונים"}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }} role="radiogroup" aria-label="גודל דירה">
              {(["3", "4", "5"] as RoomKey[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={rooms === k}
                  className={`mm-chip ${rooms === k ? "mm-chip-on" : ""}`}
                  style={{ height: 36, padding: "0 14px", fontSize: 13 }}
                  onClick={() => {
                    setRooms(k);
                    setPriceTouched(false);
                  }}
                >
                  {ROOM_LABEL[k]}
                </button>
              ))}
            </div>
          </div>

          <div className="mm-mfl-grid">
            <label className="mm-mfl-field">
              <span className="mm-mfl-label">העיר שלנו היום</span>
              <select
                className="mm-mfl-select"
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
            <label className="mm-mfl-field">
              <span className="mm-mfl-label">השכונה</span>
              <select
                className="mm-mfl-select"
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
            <label className="mm-mfl-field">
              <span className="mm-mfl-label">{deal === "rent" ? "שכר הדירה שלנו (₪ לחודש)" : "מחיר הדירה (₪)"}</span>
              <div className="mm-input" style={{ height: 44 }}>
                <input
                  inputMode="numeric"
                  value={price ? Number(price.replace(/[^\d]/g, "")).toLocaleString("en-US") : ""}
                  placeholder={deal === "rent" ? "7,800" : "3,200,000"}
                  onChange={(e) => {
                    setPrice(e.target.value.replace(/[^\d]/g, ""));
                    setPriceTouched(true);
                  }}
                  style={{ direction: "ltr", textAlign: "right", fontSize: 16, fontWeight: 700 }}
                  aria-describedby="mm-mfl-pricehint"
                />
              </div>
              <span id="mm-mfl-pricehint" className="mm-mfl-hint">
                {known != null
                  ? priceTouched && priceNum !== known
                    ? `הממוצע בשכונה: ${priceLabel(known, deal)}${per}`
                    : "מילאנו את הממוצע בשכונה. אפשר לתקן לסכום שלכם."
                  : home
                    ? "אין לנו ממוצע לגודל הזה בשכונה. הקלידו את הסכום שלכם."
                    : "הקלידו כמה אתם משלמים היום."}
              </span>
            </label>
          </div>

          <WorkPicker value={work} onChange={setWork} token={mapboxToken} />

          <div className="mm-mfl-row">
            <span className="mm-mfl-label">עד כמה זמן נסיעה לעבודה</span>
            <div style={{ display: "flex", gap: 6 }} role="radiogroup" aria-label="זמן נסיעה מרבי">
              {MINUTES.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={maxMinutes === m}
                  className={`mm-chip ${maxMinutes === m ? "mm-chip-on" : ""}`}
                  style={{ height: 36, padding: "0 14px", fontSize: 13 }}
                  onClick={() => setMaxMinutes(m)}
                >
                  {m} דק׳
                </button>
              ))}
            </div>
          </div>

          <div className="mm-mfl-field">
            <span className="mm-mfl-label">מה חשוב לכם בהשוואה</span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }} role="group" aria-label="מדדים להשוואה">
              {METRIC_IDS.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={metrics.includes(m)}
                  className={`mm-chip ${metrics.includes(m) ? "mm-chip-on" : ""}`}
                  style={{ height: 36, padding: "0 12px", fontSize: 13 }}
                  onClick={() => toggleMetric(m)}
                >
                  <MMIcon name={METRIC_ICON[m]} size={14} />
                  {METRICS[m].label}
                </button>
              ))}
            </div>
            <span className="mm-mfl-hint">
              {metrics.length === 0
                ? "לא בחרתם מדד: נדרג רק לפי החיסכון וזמן הנסיעה."
                : "נעדיף שכונות שלא נופלות מהבית שלכם במדדים שבחרתם, ונראה רק אותם בתוצאות."}
            </span>
          </div>

          <button type="submit" className="mm-btn mm-btn-primary mm-btn-lg" disabled={!ready || loading} style={{ alignSelf: "flex-start" }}>
            {loading ? "מחשבים…" : "הראו לנו איפה"}
          </button>
          {!ready && (
            <span className="mm-mfl-hint">
              חסר: {[cityId === "" && "עיר", !(priceNum > 0) && "סכום", !work && "מקום עבודה"].filter(Boolean).join(", ")}.
            </span>
          )}
          {error && (
            <p role="alert" style={{ margin: 0, fontSize: 13, color: "var(--red-negative)" }}>
              {error}
            </p>
          )}
        </form>

        <div ref={resultsRef} style={{ scrollMarginTop: 16 }} aria-live="polite">
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
  const where = data.home ? `ב${data.home.he}, ${data.home.cityHe}` : "היום";
  const size = ROOM_LABEL[asked.rooms];
  if (data.results.length === 0) {
    return (
      <section className="mm-home-card" style={{ marginTop: 20 }}>
        <h2 className="mm-home-h2" style={{ margin: 0 }}>
          לא מצאנו שכונה זולה יותר בטווח הזה
        </h2>
        <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.6, color: "var(--grey-700)" }}>
          בתוך {asked.maxMinutes} דקות נסיעה מ{asked.work.label} אין אצלנו שכונה שבה {size} עולים פחות מ-{priceLabel(asked.price, deal)}
          {per}. נסו להאריך את זמן הנסיעה, או גודל דירה אחר.
        </p>
      </section>
    );
  }
  return (
    <section style={{ marginTop: 28 }}>
      <h2 className="mm-mfl-headline">
        אתם משלמים <strong>{priceLabel(asked.price, deal)}</strong>
        {per} על {size} {where}. הנה {data.results.length === 1 ? "שכונה אחת" : `${data.results.length} שכונות`} שבהן משפחה כמוכם משלמת פחות, עד{" "}
        {asked.maxMinutes} דקות מ{asked.work.label}.
      </h2>
      {data.home?.minutes != null && (
        <p className="mm-mfl-hint" style={{ marginTop: 6 }}>
          להשוואה: מהבית שלכם היום זה כ-{data.home.minutes} דקות נסיעה.
        </p>
      )}
      <div className="mm-mfl-cards">
        {data.results.map((r) => (
          <a key={`${r.citySlug}-${r.id}`} href={`/map/${r.citySlug}?n=${r.id}`} className="mm-home-card mm-home-cardlink mm-mfl-card">
            <div style={{ fontSize: 12, color: "var(--grey-500)", fontWeight: 600 }}>{r.cityHe}</div>
            <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.25 }}>{r.he}</div>
            <div className="mm-mfl-saving">
              {priceLabel(r.saving, deal)} פחות{per}
            </div>
            <div style={{ fontSize: 13, color: "var(--grey-700)" }}>
              {size} כאן: {priceLabel(r.price, deal)}
              {per}
            </div>
            <ul className="mm-mfl-deltas">
              {data.metrics.map((m) => (
                <Delta
                  key={m}
                  icon={METRIC_ICON[m]}
                  label={METRICS[m].label}
                  delta={r.deltas[m]}
                  unit={METRICS[m].unit}
                  value={r.values[m]}
                  noise={METRICS[m].noise}
                />
              ))}
              {r.minutes != null && (
                <li>
                  <MMIcon name="car" size={14} color="var(--grey-500)" />
                  <span>
                    {data.estimated ? "כ-" : ""}
                    {r.minutes} דק׳ לעבודה
                    {data.home?.minutes != null && r.minutes !== data.home.minutes && (
                      <em className={r.minutes < data.home.minutes ? "is-up" : "is-down"}>
                        {" "}
                        ({Math.abs(r.minutes - data.home.minutes)} דק׳ {r.minutes < data.home.minutes ? "פחות" : "יותר"})
                      </em>
                    )}
                  </span>
                </li>
              )}
            </ul>
            <span className="mm-mfl-open">
              לשכונה במפה <MMIcon name="chevron-left" size={14} />
            </span>
          </a>
        ))}
      </div>
      <p className="mm-mfl-foot">
        המחירים הם ממוצע 12 החודשים האחרונים לשכונה, לפי אתר הנדל״ן הממשלתי, ולא מחיר של דירה מסוימת.{" "}
        {data.metrics.includes("schools") && "ציון בתי הספר הוא ממוצע המיצ״ב של בתי הספר במרחק הליכה. "}
        {data.metrics.includes("kids") && "״משפחות עם ילדים״ הוא שיעור בני 0 עד 19 בשכונה לפי מפקד האוכלוסין. "}
        {data.estimated
          ? "זמני הנסיעה הם הערכה לפי מרחק."
          : "זמני הנסיעה הם ברכב, בלי עומסי תנועה, ובשעות הבוקר הם ארוכים יותר."}{" "}
        בדקנו {data.considered} שכונות זולות יותר בטווח.
      </p>
    </section>
  );
}

/** One "what you gain or give up" line. Says so plainly when there's no data. */
function Delta({
  icon,
  label,
  delta,
  unit,
  value,
  noise = 0,
}: {
  icon: string;
  label: string;
  delta: number | null;
  unit: string;
  value: number | null;
  /** A gap this small is within the data's noise — shown as "about the same". */
  noise?: number;
}) {
  if (delta == null) {
    return (
      <li>
        <MMIcon name={icon} size={14} color="var(--grey-500)" />
        <span style={{ color: "var(--grey-500)" }}>
          {label}: {value != null ? `${value} (אין נתון להשוואה)` : "אין נתון"}
        </span>
      </li>
    );
  }
  return (
    <li>
      <MMIcon name={icon} size={14} color="var(--grey-500)" />
      <span>
        {label}:{" "}
        {Math.abs(delta) <= noise ? (
          "בערך כמו אצלכם"
        ) : (
          <em className={delta > 0 ? "is-up" : "is-down"}>
            {Math.abs(delta)} {unit} {delta > 0 ? "יותר" : "פחות"}
          </em>
        )}
      </span>
    </li>
  );
}

/** Workplace: one-tap common areas, or an address search (Mapbox geocoding). */
function WorkPicker({ value, onChange, token }: { value: Place | null; onChange: (p: Place | null) => void; token: string }) {
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
            label: f.properties.full_address ?? f.properties.name ?? term,
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
    <div className="mm-mfl-field">
      <span className="mm-mfl-label">איפה עובדים</span>
      {value ? (
        <div className="mm-mfl-picked">
          <MMIcon name="pin" size={15} color="var(--hn-primary)" />
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value.label}</span>
          <button type="button" className="mm-btn mm-btn-ghost mm-btn-sm" onClick={() => onChange(null)}>
            שינוי
          </button>
        </div>
      ) : (
        <>
          <div className="mm-input" style={{ height: 44 }}>
            <MMIcon name="search" size={15} color="var(--grey-500)" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="כתובת, רחוב או שם של מקום"
              aria-label="חיפוש מקום עבודה"
              style={{ fontSize: 16 }}
            />
          </div>
          {(hits.length > 0 || busy) && (
            <ul className="mm-mfl-hits">
              {busy && hits.length === 0 && <li style={{ padding: "8px 10px", color: "var(--grey-500)" }}>מחפשים…</li>}
              {hits.map((h) => (
                <li key={`${h.lng},${h.lat}`}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(h);
                      setQ("");
                      setHits([]);
                    }}
                  >
                    {h.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {HUBS.map((h) => (
              <button key={h.label} type="button" className="mm-chip" style={{ height: 30, fontSize: 12 }} onClick={() => onChange(h)}>
                {h.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
