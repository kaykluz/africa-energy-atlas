export type AtlasView = "map" | "chain" | "software" | "companies";
export type MapLayer = "companies" | "software";

export type AtlasSearch = {
  view?: AtlasView;
  country?: string;
  stage?: string;
  q?: string;
  role?: string;
  rel?: string;
  reviewed?: boolean;
  layer?: MapLayer;
  sw?: string;
  co?: string;
  fn?: string;
};

const VIEWS: AtlasView[] = ["map", "chain", "software", "companies"];

export function parseAtlasSearch(s: Record<string, unknown>): AtlasSearch {
  const view = VIEWS.includes(s.view as AtlasView) ? (s.view as AtlasView) : undefined;
  const layer = s.layer === "software" || s.layer === "companies" ? s.layer : undefined;
  const reviewed =
    s.reviewed === true || s.reviewed === "true" || s.reviewed === "1" ? true : undefined;
  const str = (k: keyof AtlasSearch) => {
    const v = s[k];
    return typeof v === "string" && v.length ? v : undefined;
  };
  return {
    view,
    country: str("country")?.toUpperCase(),
    stage: str("stage"),
    q: str("q"),
    role: str("role"),
    rel: str("rel"),
    reviewed,
    layer,
    sw: str("sw"),
    co: str("co"),
    fn: str("fn"),
  };
}
