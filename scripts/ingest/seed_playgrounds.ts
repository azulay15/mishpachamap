/**
 * Seed a hand-curated playground audit for Modi'in. Each entry captures:
 *   - has_shade: is there a "Hatzlala" shade structure over the play area?
 *   - modern_equipment: was the equipment refreshed in the last ~5 years?
 *   - audited_at: date of last visual audit
 *
 * V1: synthetic mock distributed over neighborhoods. The audit is the founder's
 * edge per PRD §3.B — kids' safety / comfort signal that Madlan doesn't have.
 *
 * TODO(post-V1): replace with crowd-sourced audits + photos. Possible sources:
 *   - Modi'in municipality maintenance schedule (open data?)
 *   - Volunteers in the עיריית מודיעין parents Facebook group
 *   - Periodic photo walks
 */
import { sb, wktPoint } from "./_env";

type Playground = {
  id: string;
  name_he: string;
  pos: [number, number];
  has_shade: boolean;
  modern_equipment: boolean;
};

const PLAYGROUNDS: Playground[] = [
  // North / Hakramim & Hanevim
  { id: "pg-1",  name_he: "פארק הכרמים – מתחם הרצועה",       pos: [35.012, 31.927], has_shade: true,  modern_equipment: true  },
  { id: "pg-2",  name_he: "גן השלום – הכרמים",                pos: [35.020, 31.925], has_shade: true,  modern_equipment: false },
  { id: "pg-3",  name_he: "פארק הנביאים – מתקני סקייט",       pos: [34.985, 31.928], has_shade: false, modern_equipment: true  },
  // Center / Haprachim & Hanechalim
  { id: "pg-4",  name_he: "פארק האנוסים",                      pos: [35.005, 31.910], has_shade: true,  modern_equipment: true  },
  { id: "pg-5",  name_he: "גינת חרצית – הפרחים",               pos: [35.000, 31.906], has_shade: false, modern_equipment: false },
  { id: "pg-6",  name_he: "פארק הנחלים – מגרש המטוס",          pos: [35.012, 31.892], has_shade: true,  modern_equipment: true  },
  // West / Avnei Chen, Hameginim, Nofim
  { id: "pg-7",  name_he: "פארק ענבה – אגף משחקים",            pos: [34.978, 31.892], has_shade: true,  modern_equipment: true  },
  { id: "pg-8",  name_he: "פארק החרגול",                       pos: [34.983, 31.910], has_shade: true,  modern_equipment: true  },
  { id: "pg-9",  name_he: "גינת הנופים – המרכזית",             pos: [34.970, 31.910], has_shade: false, modern_equipment: true  },
  // East / Masuah, Hashvatim, Moriah
  { id: "pg-10", name_he: "פארק משואה – מצפור הגבעה",          pos: [35.030, 31.890], has_shade: true,  modern_equipment: true  },
  { id: "pg-11", name_he: "גן יהודה – השבטים",                 pos: [34.985, 31.872], has_shade: false, modern_equipment: false },
  { id: "pg-12", name_he: "פארק מוריה הירוק",                  pos: [35.020, 31.860], has_shade: true,  modern_equipment: true  },
  // South / Hareut, Hatsiporim
  { id: "pg-13", name_he: "גינת הרעות – המרכזית",              pos: [35.012, 31.872], has_shade: true,  modern_equipment: false },
  { id: "pg-14", name_he: "פארק הציפורים – מתקני 0-12",        pos: [35.040, 31.870], has_shade: true,  modern_equipment: true  },
  { id: "pg-15", name_he: "גינת המכבים – הוותיקה",             pos: [35.057, 31.928], has_shade: false, modern_equipment: false },
];

async function main() {
  // Wipe prior synthetic playground audits so re-runs don't pile up.
  const { error: deleteErr } = await sb
    .from("pois")
    .delete()
    .eq("type", "playground")
    .like("id", "pg-%");
  if (deleteErr && !deleteErr.message.includes("0 rows")) {
    console.warn("cleanup:", deleteErr.message);
  }

  const today = new Date().toISOString().slice(0, 10);
  const rows = PLAYGROUNDS.map((p) => ({
    id: p.id,
    type: "playground",
    name_he: p.name_he,
    point: wktPoint(p.pos),
    meta: {
      has_shade: p.has_shade,
      modern_equipment: p.modern_equipment,
      audited_at: today,
      source: "synthetic-v1",
    },
  }));

  console.log(`→ upserting ${rows.length} playground audits…`);
  const { error } = await sb.from("pois").upsert(rows);
  if (error) {
    console.error("✗", error.message);
    process.exitCode = 1;
    return;
  }

  const shaded = PLAYGROUNDS.filter((p) => p.has_shade).length;
  const modern = PLAYGROUNDS.filter((p) => p.modern_equipment).length;
  console.log(`✓ done — ${rows.length} playgrounds, ${shaded} shaded, ${modern} with modern equipment`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
