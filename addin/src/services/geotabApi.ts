/**
 * Promise-based wrapper for Geotab API calls.
 * Ported from backend-alg smartroute.js data-loading and route-writeback logic.
 *
 * Falls back to FALLBACK_ROUTES when running outside Geotab (dev mode).
 */

import { getGeotabApi, type GeotabApi } from "../main";
import type { AlgoBin } from "./algorithm";
import binDataJson from "../../../data/bin-data.json";

/* ── Types ── */

export interface RouteEntry {
  id: string;
  name: string;
  bins: AlgoBin[];
  depot: { lat: number; lng: number };
  collectionLogs: unknown[];
}

export interface GeotabRouteRef {
  id: string;
  name: string;
  comment?: string;
  bins?: AlgoBin[];        // only present on fallback demo routes
  depot?: { lat: number; lng: number };
  collectionLogs?: unknown[];
}

interface BinDataEntry {
  depot: { lat: number; lng: number };
  bins: { name: string; lat: number; lng: number; fillLevel: number }[];
  collectionLogs: { binName: string; collectedAt: string; fillPctAtCollection: number }[];
}

const binData: Record<string, BinDataEntry> = binDataJson;

/* ── Fallback demo data ── */

const FALLBACK_ROUTES: GeotabRouteRef[] = [
  {
    id: "demo-route-1",
    name: "Downtown West",
    bins: [
      { id: "dw-1", name: "King & Spadina",     lat: 43.6449, lng: -79.3966, fillLevel: 85 },
      { id: "dw-2", name: "Queen & Bathurst",    lat: 43.6439, lng: -79.4082, fillLevel: 42 },
      { id: "dw-3", name: "Dundas & University", lat: 43.6555, lng: -79.3895, fillLevel: 72 },
      { id: "dw-4", name: "College & Spadina",   lat: 43.6595, lng: -79.4016, fillLevel: 28 },
      { id: "dw-5", name: "Bloor & Ossington",   lat: 43.6627, lng: -79.4258, fillLevel: 91 },
      { id: "dw-6", name: "Bloor & Bathurst",    lat: 43.6664, lng: -79.4119, fillLevel: 15 },
      { id: "dw-7", name: "Harbord & Spadina",   lat: 43.6611, lng: -79.4013, fillLevel: 63 },
    ],
    depot: { lat: 43.6400, lng: -79.4100 },
    collectionLogs: [],
  },
  {
    id: "demo-route-2",
    name: "Midtown East",
    bins: [
      { id: "me-1", name: "Yonge & Eglinton",        lat: 43.7065, lng: -79.3985, fillLevel: 78 },
      { id: "me-2", name: "Yonge & Lawrence",         lat: 43.7249, lng: -79.4027, fillLevel: 55 },
      { id: "me-3", name: "Mt Pleasant & Davisville", lat: 43.7002, lng: -79.3900, fillLevel: 91 },
      { id: "me-4", name: "Bayview & Moore",          lat: 43.7043, lng: -79.3722, fillLevel: 33 },
      { id: "me-5", name: "Chaplin & Eglinton",       lat: 43.7072, lng: -79.4140, fillLevel: 67 },
    ],
    depot: { lat: 43.7100, lng: -79.4000 },
    collectionLogs: [],
  },
  {
    id: "demo-route-3",
    name: "Waterfront Loop",
    bins: [
      { id: "wf-1", name: "Queens Quay & York",    lat: 43.6390, lng: -79.3762, fillLevel: 94 },
      { id: "wf-2", name: "Queens Quay & Spadina",  lat: 43.6383, lng: -79.3953, fillLevel: 48 },
      { id: "wf-3", name: "Harbourfront Centre",    lat: 43.6387, lng: -79.3812, fillLevel: 82 },
      { id: "wf-4", name: "Rees St & Queens Quay",  lat: 43.6385, lng: -79.3838, fillLevel: 19 },
      { id: "wf-5", name: "Simcoe & Bremner",       lat: 43.6413, lng: -79.3868, fillLevel: 71 },
    ],
    depot: { lat: 43.6420, lng: -79.3800 },
    collectionLogs: [],
  },
];

/* ── Helpers ── */

function callApi<T>(api: GeotabApi, method: string, params: Record<string, unknown>): Promise<T> {
  return new Promise((resolve, reject) => {
    api.call(method, params, (result) => resolve(result as T), (err) => reject(err));
  });
}

interface GeotabZone {
  id: string;
  name?: string;
  points?: { x: number; y: number }[];
}

