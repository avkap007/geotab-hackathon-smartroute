/**
 * Central state management hook for SmartRoute.
 * Wires together Geotab API, algorithm, and routing services.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  fetchAllRoutes,
  loadRouteById,
  writeRouteToGeotab,
  fetchVehicleStatuses,
  queryAce,
  type GeotabRouteRef,
  type RouteEntry,
} from "../services/geotabApi";
import {
  runOptimization,
  predictFillLevels,
  type AlgoResult,
  type AlgoMetrics,
  type Prediction,
  type AlgoBin,
} from "../services/algorithm";
import { fetchRoadPolyline, type LatLng } from "../services/routing";

/* ── Types ── */

export interface LoadedRoute extends RouteEntry {
  color: string;
  originalRoadPolyline: LatLng[] | null;
}

export interface OptimizedResult {
  result: AlgoResult;
  accepted: boolean;
  roadPolylines: LatLng[][]; // one per vehicleRoute
  assignedVehicle: string | null;
}

/* ── Constants ── */

const ROUTE_COLORS = ["#4361ee", "#16a34a", "#f97316", "#7c3aed", "#db2777"];

/* ── Hook ── */

export function useSmartRoute() {
  // Search / route catalogue
  const [allRoutes, setAllRoutes] = useState<GeotabRouteRef[]>([]);
  const [routesLoading, setRoutesLoading] = useState(true);

  // Loaded routes on the map
  const [loadedRoutes, setLoadedRoutes] = useState<LoadedRoute[]>([]);

  // Optimization results keyed by routeId
  const [optimizedMap, setOptimizedMap] = useState<Record<string, OptimizedResult>>({});

  // Predictions keyed by binId
  const [predictions, setPredictions] = useState<Record<string, Prediction>>({});

  // Controls
  const [threshold, setThreshold] = useState(50);
  const [intensity, setIntensity] = useState(50); // 0–100 (divided by 100 for algo)
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizeStatus, setOptimizeStatus] = useState("");
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);

  // Ace AI insight
  const [aceInsight, setAceInsight] = useState<string | null>(null);
  const [aceInsightLoading, setAceInsightLoading] = useState(false);

  // Vehicles (with optional name for assignment display)
  const vehiclesRef = useRef<{ latitude: number; longitude: number; name?: string }[]>([]);

  // Colour counter
  const colorIdx = useRef(0);

  /* ── Init: fetch route catalogue + vehicles ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const routes = await fetchAllRoutes();
      if (!cancelled) {
        setAllRoutes(routes);
        setRoutesLoading(false);
      }
      vehiclesRef.current = await fetchVehicleStatuses();
    })();
    return () => { cancelled = true; };
  }, []);

  /* ── Add a route to the map ── */
  const addRoute = useCallback(async (ref: GeotabRouteRef) => {
    // Prevent duplicates
    if (loadedRoutes.some((r) => r.id === ref.id)) return;

    setOptimizeStatus(`Loading ${ref.name}…`);
    const data = await loadRouteById(ref.id, ref.name, ref.bins, ref.depot);
    setOptimizeStatus("");

    if (!data || data.bins.length === 0) {
      alert(`No stops found for "${ref.name}".`);
      return;
    }

    const color = ROUTE_COLORS[colorIdx.current % ROUTE_COLORS.length];
    colorIdx.current++;

    // Add route immediately with straight-line fallback so map shows without waiting
    const entry: LoadedRoute = { ...data, color, originalRoadPolyline: null };
    setLoadedRoutes((prev) => [...prev, entry]);

    // Fetch OSRM road polyline in the background — updates the route when ready
    const allPoints = [
      data.depot,
      ...data.bins.map((b) => ({ lat: b.lat, lng: b.lng })),
      data.depot,
    ];
    fetchRoadPolyline(allPoints).then((polyline) => {
      setLoadedRoutes((prev) =>
        prev.map((r) => r.id === ref.id ? { ...r, originalRoadPolyline: polyline } : r)
      );
    }).catch(() => { /* keep straight-line fallback */ });

    // Run predictions for this route's bins
    const preds = predictFillLevels(data.collectionLogs, data.bins, threshold);
    if (preds.length > 0) {
      setPredictions((prev) => {
        const next = { ...prev };
        for (const p of preds) next[p.binId] = p;
        return next;
      });
    }
  }, [loadedRoutes, threshold]);

  /* ── Remove a route from the map ── */
  const removeRoute = useCallback((routeId: string) => {
    setLoadedRoutes((prev) => prev.filter((r) => r.id !== routeId));
    setOptimizedMap((prev) => {
      const next = { ...prev };
      delete next[routeId];
      return next;
    });
    if (selectedRouteId === routeId) setSelectedRouteId(null);
  }, [selectedRouteId]);

  /* ── Optimize all loaded routes ── */
  const runOptimize = useCallback(async () => {
    if (loadedRoutes.length === 0 || isOptimizing) return;
    setIsOptimizing(true);
    setSelectedRouteId(null);

    const newOptMap: Record<string, OptimizedResult> = {};

    for (const entry of loadedRoutes) {
      setOptimizeStatus(`Optimizing ${entry.name}…`);

      const result = await runOptimization(entry.bins, entry.depot, {
        threshold,
        intensity: intensity / 100,
        vehicleCapacity: 10,
        vehicles: vehiclesRef.current,
      });

      // Fetch OSRM road polylines for each vehicle route
      const roadPolylines: LatLng[][] = [];
      for (const vr of result.vehicleRoutes) {
        const poly = await fetchRoadPolyline(vr.points);
        roadPolylines.push(poly);
      }

      // Assign nearest vehicle to this route's depot
      let assignedVehicle: string | null = null;
      if (vehiclesRef.current.length > 0) {
        let bestDist = Infinity;
        const toRad = (d: number) => d * Math.PI / 180;
        for (const v of vehiclesRef.current) {
          const dlat = toRad(v.latitude - entry.depot.lat);
          const dlng = toRad(v.longitude - entry.depot.lng);
          const a = Math.sin(dlat / 2) ** 2 + Math.cos(toRad(entry.depot.lat)) * Math.cos(toRad(v.latitude)) * Math.sin(dlng / 2) ** 2;
          const dist = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 6371;
          if (dist < bestDist) {
            bestDist = dist;
            assignedVehicle = v.name || `Vehicle (${v.latitude.toFixed(2)}, ${v.longitude.toFixed(2)})`;
          }
        }
      }

      newOptMap[entry.id] = { result, accepted: false, roadPolylines, assignedVehicle };
    }

    setOptimizedMap((prev) => ({ ...prev, ...newOptMap }));
    setOptimizeStatus("Done! Review your optimized routes.");
    setIsOptimizing(false);

    // Fire Ace query in background for fleet insight
    const totalKmSaved = Object.values(newOptMap).reduce(
      (sum, opt) => sum + (opt?.result?.metrics?.kmSaved || 0), 0,
    );
    const totalStopsSkipped = Object.values(newOptMap).reduce(
      (sum, opt) => sum + (opt?.result?.metrics?.stopsSkipped || 0), 0,
    );
    setAceInsightLoading(true);
    queryAce(
      `Give one concise sentence of fleet insight about smart waste collection efficiency. ` +
      `Context: route optimization reduced total travel distance by ${totalKmSaved.toFixed(1)} km ` +
      `and skipped ${totalStopsSkipped} unnecessary bin stops. Focus on environmental or operational benefit.`
    ).then((insight) => {
      setAceInsight(insight);
      setAceInsightLoading(false);
    });
  }, [loadedRoutes, threshold, intensity, isOptimizing]);

  /* ── Accept an optimization (write to Geotab) ── */
  const acceptRoute = useCallback(async (routeId: string): Promise<string | null> => {
    const opt = optimizedMap[routeId];
    const entry = loadedRoutes.find((r) => r.id === routeId);
    if (!opt || !entry) return null;

    try {
      const routeName = await writeRouteToGeotab(entry.name, opt.result.optimizedBins);
      if (routeName) {
        setOptimizedMap((prev) => ({
          ...prev,
          [routeId]: { ...prev[routeId], accepted: true },
        }));
      }
      return routeName;
    } catch (err) {
      console.error("[SmartRoute] Failed to write route to Geotab:", err);
      return null;
    }
  }, [optimizedMap, loadedRoutes]);

  /* ── Discard an optimization ── */
  const discardRoute = useCallback((routeId: string) => {
    setOptimizedMap((prev) => {
      const next = { ...prev };
      delete next[routeId];
      return next;
    });
    if (selectedRouteId === routeId) setSelectedRouteId(null);
  }, [selectedRouteId]);

  /* ── Aggregate metrics across all optimized routes ── */
  const aggregateMetrics: AlgoMetrics = Object.values(optimizedMap).reduce(
    (acc, opt) => {
      if (!opt?.result?.metrics) return acc;
      const m = opt.result.metrics;
      return {
        stopsSkipped: acc.stopsSkipped + m.stopsSkipped,
        kmSaved: acc.kmSaved + m.kmSaved,
        fuelSavedL: acc.fuelSavedL + m.fuelSavedL,
        co2AvoidedKg: acc.co2AvoidedKg + m.co2AvoidedKg,
        hoursSaved: acc.hoursSaved + m.hoursSaved,
      };
    },
    { stopsSkipped: 0, kmSaved: 0, fuelSavedL: 0, co2AvoidedKg: 0, hoursSaved: 0 },
  );

  /* ── All bins across loaded routes (for the map) ── */
  const allBins: (AlgoBin & { routeColor: string; routeName: string })[] = loadedRoutes.flatMap(
    (r) => r.bins.map((b) => ({ ...b, routeColor: r.color, routeName: r.name })),
  );

  return {
    // Route catalogue
    allRoutes,
    routesLoading,

    // Loaded routes
    loadedRoutes,
    addRoute,
    removeRoute,

    // Optimization
    optimizedMap,
    isOptimizing,
    optimizeStatus,
    runOptimize,
    acceptRoute,
    discardRoute,

    // Controls
    threshold,
    setThreshold,
    intensity,
    setIntensity,

    // Selection
    selectedRouteId,
    setSelectedRouteId,

    // Derived
    aggregateMetrics,
    allBins,
    predictions,

    // Ace AI insight
    aceInsight,
    aceInsightLoading,
  };
}

export type { AlgoBin, AlgoMetrics, Prediction };
