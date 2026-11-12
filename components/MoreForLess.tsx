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
  const [workOpen, setWorkOpen] = useState(false);
  const missing = [cityId === "" && "עיר", !(priceNum > 0) && "כמה אתם משלמים", !work && "מקום עבודה"].filter(Boolean) as string[];

  return (
    <div className="mm-shell" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--hn-bg)" }}>
      <MMHeader activeNav="יותר בפחות" />
      <main className="mm-mfl">
        <header className="mm-mfl-hero">
          <p className="mm-home-eyebrow">יותר בפחות</p>
          <h1 className="mm-home-h1">
            אותה דירה, <span className="hl">פחות כסף</span>.
          </h1>
          <p className="mm-home-sub" style={{ marginTop: 12 }}>
            השלימו את המשפט, ונחפש בכל הערים שכונות שבהן משפחה כמוכם משלמת פחות, קרוב לעבודה.
          </p>
        </header>

        <form onSubmit={submit} className="mm-mfl-panel">
          {/* The form is one sentence the family completes. */}
          <p className="mm-mfl-story">
            אנחנו{" "}
            <Tok>
              <select
                aria-label="שוכרים או קונים"
                value={deal}
                onChange={(e) => {
                  setDeal(e.target.value as Deal);
                  setPriceTouched(false);
                }}
              >
                <option value="rent">שוכרים</option>
                <option value="buy">קונים</option>
              </select>
            </Tok>{" "}
            דירת{" "}
            <Tok>
              <select
                aria-label="גודל דירה"
                value={rooms}
                onChange={(e) => {
                  setRooms(e.target.value as RoomKey);
                  setPriceTouched(false);
                }}
              >
                <option value="3">3 חדרים</option>
                <option value="4">4 חדרים</option>
                <option value="5">5 חדרים</option>
              </select>
            </Tok>{" "}
            <Tok empty={cityId === ""} before="ב" after={cityId !== "" && cityId !== OTHER ? "," : undefined}>
              <select
                aria-label="העיר שלנו היום"
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
            </Tok>
            {cityId !== "" && cityId !== OTHER && (
              <>
                {" "}
                בשכונת{" "}
                <Tok empty={homeId === ""}>
                  <select
                    aria-label="השכונה שלנו היום"
                    value={homeId}
                    onChange={(e) => {
                      setHomeId(e.target.value);
                      setPriceTouched(false);
                    }}
                  >
                    <option value="">בחרו שכונה</option>
                    {hoods.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.he}
                      </option>
                    ))}
                  </select>
                </Tok>
              </>
            )}
{" "}
            {deal === "rent" ? "ומשלמים" : "במחיר של"}{" "}
            <Tok empty={!(priceNum > 0)} after={deal === "rent" ? undefined : "."}>
              <span aria-hidden>₪</span>
              <input
                inputMode="numeric"
                aria-label={deal === "rent" ? "שכר הדירה שלנו בשקלים לחודש" : "מחיר הדירה בשקלים"}
                aria-describedby="mm-mfl-pricehint"
                value={price ? Number(price.replace(/[^\d]/g, "")).toLocaleString("en-US") : ""}
                placeholder={deal === "rent" ? "7,800" : "3,200,000"}
                size={deal === "rent" ? 6 : 9}
                onChange={(e) => {
                  setPrice(e.target.value.replace(/[^\d]/g, ""));
                  setPriceTouched(true);
                }}
              />
            </Tok>
            {deal === "rent" ? " לחודש." : ""} אנחנו עובדים{" "}
            <span className="mm-tok-wrap">
              ב
              <button
              type="button"
              className={`mm-tok mm-tok-btn ${work ? "" : "is-empty"}`}
              aria-expanded={workOpen || !work}
              onClick={() => setWorkOpen((v) => !v)}
            >
              <MMIcon name="pin" size={15} />
              {work ? work.label : "בחרו מקום עבודה"}
              </button>
            </span>{" "}
            ומוכנים לנסוע עד{" "}
            <Tok after=".">
              <select aria-label="זמן נסיעה מרבי" value={maxMinutes} onChange={(e) => setMaxMinutes(Number(e.target.value))}>
                {MINUTES.map((m) => (
                  <option key={m} value={m}>
                    {m} דקות
                  </option>
                ))}
              </select>
            </Tok>
          </p>

          <p id="mm-mfl-pricehint" className="mm-mfl-hint">
            {known != null
              ? priceTouched && priceNum !== known
                ? `הממוצע בשכונה שלכם לגודל הזה: ${priceLabel(known, deal)}${per}.`
                : "מילאנו את הממוצע בשכונה שלכם. אם אתם משלמים סכום אחר, תקנו אותו."
              : home
                ? "אין לנו ממוצע לגודל הזה בשכונה שלכם, אז הקלידו את הסכום."
                : "בחרו שכונה ונמלא את הממוצע, או הקלידו כמה אתם משלמים."}
          </p>

          {(workOpen || !work) && (
            <WorkPicker
              token={mapboxToken}
              onPick={(p) => {
                setWork(p);
                setWorkOpen(false);
              }}
            />
          )}

          <fieldset className="mm-mfl-metrics">
            <legend>מה חשוב לכם בשכונה החדשה?</legend>
            <div className="mm-mfl-tiles">
              {METRIC_IDS.map((m) => {
                const on = metrics.includes(m);
                return (
                  <button key={m} type="button" aria-pressed={on} className={`mm-mfl-tile ${on ? "is-on" : ""}`} onClick={() => toggleMetric(m)}>
                    <span className="mm-mfl-tile-icon">
                      <MMIcon name={on ? "check" : METRIC_ICON[m]} size={16} />
                    </span>
                    <span className="mm-mfl-tile-text">
                      <strong>{METRICS[m].label}</strong>
                      <small>{METRIC_NOTE[m]}</small>
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mm-mfl-hint">
              {metrics.length === 0
                ? "לא בחרתם כלום, אז נדרג רק לפי החיסכון וזמן הנסיעה."
                : "נעדיף שכונות שלא נופלות מהבית שלכם במה שבחרתם."}
            </p>
          </fieldset>

          <div className="mm-mfl-submit">
            <button type="submit" className="mm-mfl-cta" disabled={!ready || loading}>
              {loading ? "מחשבים…" : "הראו לנו איפה"}
              {!loading && <MMIcon name="back" size={18} />}
            </button>
            {missing.length > 0 && <span className="mm-mfl-hint">נשאר להשלים: {missing.join(", ")}.</span>}
            {error && (
              <span role="alert" className="mm-mfl-hint" style={{ color: "var(--hn-negative)" }}>
                {error}
              </span>
            )}
          </div>
        </form>

        <div ref={resultsRef} style={{ scrollMarginTop: 16 }} aria-live="polite">
          {loading && !data && (
            <div className="mm-mfl-cards" aria-hidden>
              {[0, 1, 2].map((i) => (
                <div key={i} className="mm-mfl-card mm-mfl-skel" />
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

/** One fill-in-the-blank slot in the sentence. */
function Tok({
  children,
  empty = false,
  before,
  after,
}: {
  children: React.ReactNode;
  empty?: boolean;
  /** Text glued to the slot so a line never breaks between them (the Hebrew
   *  prefix "ב", a trailing comma or full stop). */
  before?: string;
  after?: string;
}) {
  return (
    <span className="mm-tok-wrap">
      {before}
      <span className={`mm-tok ${empty ? "is-empty" : ""}`}>{children}</span>
      {after}
    </span>
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
  const n = data.results.length;

  if (n === 0) {
    return (
      <section className="mm-mfl-banner is-empty">
        <p className="mm-mfl-banner-eyebrow">התשובה</p>
        <h2>לא מצאנו שכונה זולה יותר בטווח הזה</h2>
        <p>
          בתוך {asked.maxMinutes} דקות נסיעה מ{asked.work.label} אין אצלנו שכונה שבה {size} עולים פחות מ-{priceLabel(asked.price, deal)}
          {per}. נסו זמן נסיעה ארוך יותר או גודל דירה אחר.
        </p>
      </section>
    );
  }
  const best = Math.max(...data.results.map((r) => r.saving));
  return (
    <section>
      <div className="mm-mfl-banner">
        <p className="mm-mfl-banner-eyebrow">התשובה</p>
        <h2>
          אתם משלמים <strong>{priceLabel(asked.price, deal)}</strong>
          {per} על {size} {where}. מצאנו {n === 1 ? "שכונה אחת" : `${n} שכונות`} שבהן משפחה כמוכם משלמת עד{" "}
          <strong>{priceLabel(best, deal)} פחות</strong>
          {per}, במרחק של עד {asked.maxMinutes} דקות מ{asked.work.label}.
        </h2>
        {data.home?.minutes != null && <p>מהבית שלכם היום: כ-{data.home.minutes} דקות נסיעה לעבודה.</p>}
      </div>

      <div className="mm-mfl-cards">
        {data.results.map((r, i) => (
          <a key={`${r.citySlug}-${r.id}`} href={`/map/${r.citySlug}?n=${r.id}`} className="mm-mfl-card">
            <div className="mm-mfl-card-head">
              <span className="mm-mfl-rank">{i + 1}</span>
              <div style={{ minWidth: 0 }}>
                <div className="mm-mfl-card-city">{r.cityHe}</div>
                <h3>{r.he}</h3>
              </div>
            </div>

            <div className="mm-mfl-save">
              <div className="mm-mfl-save-num">
                {priceLabel(r.saving, deal)}
                <span> פחות{per}</span>
              </div>
              <div className="mm-mfl-save-sub">
                {deal === "rent" && <>{priceLabel(r.saving * 12, deal)} בשנה · </>}
                {size} כאן {priceLabel(r.price, deal)}
              </div>
            </div>

            <ul className="mm-mfl-rows">
              {data.metrics.map((m) => (
                <MetricRow key={m} metric={m} delta={r.deltas[m]} value={r.values[m]} />
              ))}
              {r.minutes != null && (
                <li>
                  <MMIcon name="car" size={15} />
                  <span>
                    {data.estimated ? "כ-" : ""}
                    {r.minutes} דק׳ לעבודה
                  </span>
                  {data.home?.minutes != null &&
                    (Math.abs(r.minutes - data.home.minutes) <= 1 ? (
                      <em className="mm-pill">כמו היום</em>
                    ) : (
                      <em className={`mm-pill ${r.minutes < data.home.minutes ? "is-up" : "is-down"}`}>
                        {Math.abs(r.minutes - data.home.minutes)} דק׳ {r.minutes < data.home.minutes ? "פחות" : "יותר"}
                      </em>
                    ))}
                </li>
              )}
            </ul>

            <span className="mm-mfl-open">
              לשכונה במפה <MMIcon name="back" size={15} />
            </span>
          </a>
        ))}
      </div>

      <p className="mm-mfl-foot">
        המחירים הם ממוצע 12 החודשים האחרונים לשכונה, לפי אתר הנדל״ן הממשלתי, ולא מחיר של דירה מסוימת.{" "}
        {data.metrics.includes("schools") && "ציון בתי הספר הוא ממוצע המיצ״ב של בתי הספר במרחק הליכה. "}
        {data.metrics.includes("kids") && "״משפחות עם ילדים״ הוא שיעור בני 0 עד 19 בשכונה לפי מפקד האוכלוסין. "}
        {data.estimated ? "זמני הנסיעה הם הערכה לפי מרחק." : "זמני הנסיעה הם ברכב, בלי עומסי תנועה, ובשעות הבוקר הם ארוכים יותר."} בדקנו{" "}
        {data.considered} שכונות זולות יותר בטווח.
      </p>
    </section>
  );
}

/** One "what you gain or give up" row: label on one side, a coloured pill on
 *  the other. Says so plainly when there's nothing to compare. */
function MetricRow({ metric, delta, value }: { metric: MetricId; delta: number | null; value: number | null }) {
  const def = METRICS[metric];
  const suffix = metric === "kids" ? "%" : "";
  let pill: React.ReactNode;
  if (delta == null) {
    pill = <em className="mm-pill is-none">{value != null ? "אין השוואה" : "אין נתון"}</em>;
  } else if (Math.abs(delta) <= def.noise) {
    pill = <em className="mm-pill">כמו אצלכם</em>;
  } else {
    pill = (
      <em className={`mm-pill ${delta > 0 ? "is-up" : "is-down"}`} title={`${Math.abs(delta)} ${def.unit} ${delta > 0 ? "יותר" : "פחות"}`}>
        <span dir="ltr">
          {delta > 0 ? "+" : "−"}
          {Math.abs(delta)}
          {suffix}
        </span>{" "}
        {delta > 0 ? "יותר" : "פחות"}
      </em>
    );
  }
  return (
    <li>
      <MMIcon name={METRIC_ICON[metric]} size={15} />
      <span>{def.label}</span>
      {pill}
    </li>
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
    <div className="mm-mfl-work">
      <div className="mm-mfl-work-title">איפה אתם עובדים?</div>
      <div className="mm-input" style={{ height: 46 }}>
        <MMIcon name="search" size={16} color="var(--hn-text-3)" />
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
          {busy && hits.length === 0 && <li style={{ padding: "8px 10px", color: "var(--hn-text-3)" }}>מחפשים…</li>}
          {hits.map((h) => (
            <li key={`${h.lng},${h.lat}`}>
              <button type="button" onClick={() => onPick(h)}>
                {h.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mm-mfl-hubs">
        <span>או אזור תעסוקה מוכר:</span>
        {HUBS.map((h) => (
          <button key={h.label} type="button" className="mm-chip" style={{ height: 32, fontSize: 12 }} onClick={() => onPick(h)}>
            {h.label}
          </button>
        ))}
      </div>
    </div>
  );
}
