import React, { useMemo, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { BinCharacter } from "./SvgIcons";
import type { OptimizedResult, LoadedRoute } from "@/hooks/useSmartRoute";

export interface Bin {
  id: number;
  stringId: string;
  name: string;
  lat: number;
  lng: number;
  fillLevel: number;
  lastCollected: string;
}

export type OptimizeState = "idle" | "loading" | "showing-original" | "optimized";

interface SmartRouteMapProps {
  bins: Bin[];
  threshold: number;
  optimizeState: OptimizeState;
  optimizedMap: Record<string, OptimizedResult>;
  loadedRoutes: LoadedRoute[];
  selectedRouteId: string | null;
  onRouteSelect: (routeId: string) => void;
  focusRouteId?: string | null;
  isForecast?: boolean;
}

const getOverflowTime = (fillLevel: number): string => {
  if (fillLevel >= 90) return "~4 hours";
  if (fillLevel >= 70) return "~12 hours";
  if (fillLevel >= 50) return "~1.5 days";
  if (fillLevel >= 30) return "~3 days";
  return "~5+ days";
};

function getBinSvg(fillLevel: number, meetsThreshold: boolean): string {
  const bodyColor = meetsThreshold ? "#F97B8B" : "#7EC8E3";
  const lidColor = meetsThreshold ? "#E8616F" : "#5BA8C8";
  const cheekColor = meetsThreshold ? "#FDD" : "#D4F0FF";
  const sparkleColor = meetsThreshold ? "#FFD57E" : "#C9B6FF";

  return `<svg width="36" height="44" viewBox="0 0 44 50" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="22" cy="48" rx="12" ry="2.2" fill="#c4b5fd" opacity="0.18"/>
    <rect x="8" y="16" width="28" height="26" rx="10" fill="${bodyColor}"/>
    <rect x="11" y="18" width="10" height="6" rx="4" fill="white" opacity="0.18"/>
    <rect x="6" y="11" width="32" height="7" rx="3.5" fill="${lidColor}"/>
    <rect x="17" y="5.5" width="10" height="7.5" rx="4" fill="${lidColor}"/>
    <rect x="19" y="7.5" width="6" height="2.2" rx="1.1" fill="white" opacity="0.3"/>
    <ellipse cx="16.5" cy="27" rx="3.8" ry="4" fill="white"/>
    <ellipse cx="27.5" cy="27" rx="3.8" ry="4" fill="white"/>
    <circle cx="16.5" cy="27.8" r="2.2" fill="#2d2b42"/>
    <circle cx="27.5" cy="27.8" r="2.2" fill="#2d2b42"/>
    <circle cx="15.2" cy="26.3" r="1.1" fill="white"/>
    <circle cx="26.2" cy="26.3" r="1.1" fill="white"/>
    <ellipse cx="11.5" cy="31.5" rx="3" ry="1.8" fill="${cheekColor}" opacity="0.6"/>
    <ellipse cx="32.5" cy="31.5" rx="3" ry="1.8" fill="${cheekColor}" opacity="0.6"/>
    <circle cx="35" cy="14" r="1.5" fill="${sparkleColor}" opacity="0.7"/>
    <path d="M17.5 34 Q22 38 26.5 34" stroke="white" stroke-width="1.8" fill="none" stroke-linecap="round"/>
  </svg>`;
}

/* Auto-zoom to the bounding box of all visible bins whenever they change */
const MapController: React.FC<{ bins: Bin[] }> = ({ bins }) => {
  const map = useMap();
  const prevCountRef = useRef(0);

  useEffect(() => {
    if (bins.length === 0) return;
    if (bins.length <= prevCountRef.current) return;
    prevCountRef.current = bins.length;

    const bounds = L.latLngBounds(bins.map((b) => [b.lat, b.lng] as L.LatLngTuple));
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 });
    }
  }, [bins, map]);

  return null;
};

/* Zoom to a specific route's bins when focusRouteId changes */
const MapFocusController: React.FC<{ focusRouteId: string | null; loadedRoutes: LoadedRoute[] }> = ({
  focusRouteId,
  loadedRoutes,
}) => {
  const map = useMap();
  const prevFocusRef = useRef<string | null>(null);

  useEffect(() => {
    if (!focusRouteId || focusRouteId === prevFocusRef.current) return;
    prevFocusRef.current = focusRouteId;

    const route = loadedRoutes.find((r) => r.id === focusRouteId);
    if (!route || route.bins.length === 0) return;

    const bounds = L.latLngBounds(route.bins.map((b) => [b.lat, b.lng] as L.LatLngTuple));
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [56, 56], maxZoom: 15 });
    }
  }, [focusRouteId, loadedRoutes, map]);

  return null;
};