function zoneCentroid(zone: GeotabZone): { lat: number; lng: number } | null {
  const pts = zone.points || [];
  if (pts.length === 0) return null;
  let lat = 0, lng = 0;
  for (const p of pts) { lng += p.x || 0; lat += p.y || 0; }
  return { lat: lat / pts.length, lng: lng / pts.length };
}

function createZonePoints(lat: number, lng: number) {
  const o = 0.0001;
  return [
    { x: lng - o, y: lat - o }, { x: lng + o, y: lat - o },
    { x: lng + o, y: lat + o }, { x: lng - o, y: lat + o },
    { x: lng - o, y: lat - o },
  ];
}

/* ── Public API ── */

/**
 * Fetch all route references for the search dropdown.
 * Returns Geotab routes when connected, fallback demo routes otherwise.
 */
export async function fetchAllRoutes(): Promise<GeotabRouteRef[]> {
  const api = getGeotabApi();
  if (!api) return FALLBACK_ROUTES;
  try {
    const routes = await callApi<GeotabRouteRef[]>(api, "Get", { typeName: "Route" });
    return routes.length > 0 ? routes : FALLBACK_ROUTES;
  } catch {
    return FALLBACK_ROUTES;
  }
}

/**
 * Load a single route's bins from Geotab zones + local bin-data.json.
 *
 * Strategy:
 *  1. Demo/fallback routes with existing bins → return directly
 *  2. If bin-data.json has this route → fetch SR- zones to get real IDs, match by name
 *  3. Fallback → fetch all SR- zones, match by name with default fill levels
 */
export async function loadRouteById(routeId: string, routeName: string, existingBins?: AlgoBin[], existingDepot?: { lat: number; lng: number }): Promise<RouteEntry | null> {
  // Demo routes already have bins baked in
  if (existingBins && existingDepot) {
    return { id: routeId, name: routeName, bins: existingBins, depot: existingDepot, collectionLogs: [] };
  }

  const localRoute = binData[routeName];

  // If we have local data, we can build bins directly — Geotab zone lookup is
  // only needed for real zone IDs (used by writeRouteToGeotab).
  const api = getGeotabApi();

  // Build a name → zoneId map from Geotab zones (best-effort)
  const nameToZoneId: Record<string, string> = {};
  if (api) {
    try {
      const zones = await callApi<GeotabZone[]>(api, "Get", { typeName: "Zone" });
      for (const z of zones || []) {
        if (z.name?.startsWith("SR-")) {
          nameToZoneId[z.name.slice(3)] = z.id;
        }
      }
    } catch (err) {
      console.warn("[SmartRoute] Zone lookup failed (continuing with local data):", err);
    }
  }

  if (localRoute) {
    const bins: AlgoBin[] = localRoute.bins.map(b => ({
      id: nameToZoneId[b.name] || `local-${b.name}`,
      name: b.name,
      lat: b.lat,
      lng: b.lng,
      fillLevel: b.fillLevel,
    }));

    // Map collection log binNames to zone IDs
    const collectionLogs = (localRoute.collectionLogs || []).map(log => ({
      binId: nameToZoneId[log.binName] || `local-${log.binName}`,
      collectedAt: log.collectedAt,
      fillPctAtCollection: log.fillPctAtCollection,
    }));

    console.log(`[SmartRoute] Loaded ${bins.length} bins for route "${routeName}" from local data`);
    return { id: routeId, name: routeName, bins, depot: localRoute.depot, collectionLogs };
  }

  // No local data — shouldn't happen for seeded routes, but handle gracefully
  if (!api) return null;

  console.warn(`[SmartRoute] No local data for route "${routeName}", using zone coords with default fill levels`);
  const bins: AlgoBin[] = [];
  for (const [name, zoneId] of Object.entries(nameToZoneId)) {
    bins.push({ id: zoneId, name, lat: 0, lng: 0, fillLevel: 50 });
  }
  const depot = bins.length > 0 ? { lat: bins[0].lat, lng: bins[0].lng } : { lat: 43.65, lng: -79.38 };
  return { id: routeId, name: routeName, bins, depot, collectionLogs: [] };
}

/**
 * Write an optimized route back to Geotab as a new Route entity.
 */
