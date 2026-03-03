import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer } from
"recharts";
import SmartRouteMap from "@/components/SmartRouteMap";
import RouteOverlayPanel from "@/components/RouteOverlayPanel";
import OptimizeReviewModal from "@/components/OptimizeReviewModal";
import {
  TruckIcon,
  SearchIcon, CalendarIcon, CheckIcon, CloseIcon, SpinnerIcon,
  PinIcon } from
"@/components/SvgIcons";
import { useSmartRoute } from "@/hooks/useSmartRoute";
import type { GeotabRouteRef } from "@/services/geotabApi";
import { toast } from "@/hooks/use-toast";
import iconClock from "@/assets/icon-clock.png";
import iconFuel from "@/assets/icon-fuel.png";
import iconCo2 from "@/assets/icon-co2.png";
import iconStop from "@/assets/icon-stop.png";

// ═══════════════════════════════════════════════
// Static chart data (illustrative — kept as-is)
// ═══════════════════════════════════════════════

const fuelChartData = [
{ week: "Week 1", thisMonth: 42, lastMonth: 38 },
{ week: "Week 2", thisMonth: 51, lastMonth: 44 },
{ week: "Week 3", thisMonth: 58, lastMonth: 49 },
{ week: "Week 4", thisMonth: 68, lastMonth: 56 }];

const stopsChartData = [
{ week: "W1", skipped: 12 },
{ week: "W2", skipped: 15 },
{ week: "W3", skipped: 19 },
{ week: "W4", skipped: 22 },
{ week: "W5", skipped: 26 },
{ week: "W6", skipped: 31 }];

// ═══════════════════════════════════════════════
// Animated number hook
// ═══════════════════════════════════════════════

function useAnimatedNumber(target: number, duration = 500): number {
  const [display, setDisplay] = useState(target);
  const prevRef = useRef(target);

  useEffect(() => {
    const from = prevRef.current;
    prevRef.current = target;
    if (from === target) return;

    const start = performance.now();
    let raf: number;

    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (target - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return display;
}

// ═══════════════════════════════════════════════
// Custom Bin Threshold Slider
// ═══════════════════════════════════════════════

const BinThresholdSlider: React.FC<{value: number;onChange: (v: number) => void;}> = ({
  value,
  onChange
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const updateValue = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(100, (clientX - rect.left) / rect.width * 100));
      onChange(Math.round(pct));
    },
    [onChange]
  );

  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging.current) return;
      const x = "touches" in e ? e.touches[0].clientX : e.clientX;
      updateValue(x);
    };
    const onUp = () => {
      isDragging.current = false;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove);
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [updateValue]);

  const fillH = value / 100 * 20;
  const fillY = 36 - fillH;

  return (
    <div className="relative pt-14 pb-2 select-none">
      <div
        ref={trackRef}
        className="h-3 bg-muted rounded-full cursor-pointer relative"
        onMouseDown={(e) => {
          isDragging.current = true;
          updateValue(e.clientX);
        }}
        onTouchStart={(e) => {
          isDragging.current = true;
          updateValue(e.touches[0].clientX);
        }}>

        {/* Filled track */}
        <div
          className="absolute h-full rounded-full bg-primary transition-[width] duration-75"
          style={{ width: `${value}%` }} />

        {/* Bin thumb */}
        <div
          className="absolute -top-12"
          style={{ left: `${value}%`, transform: "translateX(-50%)" }}>

          <svg width="36" height="44" viewBox="0 0 44 50" className="drop-shadow-md cursor-grab active:cursor-grabbing">
            <ellipse cx="22" cy="48" rx="12" ry="2.2" fill="#c4b5fd" opacity="0.18" />
            <rect x="8" y="16" width="28" height="26" rx="10" fill="#7EC8E3" />
            <rect x="11" y="18" width="10" height="6" rx="4" fill="white" opacity="0.18" />
            <rect
              x="11"
              y={fillY}
              width="22"
              height={fillH + 2}
              rx="6"
              fill="#B5E8D5"
              opacity="0.55" />

            <rect x="6" y="11" width="32" height="7" rx="3.5" fill="#5BA8C8" />
            <rect x="17" y="5.5" width="10" height="7.5" rx="4" fill="#5BA8C8" />
            <rect x="19" y="7.5" width="6" height="2.2" rx="1.1" fill="white" opacity="0.3" />
            <ellipse cx="16.5" cy="27" rx="3.8" ry="4" fill="white" />
            <ellipse cx="27.5" cy="27" rx="3.8" ry="4" fill="white" />
            <circle cx="16.5" cy="27.8" r="2.2" fill="#2d2b42" />
            <circle cx="27.5" cy="27.8" r="2.2" fill="#2d2b42" />
            <circle cx="15.2" cy="26.3" r="1.1" fill="white" />
            <circle cx="26.2" cy="26.3" r="1.1" fill="white" />
            <ellipse cx="11.5" cy="31.5" rx="3" ry="1.8" fill="#D4F0FF" opacity="0.6" />
            <ellipse cx="32.5" cy="31.5" rx="3" ry="1.8" fill="#D4F0FF" opacity="0.6" />
            <circle cx="35" cy="14" r="1.5" fill="#C9B6FF" opacity="0.7" />
            <path d="M17.5 34 Q22 38 26.5 34" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    </div>);

};

