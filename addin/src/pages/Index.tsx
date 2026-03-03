import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer } from
"recharts";
import SmartRouteMap from "@/components/SmartRouteMap";
import RouteOverlayPanel from "@/components/RouteOverlayPanel";
import OptimizeReviewModal from "@/components/OptimizeReviewModal";
import DriverReportModal from "@/components/DriverReportModal";
import CostReportModal from "@/components/CostReportModal";
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
// Week helpers
// ═══════════════════════════════════════════════

function getWeekBounds(offset: number): { start: Date; end: Date; label: string } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMon + offset * 7);
  monday.setHours(0, 0, 0, 0);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return { start: monday, end: friday, label: `${fmt(monday)}–${fmt(friday)}` };
}

type ActiveWeek = "this" | "next";

// ═══════════════════════════════════════════════
// Tour Callout (inline step tooltip)
// ═══════════════════════════════════════════════

interface TourCalloutProps {
  step: number;
  activeStep: number;
  title: string;
  body: string;
  totalSteps: number;
  onNext: () => void;
  onDismiss: () => void;
  position?: "top" | "bottom";
}

const TourCallout: React.FC<TourCalloutProps> = ({
  step, activeStep, title, body, totalSteps, onNext, onDismiss, position = "bottom",
}) => {
  if (activeStep !== step) return null;
  const isLast = step === totalSteps - 1;

  return (
    <div
      className={`absolute ${position === "bottom" ? "top-full mt-2" : "bottom-full mb-2"} left-0 z-[600] w-64 bg-card border border-primary/25 rounded-xl shadow-xl p-4 pointer-events-auto`}
      style={{ animation: "fadeSlideUp 0.2s ease" }}
    >
      {/* Arrow */}
      <div
        className={`absolute ${position === "bottom" ? "-top-2" : "-bottom-2"} left-6 w-3 h-3 rotate-45 bg-card border-l border-t border-primary/25`}
        style={position === "bottom" ? { borderBottomColor: "transparent", borderRightColor: "transparent" } : { borderTopColor: "transparent", borderLeftColor: "transparent" }}
      />
      <div className="text-[10px] font-bold text-primary uppercase tracking-widest mb-0.5">
        Step {step + 1} of {totalSteps}
      </div>
      <div className="text-sm font-bold text-foreground mb-1">{title}</div>
      <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">{body}</p>
      <div className="flex justify-between items-center">
        <button onClick={onDismiss} className="text-[11px] text-muted-foreground hover:underline">
          Skip tour
        </button>
        <button
          onClick={onNext}
          className="text-[11px] font-bold text-primary-foreground bg-primary px-3 py-1.5 rounded-lg hover:bg-primary/90 transition"
        >
          {isLast ? "Got it!" : "Next →"}
        </button>
      </div>
    </div>
  );
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
  const [activeWeek, setActiveWeek] = useState<ActiveWeek>("this");
  const thisWeek = useMemo(() => getWeekBounds(0), []);
  const nextWeek = useMemo(() => getWeekBounds(1), []);
  const currentWeekBounds = activeWeek === "this" ? thisWeek : nextWeek;
  const isForecast = activeWeek === "next";
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showCostReport, setShowCostReport] = useState(false);
  const [focusRouteId, setFocusRouteId] = useState<string | null>(null);
  const [tourStep, setTourStep] = useState(0); // -1 = dismissed
  const [driverSimEnabled, setDriverSimEnabled] = useState(false);
  const [showDriverModal, setShowDriverModal] = useState(false);

  const TOUR_STEPS = 4;
  const tourDone = tourStep < 0;
  const advanceTour = useCallback(() => {
    setTourStep((s) => (s >= TOUR_STEPS - 1 ? -1 : s + 1));
  }, []);
  const dismissTour = useCallback(() => setTourStep(-1), []);

  // When a route is added, auto-advance past the search step
  useEffect(() => {
    if (sr.loadedRoutes.length > 0 && tourStep === 0) advanceTour();
  }, [sr.loadedRoutes.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const searchWrapRef = useRef<HTMLDivElement>(null);
  const thresholdCardRef = useRef<HTMLDivElement>(null);
  const optimizeBtnRef = useRef<HTMLButtonElement>(null);

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

  // Ace insight fallback when Ace API is not available
  const aceFallback = useMemo(() => {
    const m = sr.aggregateMetrics;
    if (!m || m.kmSaved <= 0) return null;
    const trees = Math.round(m.co2AvoidedKg / 21.8);
    return `Today's optimized routes reduce fleet distance by ${m.kmSaved.toFixed(1)} km, avoiding ${m.co2AvoidedKg.toFixed(1)} kg of CO₂ — equivalent to planting ${Math.max(1, trees)} tree${trees !== 1 ? "s" : ""} worth of carbon.`;
  }, [sr.aggregateMetrics]);

  // Overflow risk from predictions
  const overflowRisk = useMemo(() => {
    const preds = Object.values(sr.predictions);
    if (preds.length === 0) return null;
    const highRisk = preds.filter((p) => p.daysUntilThreshold !== Infinity && p.daysUntilThreshold <= 2).length;
    const medRisk = preds.filter((p) => p.daysUntilThreshold !== Infinity && p.daysUntilThreshold > 2 && p.daysUntilThreshold <= 5).length;
    return { highRisk, medRisk, total: preds.length };
  }, [sr.predictions]);

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
    // Focus the first optimized route
    if (sr.loadedRoutes.length > 0) setFocusRouteId(sr.loadedRoutes[0].id);
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
          <TruckIcon size={28} color="hsl(200, 65%, 44%)" />
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
            {/* Controls row: search + week toggle + route chips */}
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                {/* Search */}
                <div className="relative flex-1 max-w-xs" ref={searchWrapRef} data-tour="search">
                  {!tourDone && (
                    <TourCallout
                      step={0} activeStep={tourStep} totalSteps={TOUR_STEPS}
                      title="Search for a route"
                      body="Type a route name and click to load it on the map. You can add multiple routes."
                      onNext={advanceTour} onDismiss={dismissTour}
                    />
                  )}
                  <SearchIcon size={16} color="hsl(210, 15%, 50%)" className="absolute left-3 top-1/2 -translate-y-1/2" />
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
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: added ? "hsl(200,65%,44%)" : "#d1d5db" }} />
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

                {/* Week toggle */}
                <div className="relative flex bg-muted rounded-lg p-0.5 ml-auto" data-tour="dates">
                  {!tourDone && (
                    <TourCallout
                      step={1} activeStep={tourStep} totalSteps={TOUR_STEPS}
                      title="Choose your planning window"
                      body="'This Week' uses live sensor data for optimization. 'Next Week' shows predicted fill levels for pre-planning."
                      onNext={advanceTour} onDismiss={dismissTour}
                    />
                  )}
                  <button
                    onClick={() => { setActiveWeek("this"); if (tourStep === 1) advanceTour(); }}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                      activeWeek === "this" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    This Week ({thisWeek.label})
                  </button>
                  <button
                    onClick={() => { setActiveWeek("next"); if (tourStep === 1) advanceTour(); }}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                      activeWeek === "next" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Next Week Forecast
                  </button>
                </div>
              </div>

              {/* Route chips */}
              {sr.loadedRoutes.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  {(filtersExpanded ? sr.loadedRoutes : sr.loadedRoutes.slice(0, MAX_VISIBLE_CHIPS)).map((r) =>
                    <button
                      key={r.id}
                      onClick={() => removeRoute(r.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition shrink-0">
                      <span className="w-2 h-2 rounded-full" style={{ background: r.color }} />
                      {r.name}
                      <span className="text-[10px] text-primary/60 ml-0.5">{r.bins.length}</span>
                      <CloseIcon size={12} color="hsl(200, 65%, 44%)" />
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
              )}
            </div>

            {/* Forecast banner */}
            {isForecast && (
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                <CalendarIcon size={14} color="hsl(38, 92%, 50%)" />
                <span>
                  <strong>Forecast mode:</strong> Fill levels are predicted for {nextWeek.label}. Optimization is disabled — use this view for pre-planning.
                </span>
              </div>
            )}

            {/* Optimize status */}
            {sr.optimizeStatus && (
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                {sr.isOptimizing && <SpinnerIcon size={14} color="hsl(200, 65%, 44%)" />}
                {sr.optimizeStatus}
              </div>
            )}

            {/* Map */}
            <div className="relative flex-1 min-h-0">
              {/* Onboarding: ghost map hint when empty */}
              {sr.loadedRoutes.length === 0 && (
                <div className="absolute inset-0 z-[490] flex items-center justify-center pointer-events-none">
                  <div className="text-center opacity-50">
                    <TruckIcon size={48} color="hsl(200,65%,44%)" />
                    <p className="text-sm font-semibold text-muted-foreground mt-2">
                      Load your routes for the week of {thisWeek.label}
                    </p>
                  </div>
                </div>
              )}

              {/* Data source badge on map */}
              {sr.loadedRoutes.length > 0 && (
                <div className="absolute top-4 left-4 z-[1000] flex items-center gap-1.5 bg-card/90 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-sm">
                  <span className={`w-2 h-2 rounded-full ${isForecast ? "bg-amber-400" : "bg-green-500"}`} />
                  <span className="text-[10px] font-semibold text-foreground">
                    {isForecast ? "Predicted fill levels" : "Live sensor data · 15-min refresh"}
                  </span>
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
                  focusRouteId={focusRouteId}
                  isForecast={isForecast}
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
              {/* Optimized Routes review overlay — floats on map, cycles through routes */}
              {showReviewModal && (() => {
                const optimizedRoutes = sr.loadedRoutes
                  .map((route) => {
                    const opt = sr.optimizedMap[route.id];
                    return opt ? { route, opt } : null;
                  })
                  .filter(Boolean) as { route: typeof sr.loadedRoutes[0]; opt: typeof sr.optimizedMap[string] }[];

                if (optimizedRoutes.length === 0) return null;

                return (
                  <div className="absolute bottom-4 left-4 z-[1100] bg-card/95 backdrop-blur-sm rounded-xl shadow-xl border border-border min-w-[280px] max-w-[340px] p-4 overflow-y-auto max-h-[85vh]">
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
                      onRouteChange={(routeId) => setFocusRouteId(routeId)}
                    />
                  </div>
                );
              })()}

              {/* Route overlay panel (accept/discard) — hidden when review overlay is active */}
              {!showReviewModal && selectedRoute && selectedOpt && (
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
            <div className="bg-card shadow-sm p-6 rounded relative" ref={thresholdCardRef} data-tour="threshold">
              {!tourDone && (
                <TourCallout
                  step={2} activeStep={tourStep} totalSteps={TOUR_STEPS}
                  title="Tune the fill threshold"
                  body="Drag to set the fill % that triggers collection. Lower = more stops, higher = fewer stops with full bins only."
                  onNext={advanceTour} onDismiss={dismissTour}
                />
              )}
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
            <div className="relative">
              {!tourDone && (
                <TourCallout
                  step={3} activeStep={tourStep} totalSteps={TOUR_STEPS}
                  title="Optimize & See Savings"
                  body="SmartRoute runs Clarke-Wright + OR-Opt to find the most efficient routes, skipping bins that don't need collection."
                  onNext={advanceTour} onDismiss={dismissTour}
                  position="top"
                />
              )}
            </div>
            <button
              ref={optimizeBtnRef}
              onClick={() => { handleOptimize(); if (tourStep === 3) dismissTour(); }}
              disabled={sr.isOptimizing || sr.loadedRoutes.length === 0 || isForecast}
              className="w-full py-3.5 bg-gradient-to-r from-primary to-accent text-white font-bold text-sm flex items-center justify-center gap-2.5 hover:opacity-90 transition disabled:opacity-60 shadow-md rounded"
            >
              {isForecast ? (
                <>
                  <CalendarIcon size={18} color="white" />
                  Forecast Only — Switch to This Week
                </>
              ) : sr.isOptimizing ? (
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
                  Optimize This Week's Routes
                </>
              )}
            </button>

            {/* Generate report button — after optimization */}
            {optimizeState === "optimized" && !isForecast && (
              <button
                onClick={() => setShowCostReport(true)}
                className="w-full py-2.5 bg-card border border-primary/20 text-primary font-semibold text-xs rounded hover:bg-primary/5 transition flex items-center justify-center gap-2"
              >
                Generate Cost Savings Report
              </button>
            )}

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
            {optimizeState === "optimized" && (
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Based on current sensor readings
              </div>
            )}
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

            {/* Overflow Risk Card */}
            {overflowRisk && overflowRisk.highRisk + overflowRisk.medRisk > 0 && (
              <div className="bg-card shadow-sm rounded p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                    Overflow Risk
                  </span>
                  <div className="relative group">
                    <button className="w-4 h-4 rounded-full bg-muted text-muted-foreground text-[10px] font-bold flex items-center justify-center hover:bg-primary/20 transition">i</button>
                    <div className="absolute bottom-full right-0 mb-2 w-52 bg-foreground text-background text-[11px] rounded-lg px-3 py-2 shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 leading-relaxed">
                      Bins predicted to reach threshold within 2 days (high) or 5 days (medium).
                      <div className="absolute top-full right-3 border-4 border-transparent border-t-foreground" />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {overflowRisk.highRisk > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-destructive" />
                      <span className="text-sm font-extrabold text-destructive">{overflowRisk.highRisk}</span>
                      <span className="text-xs text-muted-foreground">critical</span>
                    </div>
                  )}
                  {overflowRisk.medRisk > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                      <span className="text-sm font-extrabold text-amber-500">{overflowRisk.medRisk}</span>
                      <span className="text-xs text-muted-foreground">soon</span>
                    </div>
                  )}
                  <span className="text-xs text-muted-foreground ml-auto">
                    of {overflowRisk.total} bins
                  </span>
                </div>
                <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-destructive transition-all"
                    style={{ width: `${Math.round((overflowRisk.highRisk / overflowRisk.total) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ══════ ACE INSIGHT BANNER ══════ */}
        {optimizeState === "optimized" && (
          <div className="mt-6 bg-gradient-to-r from-primary/8 to-accent/8 border border-primary/20 rounded-xl px-5 py-4 flex items-start gap-3">
            <div className="shrink-0 mt-0.5">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 2L11.5 7.5H17L12.5 11L14 16.5L10 13.5L6 16.5L7.5 11L3 7.5H8.5L10 2Z" fill="url(#sparkle-grad2)" />
                <defs>
                  <linearGradient id="sparkle-grad2" x1="3" y1="2" x2="17" y2="16.5" gradientUnits="userSpaceOnUse">
                    <stop stopColor="hsl(200,65%,44%)" />
                    <stop offset="1" stopColor="hsl(210,50%,28%)" />
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
                  <SpinnerIcon size={12} color="hsl(200, 65%, 44%)" />
                  Generating fleet insight...
                </div>
              ) : (
                <p className="text-sm text-foreground leading-relaxed">
                  {sr.aceInsight || aceFallback || "Route optimization complete. Review your savings above."}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ══════ CHARTS (hidden in forecast mode) ══════ */}
        {!isForecast && <div className="grid grid-cols-2 gap-6 mt-6">
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
                  stroke="hsl(200,65%,44%)"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "hsl(200,65%,44%)" }}
                  name="This Month" />
                <Line
                  type="monotone"
                  dataKey="lastMonth"
                  stroke="hsl(200,30%,75%)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "hsl(200,30%,75%)" }}
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
                <Bar dataKey="skipped" fill="hsl(200,65%,44%)" radius={[6, 6, 0, 0]} name="Stops Skipped" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>}

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

          const actionBadge = (days: number, _conf: string) => {
            if (isForecast) {
              if (days <= 1) return { label: "Collect Mon/Tue", cls: "bg-destructive/15 text-destructive" };
              if (days <= 3) return { label: "Collect mid-week", cls: "bg-orange-100 text-orange-700" };
              if (days <= 5) return { label: "Collect Thu/Fri", cls: "bg-yellow-100 text-yellow-700" };
              return { label: "Can wait", cls: "bg-green-100 text-green-700" };
            }
            if (days === 0) return { label: "Collect Today", cls: "bg-destructive/15 text-destructive" };
            if (days <= 2) return { label: "Schedule Soon", cls: "bg-orange-100 text-orange-700" };
            if (days <= 7) return { label: "Plan Collection", cls: "bg-yellow-100 text-yellow-700" };
            return { label: "On Track", cls: "bg-green-100 text-green-700" };
          };

          const simConfidence = (c: string) => {
            if (c === "low") return "medium";
            if (c === "medium") return "high";
            return c;
          };

          const criticalCount = predRows.filter((r) => r.pred.daysUntilThreshold <= 2).length;
          const totalFillRate = predRows.reduce((s, r) => s + r.pred.fillRatePerDay, 0);
          const avgFillRate = predRows.length > 0 ? (totalFillRate / predRows.length).toFixed(1) : "—";

          const needCollectionThisWeek = predRows.filter((r) => r.pred.daysUntilThreshold <= 5).length;
          const summaryLine = isForecast
            ? `Based on 4 weeks of sensor history, ${needCollectionThisWeek} of ${predRows.length} bins will need collection during ${nextWeek.label}.`
            : `${criticalCount} bin${criticalCount !== 1 ? "s" : ""} need${criticalCount === 1 ? "s" : ""} urgent collection this week. Average fill rate: ${avgFillRate}%/day.`;

          return (
            <div className={`${isForecast ? "mt-4" : "mt-6"} bg-card shadow-sm rounded p-6`}>
              <div className="flex items-start justify-between mb-1">
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    {isForecast ? `Next Week Forecast (${nextWeek.label})` : "Bin Fill Predictions"}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isForecast
                      ? "Predicted fill levels for pre-planning next week's routes"
                      : "Forecast based on 4 weeks of collection history"}
                  </p>
                  <p className="text-xs text-foreground font-medium mt-1.5">{summaryLine}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  {/* Driver sim toggle */}
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground font-medium whitespace-nowrap">Simulate driver data</span>
                    <button
                      type="button"
                      onClick={() => setDriverSimEnabled((v) => !v)}
                      className={`relative w-9 h-5 rounded-full transition-colors ${driverSimEnabled ? "bg-primary" : "bg-muted"}`}
                    >
                      <span
                        className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform"
                        style={{ left: driverSimEnabled ? "calc(100% - 18px)" : 2 }}
                      />
                    </button>
                  </div>
                  <button
                    onClick={() => setShowDriverModal(true)}
                    className="text-[11px] font-semibold text-primary-foreground bg-primary px-3 py-1.5 rounded-lg hover:bg-primary/90 transition whitespace-nowrap"
                  >
                    View mockup
                  </button>
                </div>
              </div>

              {driverSimEnabled && (
                <div className="mb-3 flex items-center gap-2 text-[11px] text-primary bg-primary/8 border border-primary/20 rounded-lg px-3 py-2">
                  <span className="font-bold">Simulation active:</span>
                  Driver-confirmed data applied — confidence scores boosted where applicable.
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 pr-3 font-semibold text-muted-foreground">Bin</th>
                      <th className="text-left py-2 pr-3 font-semibold text-muted-foreground">Route</th>
                      <th className="text-right py-2 pr-3 font-semibold text-muted-foreground">Rate/day</th>
                      <th className="text-right py-2 pr-3 font-semibold text-muted-foreground">Days left</th>
                      <th className="text-left py-2 pr-3 font-semibold text-muted-foreground">Predicted date</th>
                      <th className="text-left py-2 pr-3 font-semibold text-muted-foreground">Confidence</th>
                      <th className="text-left py-2 font-semibold text-muted-foreground">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {predRows.map(({ bin, pred, routeColor, routeName }) => {
                      const displayConf = driverSimEnabled ? simConfidence(pred.confidence) : pred.confidence;
                      const confBoosted = driverSimEnabled && displayConf !== pred.confidence;
                      const badge = actionBadge(pred.daysUntilThreshold === Infinity ? 999 : pred.daysUntilThreshold, displayConf);
                      return (
                        <tr key={bin.id} className="border-b border-border/50 hover:bg-muted/30 transition">
                          <td className="py-2 pr-3 font-medium text-foreground">{bin.name}</td>
                          <td className="py-2 pr-3">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: routeColor }} />
                              {routeName}
                            </span>
                          </td>
                          <td className="py-2 pr-3 text-right font-mono">
                            {pred.fillRatePerDay > 0 ? `${pred.fillRatePerDay}%` : "—"}
                          </td>
                          <td className="py-2 pr-3 text-right font-mono">
                            {pred.daysUntilThreshold === Infinity ? "—" : pred.daysUntilThreshold === 0 ? "Now" : `${pred.daysUntilThreshold}d`}
                          </td>
                          <td className="py-2 pr-3">{pred.predictedThresholdDate ?? "—"}</td>
                          <td className="py-2 pr-3">
                            <span className={`px-2 py-0.5 rounded-full font-semibold capitalize ${confidenceStyle(displayConf)}`}>
                              {displayConf}
                            </span>
                            {confBoosted && <span className="ml-1 text-primary text-[10px] font-bold">↑driver</span>}
                            {pred.inferredFromFleet && !confBoosted && (
                              <span className="ml-1 text-muted-foreground text-[10px]">(fleet avg)</span>
                            )}
                          </td>
                          <td className="py-2">
                            <span className={`px-2 py-0.5 rounded-full font-semibold ${badge.cls}`}>
                              {badge.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-muted/20">
                      <td className="py-2 pr-3 font-bold text-foreground">Summary</td>
                      <td className="py-2 pr-3 text-muted-foreground">{predRows.length} bins</td>
                      <td className="py-2 pr-3 text-right font-mono text-muted-foreground">{avgFillRate}% avg</td>
                      <td colSpan={2} className="py-2 pr-3 text-muted-foreground">
                        {criticalCount > 0
                          ? <span className="text-destructive font-semibold">{criticalCount} need urgent collection</span>
                          : "All bins on schedule"}
                      </td>
                      <td colSpan={2} className="py-2 text-muted-foreground text-[11px]">
                        {driverSimEnabled ? "Driver data simulated" : "Sensor data only"}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          );
        })()}
      </main>

      {/* ══════ DRIVER REPORT MODAL ══════ */}
      {showDriverModal && <DriverReportModal onClose={() => setShowDriverModal(false)} />}

      {/* ══════ COST REPORT MODAL ══════ */}
      {showCostReport && (
        <CostReportModal
          metrics={sr.aggregateMetrics}
          routeCount={Object.keys(sr.optimizedMap).length}
          weekLabel={`Week of ${thisWeek.label}`}
          onClose={() => setShowCostReport(false)}
        />
      )}
    </div>);

};

export default Index;