const SmartRouteMap: React.FC<SmartRouteMapProps> = ({
  bins, threshold, optimizeState, optimizedMap, loadedRoutes, selectedRouteId, onRouteSelect, focusRouteId, isForecast,
}) => {
  const icons = useMemo(() => {
    const map = new Map<string, L.DivIcon>();
    bins.forEach((b) => {
      const meets = b.fillLevel >= threshold;
      const key = `${b.id}-${meets}`;
      if (!map.has(key)) {
        map.set(
          key,
          L.divIcon({
            html: getBinSvg(b.fillLevel, meets),
            className: "",
            iconSize: [40, 46],
            iconAnchor: [20, 46],
            popupAnchor: [0, -46],
          })
        );
      }
    });
    return map;
  }, [bins, threshold]);

  // Collect all OSRM road polylines from optimized routes
  const roadPolylines = useMemo(() => {
    const lines: { positions: L.LatLngTuple[]; color: string; routeId: string }[] = [];
    for (const route of loadedRoutes) {
      const opt = optimizedMap[route.id];
      if (!opt) continue;
      opt.roadPolylines.forEach((poly, i) => {
        const color = opt.result.vehicleRoutes[i]?.color || route.color;
        lines.push({
          positions: poly as L.LatLngTuple[],
          color,
          routeId: route.id,
        });
      });
    }
    return lines;
  }, [optimizedMap, loadedRoutes]);

  // Original route polylines — use OSRM road polyline when available, fallback to straight lines
  const originalPolylines = useMemo(() => {
    const lines: { positions: L.LatLngTuple[]; color: string; routeId: string }[] = [];
    for (const route of loadedRoutes) {
      if (route.originalRoadPolyline && route.originalRoadPolyline.length > 0) {
        lines.push({
          positions: route.originalRoadPolyline as L.LatLngTuple[],
          color: route.color,
          routeId: route.id,
        });
      } else if (route.bins.length >= 2) {
        const pts: L.LatLngTuple[] = [
          [route.depot.lat, route.depot.lng],
          ...route.bins.map((b) => [b.lat, b.lng] as L.LatLngTuple),
          [route.depot.lat, route.depot.lng],
        ];
        lines.push({ positions: pts, color: route.color, routeId: route.id });
      }
    }
    return lines;
  }, [loadedRoutes]);

  const hasOptimized = Object.keys(optimizedMap).length > 0;

  return (
    <MapContainer
      center={[43.6525, -79.3800]}
      zoom={13}
      scrollWheelZoom={false}
      className="h-full w-full rounded-2xl"
      style={{ zIndex: 0 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />
      <MapController bins={bins} />
      <MapFocusController focusRouteId={focusRouteId ?? null} loadedRoutes={loadedRoutes} />

      {/* Original route lines — always visible as dashed, dimmed when optimized */}
      {originalPolylines.map((line, i) => (
        <Polyline
          key={`orig-${i}`}
          positions={line.positions}
          color={line.color}
          weight={hasOptimized ? 2 : 3}
          opacity={hasOptimized ? 0.3 : 0.6}
          dashArray="7 5"
        />
      ))}

      {/* Optimized road polylines (solid, shown after optimization) */}
      {hasOptimized && optimizeState === "optimized" && roadPolylines.map((line, i) => (
        <Polyline
          key={`opt-${i}`}
          positions={line.positions}
          color={line.color}
          weight={selectedRouteId === line.routeId ? 6 : 4}
          opacity={0.85}
          eventHandlers={{
            click: () => onRouteSelect(line.routeId),
          }}
        />
      ))}

      {/* Bin markers */}
      {bins.map((bin) => {
        const meets = bin.fillLevel >= threshold;
        const icon = icons.get(`${bin.id}-${meets}`);

        return (
          <Marker key={bin.id} position={[bin.lat, bin.lng]} icon={icon}>
            <Popup>
              <div className="p-4 min-w-[220px]">
                <div className="flex items-center gap-3 mb-3">
                  <BinCharacter fillLevel={bin.fillLevel} meetsThreshold={meets} size={36} />
                  <div>
                    <h3 className="font-bold text-sm text-foreground">{bin.name}</h3>
                    <span
                      className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                        meets
                          ? "bg-smartroute-red/15 text-smartroute-red"
                          : "bg-primary/10 text-primary"
                      }`}
                    >
                      {meets ? "Collect" : "Skip"}
                    </span>
                  </div>
                </div>
                <div className="mb-2">
                  <div className="text-xs text-muted-foreground mb-1">Fill Level</div>
                  <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{
                        width: `${bin.fillLevel}%`,
                        backgroundColor: meets ? "#F97B8B" : "#7EC8E3",
                      }}
                    />
                  </div>
                  <div className="text-right text-xs font-bold mt-0.5" style={{ color: meets ? "#F97B8B" : "#7EC8E3" }}>
                    {bin.fillLevel}%
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Last collected:</span> {bin.lastCollected}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  <span className="font-medium text-foreground">Est. overflow:</span> {getOverflowTime(bin.fillLevel)}
                </div>
                <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border">
                  <span className={`w-1.5 h-1.5 rounded-full ${isForecast ? "bg-amber-400" : "bg-green-500"}`} />
                  <span className="text-[10px] text-muted-foreground">
                    {isForecast ? "Predicted fill level" : "Sensor data · updated 15 min ago"}
                  </span>
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
};

export default SmartRouteMap;
