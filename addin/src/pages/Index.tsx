import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
// Animated number hook
// ═══════════════════════════════════════════════

function useAnimatedNumber(target: number, duration = 600): number {
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
// Stat Card Component
// ═══════════════════════════════════════════════

interface StatCardProps {
  icon: React.ReactNode;
  value: number;
  unit: string;
  label: string;
  decimals?: number;
  subLabel?: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, value, unit, label, decimals = 1, subLabel }) => {
  const animated = useAnimatedNumber(value);
  return (
    <div className="bg-card shadow-sm p-4 flex flex-col items-center text-center rounded-xl border border-border/50 hover:shadow-md transition-shadow">
      <div className="mb-2 mt-0.5">{icon}</div>
      <div className="text-2xl font-extrabold text-foreground leading-none">
        {animated.toFixed(decimals)}
        <span className="text-sm font-semibold text-muted-foreground ml-1">{unit}</span>
      </div>
      <div className="text-xs text-muted-foreground mt-1.5 font-medium">{label}</div>
      {subLabel && (
        <div className="text-[10px] text-primary/70 mt-0.5 font-semibold">{subLabel}</div>
      )}
    </div>
  );
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
// Tour Callout
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
      <div className={`absolute ${position === "bottom" ? "-top-2" : "-bottom-2"} left-6 w-3 h-3 rotate-45 bg-card border-l border-t border-primary/25`}
        style={position === "bottom" ? { borderBottomColor: "transparent", borderRightColor: "transparent" } : { borderTopColor: "transparent", borderLeftColor: "transparent" }}
      />
      <div className="text-[10px] font-bold text-primary uppercase tracking-widest mb-0.5">Step {step + 1} of {totalSteps}</div>
      <div className="text-sm font-bold text-foreground mb-1">{title}</div>
      <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">{body}</p>
      <div className="flex justify-between items-center">
        <button onClick={onDismiss} className="text-[11px] text-muted-foreground hover:underline">Skip tour</button>
        <button onClick={onNext} className="text-[11px] font-bold text-primary-foreground bg-primary px-3 py-1.5 rounded-lg hover:bg-primary/90 transition">
          {isLast ? "Got it!" : "Next →"}
        </button>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════
// Section Divider
// ═══════════════════════════════════════════════

const SectionDivider: React.FC<{ label: string; sublabel?: string; color?: "teal" | "amber" }> = ({
  label, sublabel, color = "teal",
}) => (
  <div className="flex items-center gap-4 my-8">
    <div className={`h-px flex-1 ${color === "teal" ? "bg-primary/20" : "bg-amber-300/50"}`} />
    <div className="text-center">
      <div className={`text-[10px] font-black uppercase tracking-[0.2em] ${color === "teal" ? "text-primary" : "text-amber-600"}`}>
        {label}
      </div>
      {sublabel && <div className="text-[10px] text-muted-foreground mt-0.5">{sublabel}</div>}
    </div>
    <div className={`h-px flex-1 ${color === "teal" ? "bg-primary/20" : "bg-amber-300/50"}`} />
  </div>
);

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
  const isForecast = activeWeek === "next";
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showCostReport, setShowCostReport] = useState(false);
  const [focusRouteId, setFocusRouteId] = useState<string | null>(null);
  const [tourStep, setTourStep] = useState(0);
  const [driverSimEnabled, setDriverSimEnabled] = useState(false);
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [highlightCriticalBins, setHighlightCriticalBins] = useState(false);

  const TOUR_STEPS = 6;
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
  const predictionsSectionRef = useRef<HTMLDivElement>(null);
  const weekToggleRef = useRef<HTMLDivElement>(null);

  // Scroll to tour targets when advancing to steps 4 or 5
  useEffect(() => {
    if (tourStep === 4 && predictionsSectionRef.current) {
      predictionsSectionRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    if (tourStep === 5 && weekToggleRef.current) {
      weekToggleRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [tourStep]);
  const optimizeBtnRef = useRef<HTMLButtonElement>(null);

  const hasOptimized = isForecast
    ? Object.keys(sr.forecastOptimizedMap ?? {}).length > 0
    : Object.keys(sr.optimizedMap).length > 0;
  const optimizeState = sr.isOptimizing ? "loading" as const
    : hasOptimized ? "optimized" as const
    : "idle" as const;

  // Derived accepted route IDs for map green highlighting
  const acceptedRouteIds = useMemo(() => {
    return new Set(
      Object.entries(sr.optimizedMap)
        .filter(([, opt]) => opt.accepted)
        .map(([id]) => id)
    );
  }, [sr.optimizedMap]);

  const activeOptMapForMetrics = isForecast ? (sr.forecastOptimizedMap ?? {}) : sr.optimizedMap;
  const aggregateMetricsForDisplay = useMemo(() => {
    const map = isForecast ? (sr.forecastOptimizedMap ?? {}) : sr.optimizedMap;
    return Object.values(map).reduce(
      (acc, opt) => {
        if (!opt?.result?.metrics) return acc;
        const m = opt.result.metrics;
        return {
          stopsSkipped: acc.stopsSkipped + m.stopsSkipped,
          kmSaved: acc.kmSaved + m.kmSaved,
          fuelSavedL: acc.fuelSavedL + m.fuelSavedL,
          co2AvoidedKg: acc.co2AvoidedKg + m.co2AvoidedKg,
          hoursSaved: acc.hoursSaved + m.hoursSaved,
          idleMinutesSaved: acc.idleMinutesSaved + (m.idleMinutesSaved ?? 0),
        };
      },
      { stopsSkipped: 0, kmSaved: 0, fuelSavedL: 0, co2AvoidedKg: 0, hoursSaved: 0, idleMinutesSaved: 0 },
    );
  }, [isForecast, sr.forecastOptimizedMap, sr.optimizedMap]);

  const displayMetrics = useMemo(() => {
    if (sr.selectedRouteId && activeOptMapForMetrics[sr.selectedRouteId]) {
      return activeOptMapForMetrics[sr.selectedRouteId].result.metrics;
    }
    return aggregateMetricsForDisplay;
  }, [sr.selectedRouteId, activeOptMapForMetrics, aggregateMetricsForDisplay]);

  const { hoursSaved, fuelSavedL: fuelSaved, co2AvoidedKg: co2Reduced, stopsSkipped, idleMinutesSaved } = displayMetrics;

  // Ace insight fallback (uses active map metrics)
  const aceFallback = useMemo(() => {
    const m = aggregateMetricsForDisplay;
    if (!m || m.kmSaved <= 0) return null;
    const trees = Math.round(m.co2AvoidedKg / 21.8);
    const prefix = isForecast ? "Next week's forecasted routes" : "Today's optimized routes";
    return `${prefix} reduce fleet distance by ${m.kmSaved.toFixed(1)} km, avoiding ${m.co2AvoidedKg.toFixed(1)} kg of CO₂ — equivalent to planting ${Math.max(1, trees)} tree${trees !== 1 ? "s" : ""} worth of carbon.`;
  }, [aggregateMetricsForDisplay, isForecast]);

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
    if (isForecast) {
      await sr.runForecastOptimize();
    } else {
      await sr.runOptimize();
    }
    setShowReviewModal(true);
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

  const selectedRoute = sr.selectedRouteId ? sr.loadedRoutes.find((r) => r.id === sr.selectedRouteId) : null;
  const activeOptMap = isForecast ? sr.forecastOptimizedMap : sr.optimizedMap;
  const selectedOpt = sr.selectedRouteId ? activeOptMap[sr.selectedRouteId] : null;

  const daysToNextMon = sr.getDaysToNextMonday ? sr.getDaysToNextMonday() : 7;
  const mapBins = useMemo(() => {
    return sr.allBins.map((b, i) => {
      let fillLevel = b.fillLevel;
      if (isForecast && sr.predictions[b.id]) {
        const pred = sr.predictions[b.id];
        const fillRate = pred.fillRatePerDay ?? 10;
        fillLevel = Math.min(100, b.fillLevel + fillRate * daysToNextMon);
      }
      return {
        id: i,
        stringId: b.id,
        name: b.name,
        lat: b.lat,
        lng: b.lng,
        fillLevel,
        lastCollected: "N/A",
      };
    });
  }, [sr.allBins, sr.predictions, isForecast, daysToNextMon]);

  // Accept handler with better toast
  const handleAccept = async (routeId: string) => {
    const routeName = await sr.acceptRoute(routeId);
    if (routeName) {
      toast({
        title: "Route saved to Geotab ✓",
        description: `"${routeName}" is ready for drivers. Route written to fleet system.`,
      });
    } else {
      toast({ title: "Failed to save route", variant: "destructive" });
    }
    return routeName;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* ══════ TOP BAR ══════ */}
      <header className="bg-card/95 backdrop-blur-sm border-b border-border sticky top-0 z-50 shadow-sm">
        <div className="px-6 py-3 flex items-center gap-2.5">
          <div className="p-1.5 bg-primary/10 rounded-lg">
            <TruckIcon size={22} color="hsl(200, 65%, 44%)" />
          </div>
          <span className="text-lg font-extrabold text-foreground tracking-tight">smart route</span>
          <span className="text-[10px] font-bold text-primary/80 px-2 py-0.5 rounded-full uppercase tracking-wider bg-primary/10">
            beta
          </span>
        </div>
      </header>

      <main className="p-6">

        {/* ══════ THIS WEEK SECTION ══════ */}
        <div className="flex items-center gap-4 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-1 h-6 rounded-full bg-primary" />
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">This Week · Optimize and save</div>
              <div className="text-[11px] text-muted-foreground">{thisWeek.label} · Live sensor data</div>
            </div>
          </div>
          <div className="h-px flex-1 bg-primary/15" />
        </div>

        <div className="flex gap-6" style={{ minHeight: "520px" }}>
          {/* LEFT — Map */}
          <div className="w-[65%] flex flex-col gap-3">
            {/* Controls row */}
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                {/* Search */}
                <div className="relative flex-1 max-w-xs" ref={searchWrapRef} data-tour="search">
                  {!tourDone && (
                    <TourCallout step={0} activeStep={tourStep} totalSteps={TOUR_STEPS}
                      title="Search for a route"
                      body="Type a route name and click to load it on the map. You can add multiple routes."
                      onNext={advanceTour} onDismiss={dismissTour} />
                  )}
                  <SearchIcon size={15} color="hsl(210, 15%, 55%)" className="absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text" placeholder="Search routes..."
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setShowDropdown(true); }}
                    onFocus={() => setShowDropdown(true)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-muted text-sm placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30 transition border border-transparent focus:border-primary/20"
                  />
                  {showDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-card shadow-xl rounded-xl border border-border z-50 max-h-64 overflow-y-auto">
                      {filteredRoutes.length === 0 ? (
                        <div className="px-4 py-3 text-xs text-muted-foreground">No routes found</div>
                      ) : filteredRoutes.slice(0, 8).map((route) => {
                        const added = sr.loadedRoutes.some((r) => r.id === route.id);
                        return (
                          <button key={route.id} disabled={added} onClick={() => handleSelectRoute(route)}
                            className={`w-full text-left px-4 py-2.5 hover:bg-muted/60 transition flex items-center gap-2.5 ${added ? "opacity-50" : ""}`}>
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: added ? "hsl(200,65%,44%)" : "#d1d5db" }} />
                            <div>
                              <div className="text-sm font-medium text-foreground">{route.name || "Unnamed Route"}{added ? " ✓" : ""}</div>
                              <div className="text-[10px] text-muted-foreground">{route.bins ? `${route.bins.length} stops` : "Click to load"}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Week toggle */}
                <div className="relative flex bg-muted rounded-lg p-0.5 ml-auto" data-tour="dates" ref={weekToggleRef}>
                  {!tourDone && (
                    <>
                      <TourCallout step={1} activeStep={tourStep} totalSteps={TOUR_STEPS}
                        title="Choose your planning window"
                        body="'This Week' shows live sensor data for optimization. 'Next Week' shows predicted fill levels for pre-planning."
                        onNext={advanceTour} onDismiss={dismissTour} />
                      <TourCallout step={5} activeStep={tourStep} totalSteps={TOUR_STEPS}
                        title="See next week's forecast"
                        body="Click 'Next Week Forecast' to view predicted fill levels and optimize routes for the upcoming week."
                        onNext={advanceTour} onDismiss={dismissTour} position="bottom" />
                    </>
                  )}
                  <button
                    onClick={() => { setActiveWeek("this"); if (tourStep === 1 || tourStep === 5) advanceTour(); }}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${activeWeek === "this" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    This Week ({thisWeek.label})
                  </button>
                  <button
                    onClick={() => { setActiveWeek("next"); if (tourStep === 1 || tourStep === 5) advanceTour(); }}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${activeWeek === "next" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    Next Week Forecast
                  </button>
                </div>
              </div>

              {/* Route chips */}
              {sr.loadedRoutes.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  {(filtersExpanded ? sr.loadedRoutes : sr.loadedRoutes.slice(0, MAX_VISIBLE_CHIPS)).map((r) => {
                    const isAccepted = sr.optimizedMap[r.id]?.accepted;
                    return (
                      <button key={r.id} onClick={() => removeRoute(r.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition shrink-0 ${
                          isAccepted
                            ? "bg-green-100 text-green-700 border border-green-300 hover:bg-green-200"
                            : "bg-primary/10 text-primary hover:bg-primary/20"
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full" style={{ background: isAccepted ? "#16a34a" : r.color }} />
                        {r.name}
                        <span className="text-[10px] opacity-60 ml-0.5">{r.bins.length}</span>
                        {isAccepted
                          ? <CheckIcon size={11} color="#16a34a" />
                          : <CloseIcon size={11} color="hsl(200, 65%, 44%)" />}
                      </button>
                    );
                  })}
                  {sr.loadedRoutes.length > MAX_VISIBLE_CHIPS && !filtersExpanded && (
                    <button onClick={() => setFiltersExpanded(true)}
                      className="px-3 py-1.5 rounded-full bg-muted text-muted-foreground text-xs font-semibold hover:bg-muted/80 transition shrink-0">
                      +{sr.loadedRoutes.length - MAX_VISIBLE_CHIPS} more
                    </button>
                  )}
                  {filtersExpanded && sr.loadedRoutes.length > MAX_VISIBLE_CHIPS && (
                    <button onClick={() => setFiltersExpanded(false)}
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
                <span><strong>Forecast mode:</strong> Fill levels are predicted for {nextWeek.label}. Preview optimized routes — switch to This Week to save.</span>
              </div>
            )}

            {sr.optimizeStatus && (
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                {sr.isOptimizing && <SpinnerIcon size={14} color="hsl(200, 65%, 44%)" />}
                {sr.optimizeStatus}
              </div>
            )}

            {/* Map */}
            <div className="relative flex-1 min-h-0">
              {sr.loadedRoutes.length === 0 && (
                <div className="absolute inset-0 z-[490] flex items-center justify-center pointer-events-none">
                  <div className="text-center opacity-40">
                    <TruckIcon size={44} color="hsl(200,65%,44%)" />
                    <p className="text-sm font-semibold text-muted-foreground mt-2">
                      Load your routes for the week of {thisWeek.label}
                    </p>
                  </div>
                </div>
              )}

              {sr.loadedRoutes.length > 0 && (
                <div className="absolute top-4 left-4 z-[1000] flex items-center gap-1.5 bg-card/90 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-sm border border-border/50">
                  <span className={`w-2 h-2 rounded-full ${isForecast ? "bg-amber-400" : "bg-green-500 animate-pulse"}`} />
                  <span className="text-[10px] font-semibold text-foreground">
                    {isForecast ? "Predicted fill levels" : "Live sensor data · 15-min refresh"}
                  </span>
                </div>
              )}

              <div className="bg-card shadow-sm overflow-hidden rounded-xl h-full border border-border/30">
                <SmartRouteMap
                  bins={mapBins}
                  threshold={sr.threshold}
                  optimizeState={optimizeState}
                  optimizedMap={sr.optimizedMap}
                  forecastOptimizedMap={sr.forecastOptimizedMap}
                  loadedRoutes={sr.loadedRoutes}
                  selectedRouteId={sr.selectedRouteId}
                  onRouteSelect={sr.setSelectedRouteId}
                  focusRouteId={focusRouteId}
                  isForecast={isForecast}
                  acceptedRouteIds={acceptedRouteIds}
                  highlightBinIds={highlightCriticalBins ? new Set(Object.entries(sr.predictions).filter(([, p]) => p.daysUntilThreshold <= 2).map(([id]) => id)) : undefined}
                />
              </div>

              <div className="absolute top-4 right-4 z-[1000] bg-card/90 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center gap-1.5 shadow-sm border border-border/50">
                <PinIcon size={13} color="#7EC8E3" />
                <span className="text-xs font-semibold text-foreground">
                  {sr.loadedRoutes.length > 0
                    ? `${sr.loadedRoutes.length} route${sr.loadedRoutes.length > 1 ? "s" : ""} · ${sr.allBins.length} bins`
                    : "Route Preview"}
                </span>
              </div>

              {/* Optimize Review overlay on map */}
              {showReviewModal && (() => {
                const optMap = isForecast ? (sr.forecastOptimizedMap ?? {}) : sr.optimizedMap;
                const optimizedRoutes = sr.loadedRoutes
                  .map((route) => { const opt = optMap[route.id]; return opt ? { route, opt } : null; })
                  .filter(Boolean) as { route: typeof sr.loadedRoutes[0]; opt: typeof sr.optimizedMap[string] }[];
                if (optimizedRoutes.length === 0) return null;
                return (
                  <div className="absolute bottom-4 left-4 z-[1100] bg-card/97 backdrop-blur-sm rounded-2xl shadow-2xl border border-border min-w-[280px] max-w-[340px] p-4 overflow-y-auto max-h-[85vh]">
                    <OptimizeReviewModal
                      optimizedRoutes={optimizedRoutes}
                      onAccept={handleAccept}
                      onDiscard={isForecast ? () => {} : (routeId: string) => sr.discardRoute(routeId)}
                      onClose={() => setShowReviewModal(false)}
                      onRouteChange={(routeId) => setFocusRouteId(routeId)}
                      isForecast={isForecast}
                    />
                  </div>
                );
              })()}

              {!showReviewModal && selectedRoute && selectedOpt && (
                <RouteOverlayPanel
                  routeName={selectedRoute.name}
                  routeColor={selectedRoute.color}
                  metrics={selectedOpt.result.metrics}
                  accepted={selectedOpt.accepted}
                  onAccept={async () => {
                    await handleAccept(sr.selectedRouteId!);
                  }}
                  onDiscard={() => sr.discardRoute(sr.selectedRouteId!)}
                  onClose={() => sr.setSelectedRouteId(null)}
                  isForecast={isForecast}
                />
              )}
            </div>
          </div>

          {/* RIGHT — Controls */}
          <div className="w-[35%] flex flex-col gap-4">
            {/* Threshold + Intensity */}
            <div className="bg-card shadow-sm p-6 rounded-xl border border-border/40 relative" ref={thresholdCardRef} data-tour="threshold">
              {!tourDone && (
                <TourCallout step={2} activeStep={tourStep} totalSteps={TOUR_STEPS}
                  title="Tune the fill threshold"
                  body="Drag to set the fill % that triggers collection. Lower = more stops, higher = fewer stops with full bins only."
                  onNext={advanceTour} onDismiss={dismissTour} />
              )}
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Bin Threshold</label>
              <div className="mt-3 mb-2">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={sr.threshold}
                  onChange={(e) => sr.setThreshold(Number(e.target.value))}
                  className="w-full accent-primary h-2 rounded-full appearance-none bg-muted cursor-pointer"
                  style={{ background: `linear-gradient(to right, hsl(200, 70%, 55%) ${sr.threshold}%, hsl(214, 20%, 90%) ${sr.threshold}%)` }}
                />
              </div>
              <div className="text-center mt-2">
                <span className="text-4xl font-extrabold text-primary">{sr.threshold}</span>
                <span className="text-lg font-bold text-primary">%</span>
              </div>
              <p className="text-[11px] text-muted-foreground text-center mt-1">
                Bins at or above this fill level will be collected
              </p>

              <div className="mt-5 pt-4 border-t border-border">
                <div className="flex items-center gap-1.5">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Route Intensity</label>
                  <div className="relative group">
                    <button type="button"
                      className="w-4 h-4 rounded-full bg-muted text-muted-foreground text-[10px] font-bold flex items-center justify-center hover:bg-primary/20 transition"
                      aria-label="Route Intensity explanation">i</button>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-foreground text-background text-[11px] rounded-lg px-3 py-2 shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 leading-relaxed">
                      Controls how aggressively near-threshold bins are added. Higher = more stops collected when detour cost is cheap. Lower = only mandatory bins above the threshold.
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-foreground" />
                    </div>
                  </div>
                </div>
                <div className="mt-3 mb-2">
                  <input type="range" min={0} max={100} value={sr.intensity}
                    onChange={(e) => sr.setIntensity(Number(e.target.value))}
                    className="w-full accent-primary h-2 rounded-full appearance-none bg-muted cursor-pointer"
                    style={{ background: `linear-gradient(to right, hsl(200, 70%, 55%) ${sr.intensity}%, hsl(214, 20%, 90%) ${sr.intensity}%)` }} />
                </div>
                <div className="text-center">
                  <span className="text-2xl font-extrabold text-primary">{sr.intensity}</span>
                  <span className="text-sm font-bold text-primary">%</span>
                </div>
                <p className="text-[11px] text-muted-foreground text-center mt-1">Higher = collect more sub-threshold bins with low detour cost</p>
              </div>
            </div>

            {/* Optimize button */}
            <div className="relative">
              {!tourDone && (
                <TourCallout step={3} activeStep={tourStep} totalSteps={TOUR_STEPS}
                  title="Optimize & See Savings"
                  body="SmartRoute runs Clarke-Wright + OR-Opt to find the most efficient routes, skipping bins that don't need collection."
                  onNext={advanceTour} onDismiss={dismissTour} position="top" />
              )}
            </div>
            <button
              ref={optimizeBtnRef}
              onClick={() => { handleOptimize(); if (tourStep === 3) advanceTour(); }}
              disabled={sr.isOptimizing || sr.loadedRoutes.length === 0}
              className="w-full py-3.5 bg-gradient-to-r from-primary to-accent text-white font-bold text-sm flex items-center justify-center gap-2.5 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60 shadow-md rounded-xl"
            >
              {isForecast ? (
                sr.isOptimizing ? (
                  <><SpinnerIcon size={18} color="white" />Forecasting...</>
                ) : hasOptimized ? (
                  <><CheckIcon size={18} color="white" />Forecast complete! Review again</>
                ) : (
                  <><CalendarIcon size={18} color="white" />Optimize Next Week's Routes</>
                )
              ) : sr.isOptimizing ? (
                <><SpinnerIcon size={18} color="white" />Optimizing...</>
              ) : optimizeState === "optimized" ? (
                <><CheckIcon size={18} color="white" />Optimized! Review again</>
              ) : (
                <><TruckIcon size={18} color="white" />Optimize This Week's Routes</>
              )}
            </button>

            {optimizeState === "optimized" && !isForecast && (
              <button onClick={() => setShowCostReport(true)}
                className="w-full py-2.5 bg-card border border-primary/25 text-primary font-semibold text-xs rounded-xl hover:bg-primary/5 transition flex items-center justify-center gap-2 shadow-sm">
                Generate Cost Savings Report
              </button>
            )}

            {/* Metrics context label */}
            {sr.selectedRouteId && sr.optimizedMap[sr.selectedRouteId] && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="w-2 h-2 rounded-full" style={{ background: sr.loadedRoutes.find((r) => r.id === sr.selectedRouteId)?.color }} />
                  <span className="font-semibold">{sr.loadedRoutes.find((r) => r.id === sr.selectedRouteId)?.name} metrics</span>
                </div>
                <button onClick={() => sr.setSelectedRouteId(null)} className="text-xs text-primary hover:underline">Show all</button>
              </div>
            )}

            {optimizeState === "optimized" && (
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Based on current sensor readings
              </div>
            )}

            {/* Stat Cards */}
            <div className="grid grid-cols-2 gap-2.5">
              <StatCard
                icon={<img src={iconClock} alt="clock" className="stat-icon-clock" style={{ width: 34, height: 34 }} />}
                value={hoursSaved} unit="hrs" label="Hours Saved"
                subLabel={idleMinutesSaved > 0 ? `+${Math.round(idleMinutesSaved)}min idle` : undefined}
              />
              <StatCard
                icon={<img src={iconFuel} alt="fuel" className="stat-icon-fuel" style={{ width: 34, height: 34 }} />}
                value={fuelSaved} unit="L" label="Fuel Saved"
              />
              <StatCard
                icon={<img src={iconCo2} alt="co2" className="stat-icon-co2" style={{ width: 34, height: 34 }} />}
                value={co2Reduced} unit="kg" label="CO₂ Reduced"
              />
              <StatCard
                icon={<img src={iconStop} alt="stops" className="stat-icon-stop" style={{ width: 34, height: 34 }} />}
                value={stopsSkipped} unit="" label="Stops Skipped" decimals={0}
              />
            </div>

            {/* Overflow Risk */}
            {overflowRisk && overflowRisk.highRisk + overflowRisk.medRisk > 0 && (
              <div className="bg-card shadow-sm rounded-xl p-4 border border-border/40">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Overflow Risk</span>
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
                  <span className="text-xs text-muted-foreground ml-auto">of {overflowRisk.total} bins</span>
                </div>
                <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-destructive transition-all" style={{ width: `${Math.round((overflowRisk.highRisk / overflowRisk.total) * 100)}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ══════ ACE INSIGHT BANNER ══════ */}
        {optimizeState === "optimized" && (
          <div className="mt-6 bg-gradient-to-r from-primary/8 to-accent/8 border border-primary/20 rounded-2xl px-5 py-4 flex items-start gap-3 section-enter">
            <div className="shrink-0 mt-0.5">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 2L11.5 7.5H17L12.5 11L14 16.5L10 13.5L6 16.5L7.5 11L3 7.5H8.5L10 2Z" fill="url(#sg2)" />
                <defs>
                  <linearGradient id="sg2" x1="3" y1="2" x2="17" y2="16.5" gradientUnits="userSpaceOnUse">
                    <stop stopColor="hsl(200,65%,44%)" /><stop offset="1" stopColor="hsl(210,50%,28%)" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div className="flex-1">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Geotab Ace AI Insight</div>
              {sr.aceInsightLoading && !sr.aceInsight ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <SpinnerIcon size={12} color="hsl(200, 65%, 44%)" />Generating fleet insight...
                </div>
              ) : (
                <p className="text-sm text-foreground leading-relaxed">
                  {sr.aceInsight || aceFallback || "Route optimization complete. Review your savings above."}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ══════ TOUR STEP 4: Predicted data ══════ */}
        {!tourDone && tourStep === 4 && sr.loadedRoutes.length > 0 && (
          <div ref={predictionsSectionRef} className="relative py-4">
            <TourCallout
              step={4}
              activeStep={tourStep}
              totalSteps={TOUR_STEPS}
              title="This is predicted data"
              body="Bin fill predictions show which bins need collection soon. Critical bins are highlighted — use them to plan your week."
              onNext={advanceTour}
              onDismiss={dismissTour}
              position="top"
            />
          </div>
        )}

        {/* ══════ PREDICTIONS & NEXT WEEK ══════ */}
        {sr.loadedRoutes.length > 0 && Object.keys(sr.predictions).length > 0 && (() => {
          const predRows = sr.loadedRoutes.flatMap((route) =>
            route.bins.map((bin) => {
              const pred = sr.predictions[bin.id];
              return pred ? { bin, pred, routeColor: route.color, routeName: route.name } : null;
            }).filter(Boolean)
          ) as { bin: typeof sr.loadedRoutes[0]["bins"][0]; pred: typeof sr.predictions[string]; routeColor: string; routeName: string }[];

          if (predRows.length === 0) return null;

          const criticalRows = predRows.filter((r) => r.pred.daysUntilThreshold !== Infinity && r.pred.daysUntilThreshold <= 2);
          const soonRows = predRows.filter((r) => r.pred.daysUntilThreshold !== Infinity && r.pred.daysUntilThreshold > 2 && r.pred.daysUntilThreshold <= 5);
          const onTrackRows = predRows.filter((r) => r.pred.daysUntilThreshold === Infinity || r.pred.daysUntilThreshold > 5);

          const avgFillRate = predRows.length > 0
            ? (predRows.reduce((s, r) => s + r.pred.fillRatePerDay, 0) / predRows.length).toFixed(1)
            : "—";

          const confidenceStyle = (c: string) =>
            c === "high" ? "bg-green-100 text-green-700" : c === "medium" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700";

          const simConfidence = (c: string) => c === "low" ? "medium" : c === "medium" ? "high" : c;

          const actionBadgeNextWeek = (days: number) => {
            if (days <= 1) return { label: "Collect Mon/Tue", cls: "bg-destructive/15 text-destructive" };
            if (days <= 3) return { label: "Collect mid-week", cls: "bg-orange-100 text-orange-700" };
            if (days <= 5) return { label: "Collect Thu/Fri", cls: "bg-yellow-100 text-yellow-700" };
            return { label: "Can wait", cls: "bg-green-100 text-green-700" };
          };

          return (
            <div className="section-enter">
              {/* ── THIS WEEK BIN STATUS ── */}
              <SectionDivider
                label="This Week · Bin Status"
                sublabel={`${criticalRows.length} critical · ${soonRows.length} scheduled soon · ${onTrackRows.length} on track`}
                color="teal"
              />

              <div className="grid grid-cols-3 gap-4 mb-4">
                {/* Critical now */}
                <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-destructive" />
                    <span className="text-xs font-bold text-destructive uppercase tracking-widest">Critical</span>
                    <span className="ml-auto text-lg font-extrabold text-destructive">{criticalRows.length}</span>
                  </div>
                  {criticalRows.length > 0 && (
                    <p className="text-[11px] text-muted-foreground mb-2">
                      ~{Math.round(criticalRows.length * 9)} min to collect
                    </p>
                  )}
                  <div className="space-y-1.5">
                    {criticalRows.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No bins at critical level</p>
                    ) : criticalRows.slice(0, 3).map(({ bin, pred }) => (
                      <div key={bin.id} className="flex items-center justify-between">
                        <span className="text-xs font-medium text-foreground truncate max-w-[120px]">{bin.name}</span>
                        <span className="text-xs font-bold text-destructive shrink-0 ml-1">
                          {pred.daysUntilThreshold === 0 ? "Now" : `${pred.daysUntilThreshold}d`}
                        </span>
                      </div>
                    ))}
                    {criticalRows.length > 3 && (
                      <p className="text-[11px] text-destructive font-semibold">+{criticalRows.length - 3} more</p>
                    )}
                  </div>
                  {criticalRows.length > 0 && (
                    <div className="mt-3 flex flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={() => setHighlightCriticalBins((v) => !v)}
                        className="text-[11px] font-semibold text-primary hover:underline"
                      >
                        {highlightCriticalBins ? "Hide highlight" : "Highlight on map"}
                      </button>
                      {!isForecast && (
                        <p className="text-[10px] text-muted-foreground">
                          Optimize routes to skip non-urgent bins
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Schedule soon */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    <span className="text-xs font-bold text-amber-700 uppercase tracking-widest">Schedule</span>
                    <span className="ml-auto text-lg font-extrabold text-amber-600">{soonRows.length}</span>
                  </div>
                  <div className="space-y-1.5">
                    {soonRows.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No bins need scheduling</p>
                    ) : soonRows.slice(0, 3).map(({ bin, pred }) => (
                      <div key={bin.id} className="flex items-center justify-between">
                        <span className="text-xs font-medium text-foreground truncate max-w-[120px]">{bin.name}</span>
                        <span className="text-xs font-bold text-amber-600 shrink-0 ml-1">{pred.daysUntilThreshold}d</span>
                      </div>
                    ))}
                    {soonRows.length > 3 && (
                      <p className="text-[11px] text-amber-600 font-semibold">+{soonRows.length - 3} more</p>
                    )}
                  </div>
                </div>

                {/* On track */}
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                    <span className="text-xs font-bold text-green-700 uppercase tracking-widest">On Track</span>
                    <span className="ml-auto text-lg font-extrabold text-green-600">{onTrackRows.length}</span>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs text-green-700">
                      {onTrackRows.length} bin{onTrackRows.length !== 1 ? "s" : ""} don't need collection this week.
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">Avg fill rate: {avgFillRate}%/day</p>
                  </div>
                </div>
              </div>

              {/* ── NEXT WEEK FORECAST ── */}
              <SectionDivider
                label={`Next Week · Look ahead · ${nextWeek.label}`}
                sublabel="Predictive fill model · 4 weeks of collection history"
                color="amber"
              />

              {(() => {
                const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri"];
                const binsByDay: Record<string, number> = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0 };
                for (const { pred } of predRows) {
                  if (pred.daysUntilThreshold <= 7 && pred.predictedThresholdDate) {
                    try {
                      const d = new Date(pred.predictedThresholdDate);
                      const dayIdx = d.getDay();
                      const monIdx = dayIdx === 0 ? 6 : dayIdx - 1;
                      if (monIdx >= 0 && monIdx < 5) binsByDay[dayNames[monIdx]]++;
                    } catch {
                      /* ignore parse errors */
                    }
                  }
                }
                const daySummary = dayNames.map((d) => `${d} ${binsByDay[d]}`).join(" · ");
                const estStopsNextWeek = predRows.filter((r) => r.pred.daysUntilThreshold <= 7).length;
                return (
                  <div className="mb-4 flex flex-wrap items-center gap-3 text-xs">
                    <span className="font-semibold text-foreground">Next week collection load:</span>
                    <span className="text-muted-foreground">{daySummary}</span>
                    <span className="text-primary font-semibold">Estimated stops: {estStopsNextWeek}</span>
                  </div>
                );
              })()}

              <div className="bg-card shadow-sm rounded-2xl border border-border/40 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Collection Plan for {nextWeek.label}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Based on 4 weeks of sensor history — {predRows.filter((r) => r.pred.daysUntilThreshold <= 7).length} of {predRows.length} bins will need collection next week
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground font-medium whitespace-nowrap">Simulate driver data</span>
                      <button type="button" onClick={() => setDriverSimEnabled((v) => !v)}
                        className={`relative w-9 h-5 rounded-full transition-colors ${driverSimEnabled ? "bg-primary" : "bg-muted"}`}>
                        <span className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform"
                          style={{ left: driverSimEnabled ? "calc(100% - 18px)" : 2 }} />
                      </button>
                    </div>
                    <button onClick={() => setShowDriverModal(true)}
                      className="text-[11px] font-semibold text-primary-foreground bg-primary px-3 py-1.5 rounded-lg hover:bg-primary/90 transition whitespace-nowrap">
                      View mockup
                    </button>
                  </div>
                </div>

                {driverSimEnabled && (
                  <div className="mb-4 flex items-center gap-2 text-[11px] text-primary bg-primary/8 border border-primary/20 rounded-lg px-3 py-2">
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
                        <th className="text-left py-2 font-semibold text-muted-foreground">Action (next week)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {predRows.map(({ bin, pred, routeColor, routeName }) => {
                        const displayConf = driverSimEnabled ? simConfidence(pred.confidence) : pred.confidence;
                        const confBoosted = driverSimEnabled && displayConf !== pred.confidence;
                        const badge = actionBadgeNextWeek(pred.daysUntilThreshold === Infinity ? 999 : pred.daysUntilThreshold);
                        return (
                          <tr key={bin.id} className="border-b border-border/50 hover:bg-muted/30 transition">
                            <td className="py-2 pr-3 font-medium text-foreground">{bin.name}</td>
                            <td className="py-2 pr-3">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: routeColor }} />
                                {routeName}
                              </span>
                            </td>
                            <td className="py-2 pr-3 text-right font-mono">{pred.fillRatePerDay > 0 ? `${pred.fillRatePerDay}%` : "—"}</td>
                            <td className="py-2 pr-3 text-right font-mono">
                              {pred.daysUntilThreshold === Infinity ? "—" : pred.daysUntilThreshold === 0 ? "Now" : `${pred.daysUntilThreshold}d`}
                            </td>
                            <td className="py-2 pr-3">{pred.predictedThresholdDate ?? "—"}</td>
                            <td className="py-2 pr-3">
                              <span className={`px-2 py-0.5 rounded-full font-semibold capitalize ${confidenceStyle(displayConf)}`}>{displayConf}</span>
                              {confBoosted && <span className="ml-1 text-primary text-[10px] font-bold">↑driver</span>}
                              {pred.inferredFromFleet && !confBoosted && <span className="ml-1 text-muted-foreground text-[10px]">(fleet avg)</span>}
                            </td>
                            <td className="py-2">
                              <span className={`px-2 py-0.5 rounded-full font-semibold ${badge.cls}`}>{badge.label}</span>
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
                          {criticalRows.length > 0
                            ? <span className="text-destructive font-semibold">{criticalRows.length} need urgent collection</span>
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
            </div>
          );
        })()}

      </main>

      {/* Modals */}
      {showDriverModal && <DriverReportModal onClose={() => setShowDriverModal(false)} />}
      {showCostReport && (
        <CostReportModal
          metrics={sr.aggregateMetrics}
          routeCount={Object.keys(sr.optimizedMap).length}
          weekLabel={`Week of ${thisWeek.label}`}
          onClose={() => setShowCostReport(false)}
        />
      )}
    </div>
  );
};

export default Index;
