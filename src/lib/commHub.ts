const COMM_HUB_BASE_URL = (process.env.COMM_HUB_URL || "https://flip-comm-hub.vercel.app") + "/api/v1";
const CACHE_TTL_MS = 60_000; // matches the API's own Cache-Control: max-age=60

export interface CommHubGlossaryTerm {
  id: string;
  term: string;
  term_bahasa: string;
  definition: string | null;
  avoid: string[] | null;
  category: string | null;
  tags: string[] | null;
  updated_at: string;
}

export interface CommHubMechanicRule {
  ruleText: string;
  doExamples: unknown[];
  dontExamples: unknown[];
}

export interface CommHubMechanic {
  id: string;
  rule: string;
  category: string | null;
  example: string | null;
  dont_example: string | null;
  description: string | null;
  data:
    | { kind: "repeater"; rules: CommHubMechanicRule[] }
    | { kind: "capitalization"; textComponents: string[]; uiComponents: string[] }
    | null;
  updated_at: string;
}

export interface CommHubBrandConstant {
  id: string;
  constant: string;
  heading: string;
  description: string;
  order_index: number;
}

export interface CommHubToneEntry {
  product: { name: string; slug: string } | null;
  brandConstants: CommHubBrandConstant[] | null;
  tonePillars: unknown[] | null;
}

export interface CommHubData {
  glossary: CommHubGlossaryTerm[];
  mechanics: CommHubMechanic[];
  tone: CommHubToneEntry[];
}

const EMPTY: CommHubData = { glossary: [], mechanics: [], tone: [] };

let cache: { data: CommHubData; fetchedAt: number } | null = null;

export async function getCommHubData(): Promise<{ data: CommHubData; degraded: boolean }> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return { data: cache.data, degraded: false };
  }

  try {
    const res = await fetch(`${COMM_HUB_BASE_URL}/all`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Comm Hub responded ${res.status}`);
    const json = await res.json();
    const data: CommHubData = {
      glossary: json?.data?.glossary ?? [],
      mechanics: json?.data?.mechanics ?? [],
      tone: json?.data?.tone ?? [],
    };
    cache = { data, fetchedAt: now };
    return { data, degraded: false };
  } catch (err) {
    console.warn("[commHub] fetch failed, proceeding without guideline context:", err);
    return { data: cache?.data ?? EMPTY, degraded: true };
  }
}

export function matchGlossaryTerms(
  sourceText: string,
  referenceText: string | null,
  glossary: CommHubGlossaryTerm[]
): CommHubGlossaryTerm[] {
  const haystack = `${sourceText} ${referenceText ?? ""}`.toLowerCase();
  return glossary.filter((g) => {
    const bahasa = (g.term_bahasa || "").trim().toLowerCase();
    const eng = (g.term || "").trim().toLowerCase();
    return (bahasa.length > 1 && haystack.includes(bahasa)) || (eng.length > 1 && haystack.includes(eng));
  });
}