// ═══════════════════════════════════════════════
// Stat Card Component
// ═══════════════════════════════════════════════

interface StatCardProps {
  icon: React.ReactNode;
  value: number;
  unit: string;
  label: string;
  decimals?: number;
}

const StatCard: React.FC<StatCardProps> = ({ icon, value, unit, label, decimals = 1 }) => {
  const animated = useAnimatedNumber(value);
  return (
    <div className="bg-card shadow-sm p-5 flex flex-col items-center text-center rounded">
      <div className="mb-2">{icon}</div>
      <div className="text-2xl font-extrabold text-foreground">
        {animated.toFixed(decimals)}
        <span className="text-sm font-semibold text-muted-foreground ml-1">{unit}</span>
      </div>
      <div className="text-xs text-muted-foreground mt-1 font-medium">{label}</div>
    </div>);

};

// ═══════════════════════════════════════════════
// Main Dashboard
// ═══════════════════════════════════════════════

const Index: React.FC = () => {
  const sr = useSmartRoute();
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const MAX_VISIBLE_CHIPS = 2;
  const [startDate, setStartDate] = useState("2026-02-15");
  const [endDate, setEndDate] = useState("2026-03-02");
  const [showReviewModal, setShowReviewModal] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement>(null);

  // Determine optimize button state from hook
  const optimizeState = sr.isOptimizing ? "loading" as const
    : Object.keys(sr.optimizedMap).length > 0 ? "optimized" as const
    : "idle" as const;

  // Per-route or aggregate metrics
  const displayMetrics = useMemo(() => {
    if (sr.selectedRouteId && sr.optimizedMap[sr.selectedRouteId]) {
      return sr.optimizedMap[sr.selectedRouteId].result.metrics;
    }
    return sr.aggregateMetrics;
  }, [sr.selectedRouteId, sr.optimizedMap, sr.aggregateMetrics]);

  const { hoursSaved, fuelSavedL: fuelSaved, co2AvoidedKg: co2Reduced, stopsSkipped } = displayMetrics;

  // Search filtering
  const filteredRoutes = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return sr.allRoutes.slice(0, 10);
    return sr.allRoutes.filter((r) => (r.name || "").toLowerCase().includes(q));
  }, [searchQuery, sr.allRoutes]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  const handleOptimize = async () => {
    if (sr.isOptimizing || sr.loadedRoutes.length === 0) return;
    await sr.runOptimize();
    setShowReviewModal(true);
  };

  const handleSelectRoute = (route: GeotabRouteRef) => {
    setShowDropdown(false);
    setSearchQuery("");
    sr.addRoute(route);
  };

  const removeRoute = (routeId: string) => {
    sr.removeRoute(routeId);
    if (sr.loadedRoutes.length - 1 <= MAX_VISIBLE_CHIPS) setFiltersExpanded(false);
  };

  // Selected route info for overlay
  const selectedRoute = sr.selectedRouteId
    ? sr.loadedRoutes.find((r) => r.id === sr.selectedRouteId)
    : null;
  const selectedOpt = sr.selectedRouteId
    ? sr.optimizedMap[sr.selectedRouteId]
    : null;

  // Build bins array for the map (from all loaded routes)
  const mapBins = sr.allBins.map((b, i) => ({
    id: i,
    stringId: b.id,
    name: b.name,
    lat: b.lat,
    lng: b.lng,
    fillLevel: b.fillLevel,
    lastCollected: "N/A",
  }));

  return (
    <div className="min-h-screen bg-background">
      {/* ══════ TOP BAR ══════ */}
      <header className="bg-card shadow-sm sticky top-0 z-50">
        <div className="px-6 py-2.5 flex items-center gap-2.5">
          <TruckIcon size={28} color="#7EC8E3" />
          <span className="text-xl font-extrabold text-foreground tracking-tight">smart route</span>
          <span className="text-[10px] font-bold text-muted-foreground px-2 py-0.5 rounded-full uppercase tracking-wider bg-muted">
            beta
          </span>
        </div>
      </header>

      {/* ══════ MAIN CONTENT ══════ */}
      <main className="p-6">
        <div className="flex gap-6" style={{ minHeight: "520px" }}>
          {/* LEFT — Controls + Map */}
          <div className="w-[65%] flex flex-col gap-3">
            {/* Controls bar — adaptive layout */}
            {sr.loadedRoutes.length === 0 ? (
              /* ── Single-row: no tags ── */
              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-xs" ref={searchWrapRef}>
                  <SearchIcon size={16} color="hsl(240, 5%, 55%)" className="absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search routes..."
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setShowDropdown(true); }}
                    onFocus={() => setShowDropdown(true)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-muted text-sm placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30 transition" />
                  {showDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-card shadow-lg rounded-xl border border-border z-50 max-h-64 overflow-y-auto">
                      {filteredRoutes.length === 0 ? (
                        <div className="px-4 py-3 text-xs text-muted-foreground">No routes found</div>
                      ) : filteredRoutes.slice(0, 8).map((route) => {
                        const added = sr.loadedRoutes.some((r) => r.id === route.id);
                        return (
                          <button
                            key={route.id}
                            disabled={added}
                            onClick={() => handleSelectRoute(route)}
                            className={`w-full text-left px-4 py-2.5 hover:bg-muted/60 transition flex items-center gap-2.5 ${added ? "opacity-50" : ""}`}>
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: added ? "#7EC8E3" : "#d1d5db" }} />
                            <div>
                              <div className="text-sm font-medium text-foreground">{route.name || "Unnamed Route"}{added ? " \u2713" : ""}</div>
                              <div className="text-[10px] text-muted-foreground">{route.bins ? `${route.bins.length} stops` : "Click to load"}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <div className="relative">
                    <CalendarIcon size={14} color="hsl(240, 5%, 55%)" className="absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="pl-8 pr-2 py-1.5 rounded-lg bg-muted text-xs outline-none focus:ring-2 focus:ring-primary/30 transition" />
                  </div>
                  <span className="text-muted-foreground text-xs">to</span>
                  <div className="relative">
                    <CalendarIcon size={14} color="hsl(240, 5%, 55%)" className="absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="pl-8 pr-2 py-1.5 rounded-lg bg-muted text-xs outline-none focus:ring-2 focus:ring-primary/30 transition" />
                  </div>
                </div>
              </div>
            ) : (
              /* ── Two-column: with tags ── */
              <div className="grid grid-cols-[1fr_auto] gap-4">
                {/* Left: search + chips */}
                <div className="space-y-2">
                  <div className="relative" ref={searchWrapRef}>
                    <SearchIcon size={16} color="hsl(240, 5%, 55%)" className="absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search routes..."
                      value={searchQuery}
                      onChange={(e) => { setSearchQuery(e.target.value); setShowDropdown(true); }}
                      onFocus={() => setShowDropdown(true)}
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-muted text-sm placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30 transition" />
                    {showDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-card shadow-lg rounded-xl border border-border z-50 max-h-64 overflow-y-auto">
                        {filteredRoutes.length === 0 ? (
                          <div className="px-4 py-3 text-xs text-muted-foreground">No routes found</div>
                        ) : filteredRoutes.slice(0, 8).map((route) => {
                          const added = sr.loadedRoutes.some((r) => r.id === route.id);
                          return (
                            <button
                              key={route.id}
                              disabled={added}
                              onClick={() => handleSelectRoute(route)}
                              className={`w-full text-left px-4 py-2.5 hover:bg-muted/60 transition flex items-center gap-2.5 ${added ? "opacity-50" : ""}`}>
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: added ? "#7EC8E3" : "#d1d5db" }} />
                              <div>
                                <div className="text-sm font-medium text-foreground">{route.name || "Unnamed Route"}{added ? " \u2713" : ""}</div>
                                <div className="text-[10px] text-muted-foreground">{route.bins ? `${route.bins.length} stops` : "Click to load"}</div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {(filtersExpanded ? sr.loadedRoutes : sr.loadedRoutes.slice(0, MAX_VISIBLE_CHIPS)).map((r) =>
                    <button
                      key={r.id}
                      onClick={() => removeRoute(r.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition shrink-0">
                        <span className="w-2 h-2 rounded-full" style={{ background: r.color }} />
                        {r.name}
                        <CloseIcon size={12} color="hsl(200, 70%, 55%)" />
                      </button>
                    )}
                    {sr.loadedRoutes.length > MAX_VISIBLE_CHIPS && !filtersExpanded && (
                      <button
                        onClick={() => setFiltersExpanded(true)}
                        className="px-3 py-1.5 rounded-full bg-muted text-muted-foreground text-xs font-semibold hover:bg-muted/80 transition shrink-0">
                        +{sr.loadedRoutes.length - MAX_VISIBLE_CHIPS} more
                      </button>
                    )}
                    {filtersExpanded && sr.loadedRoutes.length > MAX_VISIBLE_CHIPS && (
                      <button
                        onClick={() => setFiltersExpanded(false)}
                        className="px-3 py-1.5 rounded-full bg-muted text-muted-foreground text-xs font-semibold hover:bg-muted/80 transition shrink-0">
                        Show less
                      </button>
                    )}
                  </div>
                </div>
                {/* Right: scheduled routes dates */}
                <div className="flex flex-col gap-1.5 min-w-[160px]">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    Scheduled Routes
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-muted-foreground w-8">From</span>
                    <div className="relative flex-1">
                      <CalendarIcon size={14} color="hsl(240, 5%, 55%)" className="absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full pl-8 pr-2 py-1.5 rounded-lg bg-muted text-xs outline-none focus:ring-2 focus:ring-primary/30 transition" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-muted-foreground w-8">To</span>
                    <div className="relative flex-1">
                      <CalendarIcon size={14} color="hsl(240, 5%, 55%)" className="absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full pl-8 pr-2 py-1.5 rounded-lg bg-muted text-xs outline-none focus:ring-2 focus:ring-primary/30 transition" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Optimize status */}
            {sr.optimizeStatus && (
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                {sr.isOptimizing && <SpinnerIcon size={14} color="hsl(200, 70%, 55%)" />}
                {sr.optimizeStatus}
              </div>
            )}

            {/* Map */}
            <div className="relative flex-1 min-h-0">
              {/* Onboarding overlay — shown when no routes loaded */}
              {sr.loadedRoutes.length === 0 && (
                <div className="absolute inset-0 z-[500] flex items-center justify-center pointer-events-none">
                  <div className="bg-card/95 backdrop-blur-sm rounded-2xl shadow-xl p-8 max-w-sm w-full mx-4 pointer-events-auto">
                    <h2 className="text-base font-extrabold text-foreground mb-1 text-center">
                      Get started
                    </h2>
                    <p className="text-xs text-muted-foreground text-center mb-6">
                      Three steps to optimize your waste collection routes
                    </p>
                    <div className="flex flex-col gap-4">
                      {[
                        { step: "1", icon: <SearchIcon size={18} color="#7EC8E3" />, label: "Search & select a route", sub: "Use the search bar above to add routes to the map" },
                        { step: "2", icon: <span className="text-[#C9B6FF] text-lg font-extrabold leading-none">%</span>, label: "Adjust the fill threshold", sub: "Set the bin fill level that triggers collection" },
                        { step: "3", icon: <TruckIcon size={18} color="#7EC8E3" />, label: 'Click "Optimize & See Savings"', sub: "The algorithm will plan the smartest routes" },
                      ].map(({ step, icon, label, sub }) => (
                        <div key={step} className="flex items-start gap-4">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                            {icon}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-foreground">{label}</div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div className="bg-card shadow-sm overflow-hidden rounded h-full">
                <SmartRouteMap
                  bins={mapBins}
                  threshold={sr.threshold}
                  optimizeState={optimizeState}
                  optimizedMap={sr.optimizedMap}
                  loadedRoutes={sr.loadedRoutes}
                  selectedRouteId={sr.selectedRouteId}
                  onRouteSelect={sr.setSelectedRouteId}
                />
              </div>
              <div className="absolute top-4 right-4 z-[1000] bg-card/90 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center gap-1.5 shadow-sm">
                <PinIcon size={14} color="#7EC8E3" />
                <span className="text-xs font-semibold text-foreground">
                  {sr.loadedRoutes.length > 0
                    ? `${sr.loadedRoutes.length} route${sr.loadedRoutes.length > 1 ? "s" : ""} \u00B7 ${sr.allBins.length} bins`
                    : "Route Preview"}
                </span>
              </div>
              {/* Route overlay panel (accept/discard) */}
              {selectedRoute && selectedOpt && (
                <RouteOverlayPanel
                  routeName={selectedRoute.name}
                  routeColor={selectedRoute.color}
                  metrics={selectedOpt.result.metrics}
                  accepted={selectedOpt.accepted}
                  onAccept={async () => {
                    const routeName = await sr.acceptRoute(sr.selectedRouteId!);
                    if (routeName) {
                      toast({
                        title: "Route accepted",
                        description: `"${routeName}" has been saved as a Geotab route.`,
                      });
                    } else {
                      toast({
                        title: "Failed to save route",
                        description: "Could not write the optimized route to Geotab. Please try again.",
                        variant: "destructive",
                      });
                    }
                  }}
                  onDiscard={() => sr.discardRoute(sr.selectedRouteId!)}
                  onClose={() => sr.setSelectedRouteId(null)}
                />
              )}
            </div>
          </div>

          {/* RIGHT — Controls */}
          <div className="w-[35%] flex flex-col gap-4">
            {/* Combined Threshold + Intensity Card */}
            <div className="bg-card shadow-sm p-6 rounded">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                Bin Threshold
              </label>
              <BinThresholdSlider value={sr.threshold} onChange={sr.setThreshold} />
              <div className="text-center mt-2">
                <span className="text-4xl font-extrabold text-primary">{sr.threshold}</span>
                <span className="text-lg font-bold text-primary">%</span>
              </div>
              <p className="text-[11px] text-muted-foreground text-center mt-1">
                Bins at or above this fill level will be collected
              </p>

              {/* Intensity slider within same card */}
              <div className="mt-5 pt-4 border-t border-border">
                <div className="flex items-center gap-1.5">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                    Route Intensity
                  </label>
                  {/* Info tooltip */}
                  <div className="relative group">
                    <button
                      type="button"
                      className="w-4 h-4 rounded-full bg-muted text-muted-foreground text-[10px] font-bold flex items-center justify-center hover:bg-primary/20 transition"
                      aria-label="Route Intensity explanation"
                    >
                      i
                    </button>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-foreground text-background text-[11px] rounded-lg px-3 py-2 shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 leading-relaxed">
                      Controls how aggressively near-threshold bins are added. Higher = more stops collected when detour cost is cheap. Lower = only mandatory bins above the threshold.
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-foreground" />
                    </div>
                  </div>
                </div>
                <div className="mt-3 mb-2">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={sr.intensity}
                    onChange={(e) => sr.setIntensity(Number(e.target.value))}
                    className="w-full accent-primary h-2 rounded-full appearance-none bg-muted cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, hsl(200, 70%, 55%) ${sr.intensity}%, hsl(214, 20%, 90%) ${sr.intensity}%)`,
                    }}
                  />
                </div>
                <div className="text-center">
                  <span className="text-2xl font-extrabold text-primary">{sr.intensity}</span>
                  <span className="text-sm font-bold text-primary">%</span>
                </div>
                <p className="text-[11px] text-muted-foreground text-center mt-1">
                  Higher = collect more sub-threshold bins with low detour cost
                </p>
              </div>
            </div>

            {/* Optimize Button — above stat cards */}
            <button
              onClick={handleOptimize}
              disabled={sr.isOptimizing || sr.loadedRoutes.length === 0}
              className="w-full py-3.5 bg-gradient-to-r from-[#7EC8E3] to-[#C9B6FF] text-white font-bold text-sm flex items-center justify-center gap-2.5 hover:opacity-90 transition disabled:opacity-60 shadow-md rounded">
              {sr.isOptimizing ? (
                <>
                  <SpinnerIcon size={18} color="white" />
                  Optimizing...
                </>
              ) : optimizeState === "optimized" ? (
                <>
                  <CheckIcon size={18} color="white" />
                  Optimized! Review again
                </>
              ) : (
                <>
                  <TruckIcon size={18} color="white" />
                  Optimize &amp; See Savings
                </>
              )}
            </button>

            {/* Metrics context label */}
            {sr.selectedRouteId && sr.optimizedMap[sr.selectedRouteId] && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: sr.loadedRoutes.find((r) => r.id === sr.selectedRouteId)?.color }}
                  />
                  <span className="font-semibold">
                    {sr.loadedRoutes.find((r) => r.id === sr.selectedRouteId)?.name} metrics
                  </span>
                </div>
                <button
                  onClick={() => sr.setSelectedRouteId(null)}
                  className="text-xs text-primary hover:underline"
                >
                  Show all
                </button>
              </div>
            )}

            {/* Stat Cards */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                icon={<img src={iconClock} alt="clock" style={{ width: 36, height: 36, imageRendering: "pixelated" }} />}
                value={hoursSaved}
                unit="hrs"
                label="Hours Saved" />

              <StatCard
                icon={<img src={iconFuel} alt="fuel" style={{ width: 36, height: 36, imageRendering: "pixelated" }} />}
                value={fuelSaved}
                unit="L"
                label="Fuel Saved" />

              <StatCard
                icon={<img src={iconCo2} alt="leaf" style={{ width: 36, height: 36, imageRendering: "pixelated" }} />}
                value={co2Reduced}
                unit="kg"
                label="CO&#x2082; Reduced" />

              <StatCard
                icon={<img src={iconStop} alt="stop" style={{ width: 36, height: 36, imageRendering: "pixelated" }} />}
                value={stopsSkipped}
                unit=""
                label="Stops Skipped"
                decimals={0} />
            </div>
          </div>
        </div>

        {/* ══════ ACE INSIGHT BANNER ══════ */}
        {(sr.aceInsightLoading || sr.aceInsight) && (
          <div className="mt-6 bg-gradient-to-r from-[#7EC8E3]/10 to-[#C9B6FF]/10 border border-[#C9B6FF]/30 rounded-xl px-5 py-4 flex items-start gap-3">
            {/* AI sparkle icon */}
            <div className="shrink-0 mt-0.5">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 2L11.5 7.5H17L12.5 11L14 16.5L10 13.5L6 16.5L7.5 11L3 7.5H8.5L10 2Z" fill="url(#sparkle-grad)" />
                <defs>
                  <linearGradient id="sparkle-grad" x1="3" y1="2" x2="17" y2="16.5" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#7EC8E3" />
                    <stop offset="1" stopColor="#C9B6FF" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div className="flex-1">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
                Geotab Ace AI Insight
              </div>
              {sr.aceInsightLoading && !sr.aceInsight ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <SpinnerIcon size={12} color="hsl(200, 70%, 55%)" />
                  Generating fleet insight...
                </div>
              ) : (
                <p className="text-sm text-foreground leading-relaxed">{sr.aceInsight}</p>
              )}
            </div>
          </div>
        )}

        {/* ══════ CHARTS ══════ */}
        <div className="grid grid-cols-2 gap-6 mt-6">
          {/* Fuel Chart */}
          <div className="bg-card shadow-sm p-6 rounded">
            <h3 className="text-sm font-bold text-foreground mb-1">Fuel Saved This Month vs Last</h3>
            <p className="text-xs text-muted-foreground mb-4">
              You saved 10% more fuel this month than last
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={fuelChartData}>
                <CartesianGrid strokeDasharray="4 4" stroke="hsl(214, 20%, 90%)" />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: "hsl(215, 16%, 47%)" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(215, 16%, 47%)" }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    border: "none",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                    fontSize: "12px"
                  }} />
                <Line
                  type="monotone"
                  dataKey="thisMonth"
                  stroke="#7EC8E3"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "#7EC8E3" }}
                  name="This Month" />
                <Line
                  type="monotone"
                  dataKey="lastMonth"
                  stroke="#E0D6F6"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#E0D6F6" }}
                  strokeDasharray="4 4"
                  name="Last Month" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Stops Skipped Chart */}
          <div className="bg-card shadow-sm p-6 rounded">
            <h3 className="text-sm font-bold text-foreground mb-1">Weekly Stops Skipped</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Stops skipped trending up week over week
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stopsChartData}>
                <CartesianGrid strokeDasharray="4 4" stroke="hsl(214, 20%, 90%)" />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: "hsl(215, 16%, 47%)" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(215, 16%, 47%)" }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    border: "none",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                    fontSize: "12px"
                  }} />
                <Bar dataKey="skipped" fill="#C9B6FF" radius={[6, 6, 0, 0]} name="Stops Skipped" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ══════ BIN FILL PREDICTIONS ══════ */}
        {sr.loadedRoutes.length > 0 && Object.keys(sr.predictions).length > 0 && (() => {
          const predRows = sr.loadedRoutes.flatMap((route) =>
            route.bins.map((bin) => {
              const pred = sr.predictions[bin.id];
              return pred ? { bin, pred, routeColor: route.color, routeName: route.name } : null;
            }).filter(Boolean)
          ) as { bin: typeof sr.loadedRoutes[0]["bins"][0]; pred: typeof sr.predictions[string]; routeColor: string; routeName: string }[];

          if (predRows.length === 0) return null;

          const confidenceStyle = (c: string) =>
            c === "high"
              ? "bg-green-100 text-green-700"
              : c === "medium"
              ? "bg-yellow-100 text-yellow-700"
              : "bg-red-100 text-red-700";

          return (
            <div className="mt-6 bg-card shadow-sm rounded p-6">
              <h3 className="text-sm font-bold text-foreground mb-1">Bin Fill Predictions</h3>
              <p className="text-xs text-muted-foreground mb-4">
                AI-powered fill rate forecasts based on historical collection logs
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 pr-4 font-semibold text-muted-foreground">Bin</th>
                      <th className="text-left py-2 pr-4 font-semibold text-muted-foreground">Route</th>
                      <th className="text-right py-2 pr-4 font-semibold text-muted-foreground">Fill rate / day</th>
                      <th className="text-right py-2 pr-4 font-semibold text-muted-foreground">Days to threshold</th>
                      <th className="text-left py-2 pr-4 font-semibold text-muted-foreground">Predicted date</th>
                      <th className="text-left py-2 pr-4 font-semibold text-muted-foreground">Recommended days</th>
                      <th className="text-left py-2 font-semibold text-muted-foreground">Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {predRows.map(({ bin, pred, routeColor, routeName }) => (
                      <tr key={bin.id} className="border-b border-border/50 hover:bg-muted/30 transition">
                        <td className="py-2 pr-4 font-medium text-foreground">{bin.name}</td>
                        <td className="py-2 pr-4">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: routeColor }} />
                            {routeName}
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-right font-mono">
                          {pred.fillRatePerDay > 0 ? `${pred.fillRatePerDay}%` : "—"}
                        </td>
                        <td className="py-2 pr-4 text-right font-mono">
                          {pred.daysUntilThreshold === Infinity ? "—" : pred.daysUntilThreshold === 0 ? "Now" : `${pred.daysUntilThreshold}d`}
                        </td>
                        <td className="py-2 pr-4">
                          {pred.predictedThresholdDate ?? "—"}
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {pred.recommendedCollectionDays.length > 0
                            ? pred.recommendedCollectionDays.slice(0, 3).join(", ")
                            : "—"}
                        </td>
                        <td className="py-2">
                          <span className={`px-2 py-0.5 rounded-full font-semibold capitalize ${confidenceStyle(pred.confidence)}`}>
                            {pred.confidence}
                          </span>
                          {pred.inferredFromFleet && (
                            <span className="ml-1 text-muted-foreground text-[10px]">(fleet avg)</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}
      </main>

      {/* ══════ OPTIMIZE REVIEW MODAL ══════ */}
      {showReviewModal && (() => {
        const optimizedRoutes = sr.loadedRoutes
          .map((route) => {
            const opt = sr.optimizedMap[route.id];
            return opt ? { route, opt } : null;
          })
          .filter(Boolean) as { route: typeof sr.loadedRoutes[0]; opt: typeof sr.optimizedMap[string] }[];

        if (optimizedRoutes.length === 0) return null;

        return (
          <OptimizeReviewModal
            optimizedRoutes={optimizedRoutes}
            onAccept={async (routeId) => {
              const routeName = await sr.acceptRoute(routeId);
              if (routeName) {
                toast({ title: "Route accepted", description: `"${routeName}" saved to Geotab.` });
              } else {
                toast({ title: "Failed to save route", variant: "destructive" });
              }
              return routeName;
            }}
            onDiscard={(routeId) => sr.discardRoute(routeId)}
            onClose={() => setShowReviewModal(false)}
          />
        );
      })()}
    </div>);

};

export default Index;
