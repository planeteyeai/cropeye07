/** GET https://cropeye-database-production.up.railway.app/analysis_timeline?plot_name=... */

const TIMELINE_PATH = "/analysis_timeline";

export interface TimelineBucket {
  growth_dates: string[];
  water_uptake_dates: string[];
  soil_moisture_dates: string[];
  pest_detection_dates: string[];
}

export interface AnalysisTimelineResponse {
  plot_name: string;
  timeline: TimelineBucket[];
}

export type MapAnalysisLayer = "Growth" | "Water Uptake" | "Soil Moisture" | "PEST";

const LAYER_TO_KEY: Record<MapAnalysisLayer, keyof TimelineBucket> = {
  Growth: "growth_dates",
  "Water Uptake": "water_uptake_dates",
  "Soil Moisture": "soil_moisture_dates",
  PEST: "pest_detection_dates",
};

export function getAnalysisTimelineBaseUrl(): string {
  return import.meta.env.DEV
    ? "/api/analysis-timeline"
    : "https://cropeye-database-production.up.railway.app";
}

export async function fetchAnalysisTimeline(
  plotName: string,
): Promise<AnalysisTimelineResponse | null> {
  const trimmed = plotName?.trim();
  if (!trimmed) return null;
  const url = `${getAnalysisTimelineBaseUrl()}${TIMELINE_PATH}?plot_name=${encodeURIComponent(trimmed)}`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as AnalysisTimelineResponse;
    if (data?.timeline && Array.isArray(data.timeline)) return data;
    return null;
  } catch {
    return null;
  }
}

function collectDatesForLayer(
  timeline: TimelineBucket[] | undefined,
  layer: MapAnalysisLayer,
): Set<string> {
  const key = LAYER_TO_KEY[layer];
  const set = new Set<string>();
  if (!timeline?.length) return set;
  for (const bucket of timeline) {
    const arr = bucket[key];
    if (!Array.isArray(arr)) continue;
    for (const raw of arr) {
      if (typeof raw !== "string") continue;
      const day = raw.split("T")[0].trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(day)) set.add(day);
    }
  }
  return set;
}

/** Unique analysis dates for the layer, sorted oldest → newest. */
export function sortedRebinDatesForLayer(
  timeline: TimelineBucket[] | undefined,
  layer: MapAnalysisLayer,
): string[] {
  const set = collectDatesForLayer(timeline, layer);
  return [...set].sort();
}

/** Latest calendar date that appears in any layer’s rebin lists (for a single shared map `end_date` on load). */
export function latestRebinDateAcrossAllLayers(
  timeline: TimelineBucket[] | undefined,
): string {
  if (!timeline?.length) return "";
  let best = "";
  const layers: MapAnalysisLayer[] = ["Growth", "Water Uptake", "Soil Moisture", "PEST"];
  for (const layer of layers) {
    const dates = sortedRebinDatesForLayer(timeline, layer);
    const last = dates[dates.length - 1];
    if (last && last > best) best = last;
  }
  return best;
}
