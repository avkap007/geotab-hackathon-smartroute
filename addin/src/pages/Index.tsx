import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer } from
"recharts";
import SmartRouteMap, { type Bin, type OptimizeState } from "@/components/SmartRouteMap";
import {
  TruckIcon, ClockIcon, FuelIcon, LeafIcon, SkipIcon,
  SearchIcon, CalendarIcon, CheckIcon, CloseIcon, SpinnerIcon,
  PinIcon, BinCharacter } from
"@/components/SvgIcons";

// ═══════════════════════════════════════════════
// MOCK DATA — swap with API calls later
// ═══════════════════════════════════════════════

const bins: Bin[] = [
{ id: 1, name: "Bin #A12", lat: 43.6555, lng: -79.3806, fillLevel: 85, lastCollected: "2 days ago" },
{ id: 2, name: "Bin #B07", lat: 43.6485, lng: -79.3953, fillLevel: 22, lastCollected: "Today" },
{ id: 3, name: "Bin #C33", lat: 43.6610, lng: -79.3876, fillLevel: 60, lastCollected: "1 day ago" },
{ id: 4, name: "Bin #D19", lat: 43.6440, lng: -79.3720, fillLevel: 91, lastCollected: "3 days ago" },
{ id: 5, name: "Bin #E55", lat: 43.6580, lng: -79.3680, fillLevel: 38, lastCollected: "Today" }];


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
  const [threshold, setThreshold] = useState(50);
  const [optimizeState, setOptimizeState] = useState<OptimizeState>("idle");
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState(["Asset 1", "Route 1", "Route 2", "Asset 3", "Route 4"]);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const MAX_VISIBLE_CHIPS = 2;
  const [startDate, setStartDate] = useState("2026-02-15");
  const [endDate, setEndDate] = useState("2026-03-02");

  // Derived stats
  const binsBelow = bins.filter((b) => b.fillLevel < threshold).length;
  const stopsSkipped = binsBelow;
  const hoursSaved = binsBelow * 0.5;
  const fuelSaved = binsBelow * 12.4;
  const co2Reduced = binsBelow * 8.2;

  const handleOptimize = () => {
    if (optimizeState === "loading" || optimizeState === "showing-original") return;
    setOptimizeState("loading");
    setTimeout(() => setOptimizeState("showing-original"), 600);
    setTimeout(() => setOptimizeState("optimized"), 2200);
  };

  const removeFilter = (f: string) => {
    setFilters((prev) => {
      const next = prev.filter((x) => x !== f);
      if (next.length <= MAX_VISIBLE_CHIPS) setFiltersExpanded(false);
      return next;
    });
  };

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
            {filters.length === 0 ? (
              /* ── Single-row: no tags ── */
              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-xs">
                  <SearchIcon size={16} color="hsl(240, 5%, 55%)" className="absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search routes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-muted text-sm placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30 transition" />
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
                  <div className="relative">
                    <SearchIcon size={16} color="hsl(240, 5%, 55%)" className="absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search routes..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-muted text-sm placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30 transition" />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {(filtersExpanded ? filters : filters.slice(0, MAX_VISIBLE_CHIPS)).map((f) =>
                    <button
                      key={f}
                      onClick={() => removeFilter(f)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition shrink-0">
                        {f}
                        <CloseIcon size={12} color="hsl(200, 70%, 55%)" />
                      </button>
                    )}
                    {filters.length > MAX_VISIBLE_CHIPS && !filtersExpanded && (
                      <button
                        onClick={() => setFiltersExpanded(true)}
                        className="px-3 py-1.5 rounded-full bg-muted text-muted-foreground text-xs font-semibold hover:bg-muted/80 transition shrink-0">
                        +{filters.length - MAX_VISIBLE_CHIPS} more
                      </button>
                    )}
                    {filtersExpanded && filters.length > MAX_VISIBLE_CHIPS && (
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
            {/* Map */}
            <div className="relative flex-1 min-h-0">
              <div className="bg-card shadow-sm overflow-hidden rounded h-full">
                <SmartRouteMap bins={bins} threshold={threshold} optimizeState={optimizeState} />
              </div>
              <div className="absolute top-4 right-4 z-[1000] bg-card/90 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center gap-1.5 shadow-sm">
                <PinIcon size={14} color="#7EC8E3" />
                <span className="text-xs font-semibold text-foreground">Route Preview</span>
              </div>
            </div>
          </div>

          {/* RIGHT — Controls */}
          <div className="w-[35%] flex flex-col gap-4">
            {/* Threshold Card */}
            <div className="bg-card shadow-sm p-6 rounded">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                Bin Threshold
              </label>
              <BinThresholdSlider value={threshold} onChange={setThreshold} />
              <div className="text-center mt-2">
                <span className="text-4xl font-extrabold text-primary">{threshold}</span>
                <span className="text-lg font-bold text-primary">%</span>
              </div>
              <p className="text-[11px] text-muted-foreground text-center mt-1">
                Bins at or above this fill level will be collected
              </p>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                icon={<ClockIcon size={28} color="#7EC8E3" />}
                value={hoursSaved}
                unit="hrs"
                label="Hours Saved" />

              <StatCard
                icon={<FuelIcon size={28} color="#7EC8E3" />}
                value={fuelSaved}
                unit="L"
                label="Fuel Saved" />

              <StatCard
                icon={<LeafIcon size={28} color="#6BCB9F" />}
                value={co2Reduced}
                unit="kg"
                label="CO₂ Reduced" />

              <StatCard
                icon={<SkipIcon size={28} color="#C9B6FF" />}
                value={stopsSkipped}
                unit=""
                label="Stops Skipped"
                decimals={0} />

            </div>

            {/* Optimize Button */}
            <div className="flex-1 min-h-0" />
            <button
              onClick={handleOptimize}
              disabled={optimizeState === "loading" || optimizeState === "showing-original"}
              className="w-full py-3.5 bg-gradient-to-r from-[#7EC8E3] to-[#C9B6FF] text-white font-bold text-sm flex items-center justify-center gap-2.5 hover:opacity-90 transition disabled:opacity-60 shadow-md rounded">

              {optimizeState === "loading" || optimizeState === "showing-original" ?
              <>
                  <SpinnerIcon size={18} color="white" />
                  Optimizing...
                </> :
              optimizeState === "optimized" ?
              <>
                  <CheckIcon size={18} color="white" />
                  Optimized!
                </> :

              <>
                  <TruckIcon size={18} color="white" />
                  optimize these routes
                </>
              }
            </button>
          </div>
        </div>

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
      </main>
    </div>);

};

export default Index;