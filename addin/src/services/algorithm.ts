/**
 * Typed wrapper around the global window.SmartRouteAlgo IIFE
 * loaded via <script src="./smartroute-algo.js"> in index.html.
 */

/* ── Result types ── */

export interface AlgoMetrics {
  stopsSkipped: number;
  kmSaved: number;
  fuelSavedL: number;
  co2AvoidedKg: number;
  hoursSaved: number;
}

export interface VehicleRoute {
  points: { lat: number; lng: number }[];
  color: string;
}

export interface AlgoBin {
  id: string;
  name: string;
  lat: number;
  lng: number;
  fillLevel: number;
}

export interface AlgoResult {
  optimizedBins: AlgoBin[];
  skippedBins: AlgoBin[];
  insertedBins: AlgoBin[];
  vehicleRoutes: VehicleRoute[];
  originalPoints: { lat: number; lng: number }[];
  metrics: AlgoMetrics;
}

export interface Prediction {
  binId: string;
  fillRatePerDay: number;
  daysUntilThreshold: number;
  daysUntilFull: number;
  predictedThresholdDate: string | null;
  predictedFullDate: string | null;
  collectionIntervalDays: number | null;
  recommendedCollectionDays: string[];
  confidence: "high" | "medium" | "low";
  confidenceStdDev: number;
  inferredFromFleet: boolean;
}

export interface AlgoOptions {
  threshold: number;       // 0–100 fill-level cutoff
  intensity: number;       // 0–1 selective-insertion aggressiveness
  vehicleCapacity?: number;
  vehicles?: { latitude: number; longitude: number }[];
}

/* ── Global type declaration ── */

declare global {
  interface Window {
    SmartRouteAlgo?: {
      run: (bins: AlgoBin[], depot: { lat: number; lng: number }, options: AlgoOptions) => AlgoResult;
      runAsync: (bins: AlgoBin[], depot: { lat: number; lng: number }, options: AlgoOptions, callback: (result: AlgoResult) => void) => void;
      predict: (collectionLogs: unknown[], bins: AlgoBin[], options: { threshold: number }) => Prediction[];
    };
    SMARTROUTE_CONFIG?: { googleMapsKey: string };
  }
}

/* ── Public API ── */

export function runOptimization(
  bins: AlgoBin[],
  depot: { lat: number; lng: number },
  options: AlgoOptions,
): Promise<AlgoResult> {
  return new Promise((resolve, reject) => {
    if (!window.SmartRouteAlgo) {
      reject(new Error("SmartRouteAlgo not loaded"));
      return;
    }
    window.SmartRouteAlgo.runAsync(bins, depot, options, resolve);
  });
}

export function runOptimizationSync(
  bins: AlgoBin[],
  depot: { lat: number; lng: number },
  options: AlgoOptions,
): AlgoResult {
  if (!window.SmartRouteAlgo) {
    throw new Error("SmartRouteAlgo not loaded");
  }
  return window.SmartRouteAlgo.run(bins, depot, options);
}

export function predictFillLevels(
  collectionLogs: unknown[],
  bins: AlgoBin[],
  threshold: number,
): Prediction[] {
  if (!window.SmartRouteAlgo) return [];
  return window.SmartRouteAlgo.predict(collectionLogs, bins, { threshold });
}