export async function writeRouteToGeotab(
  baseName: string,
  optimizedBins: AlgoBin[],
): Promise<string | null> {
  const api = getGeotabApi();
  if (!api) {
    console.log("[SmartRoute] Demo mode: accepted route (no Geotab write)");
    return "demo-accepted";
  }

  if (optimizedBins.length < 2) return null;

  const routeName = `SmartRoute-${baseName}-${new Date().toISOString().slice(0, 10)}`;

  // Step 1: Ensure every bin has a real Geotab Zone ID
  const zoneRefs: { id: string }[] = [];
  for (const bin of optimizedBins) {
    const needsZone = bin.id.startsWith("demo-") || bin.id.startsWith("dw-") ||
                      bin.id.startsWith("me-") || bin.id.startsWith("wf-") ||
                      bin.id.startsWith("local-");
    if (!needsZone) {
      zoneRefs.push({ id: bin.id });
    } else {
      const zoneId = await callApi<string>(api, "Add", {
        typeName: "Zone",
        entity: {
          name: `SR-${bin.name || bin.id}`,
          points: createZonePoints(bin.lat, bin.lng),
          displayed: true,
          groups: [{ id: "GroupCompanyId" }],
        },
      });
      zoneRefs.push({ id: zoneId });
    }
  }

  // Step 2: Build plan items and create Route with routePlanItemCollection
  const routePlanItems = zoneRefs.map((zr, seq) => ({
    zone: zr,
    sequence: seq,
  }));

  await callApi<string>(api, "Add", {
    typeName: "Route",
    entity: {
      name: routeName,
      comment: "SmartRoute optimized waste collection",
      routeType: "Basic",
      routePlanItemCollection: routePlanItems,
    },
  });

  return routeName;
}

/**
 * Query Geotab Ace AI for a natural-language fleet insight.
 *
 * Flow: create-chat → send-prompt → poll get-message-group until DONE.
 * Returns the reasoning string from the first completed message, or null on
 * failure / timeout / unavailability (e.g. demo mode without Geotab API).
 *
 * Rate-limit note: Ace needs ~8s before the first poll; max ~10 attempts.
 */
export async function queryAce(prompt: string): Promise<string | null> {
  const api = getGeotabApi();
  if (!api) return null;

  function aceCall<T>(functionName: string, functionParameters: Record<string, unknown>): Promise<T> {
    return new Promise((resolve, reject) => {
      api!.call(
        "GetAceResults",
        { serviceName: "dna-planet-orchestration", functionName, customerData: true, functionParameters },
        (result) => resolve((result as { apiResult: { results: T[] } }).apiResult.results[0] as T),
        (err) => reject(err),
      );
    });
  }

  try {
    // Step 1: create-chat
    let chatId: string | undefined;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const chatData = await aceCall<{ chat_id?: string }>("create-chat", {});
        chatId = chatData.chat_id;
        if (chatId) break;
      } catch { /* retry */ }
      await new Promise((r) => setTimeout(r, 3000));
    }
    if (!chatId) return null;

    // Step 2: send-prompt
    const sendData = await aceCall<{ message_group_id?: string; message_group?: { id: string } }>(
      "send-prompt",
      { chat_id: chatId, prompt },
    );
    const mgId = sendData.message_group_id || sendData.message_group?.id;
    if (!mgId) return null;

    // Step 3: poll get-message-group (up to 10 attempts, 8s first delay then 5s)
    await new Promise((r) => setTimeout(r, 8000));
    for (let i = 0; i < 10; i++) {
      const pollData = await aceCall<{
        message_group?: {
          status?: { status?: string };
          messages?: Record<string, { reasoning?: string; preview_array?: unknown[] }>;
        };
      }>("get-message-group", { message_group_id: mgId });

      const status = pollData.message_group?.status?.status;
      if (status === "DONE") {
        const messages = pollData.message_group?.messages || {};
        for (const msg of Object.values(messages)) {
          if (msg.reasoning) return msg.reasoning;
          if (msg.preview_array && msg.preview_array.length > 0) {
            return `Analysis complete: ${JSON.stringify(msg.preview_array[0])}`;
          }
        }
        return null;
      }
      if (status === "FAILED") return null;
      await new Promise((r) => setTimeout(r, 5000));
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch live vehicle positions from Geotab.
 */
export async function fetchVehicleStatuses(): Promise<{ latitude: number; longitude: number; name?: string }[]> {
  const api = getGeotabApi();
  if (!api) return [];
  try {
    const statuses = await callApi<{ latitude?: number; longitude?: number; device?: { name?: string } }[]>(
      api, "Get", { typeName: "DeviceStatusInfo" },
    );
    return (statuses || [])
      .filter((s) => !!s.latitude && !!s.longitude)
      .map((s) => ({ latitude: s.latitude!, longitude: s.longitude!, name: s.device?.name }));
  } catch {
    return [];
  }
}
