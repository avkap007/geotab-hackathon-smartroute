import React, { useState, useEffect } from "react";
import type { AlgoMetrics } from "@/services/algorithm";
import type { LoadedRoute, OptimizedResult } from "@/hooks/useSmartRoute";
import { CheckIcon, CloseIcon } from "./SvgIcons";

interface OptimizeReviewModalProps {
  optimizedRoutes: { route: LoadedRoute; opt: OptimizedResult }[];
  onAccept: (routeId: string) => Promise<string | null>;
  onDiscard: (routeId: string) => void;
  onClose: () => void;
  /** Called whenever the viewed route changes — parent can zoom the map */
  onRouteChange?: (routeId: string) => void;
  /** When true, show "Preview only" UI — no Accept/Discard (Next Week forecast) */
  isForecast?: boolean;
}

const MetricRow: React.FC<{ label: string; value: string; highlight?: boolean }> = ({
  label,
  value,
  highlight,
}) => (
  <div className="flex justify-between items-center py-2 border-b border-border last:border-0">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className={`text-sm font-bold ${highlight ? "text-primary" : "text-foreground"}`}>
      {value}
    </span>
  </div>
);

const RouteCard: React.FC<{
  route: LoadedRoute;
  metrics: AlgoMetrics;
  accepted: boolean;
  accepting: boolean;
  assignedVehicle: string | null;
  onAccept: () => void;
  onDiscard: () => void;
  isForecast?: boolean;
}> = ({ route, metrics, accepted, accepting, assignedVehicle, onAccept, onDiscard, isForecast }) => (
  <div className="flex flex-col gap-4">
    <div className="flex items-center gap-3">
      <span className="w-3 h-3 rounded-full shrink-0" style={{ background: route.color }} />
      <div className="min-w-0">
        <h3 className="text-base font-extrabold text-foreground leading-tight">{route.name}</h3>
        {assignedVehicle && (
          <div className="text-[10px] text-muted-foreground mt-0.5">
            Assigned to: <span className="font-semibold text-foreground">{assignedVehicle}</span> (nearest to depot)
          </div>
        )}
      </div>
      <span className="text-xs text-muted-foreground ml-auto shrink-0">{route.bins.length} stops</span>
    </div>

    <div className="bg-muted/40 rounded-xl p-4">
      <MetricRow label="Hours saved" value={`${metrics.hoursSaved.toFixed(1)} hrs`} highlight />
      <MetricRow label="Fuel saved" value={`${metrics.fuelSavedL.toFixed(1)} L`} highlight />
      <MetricRow label="CO₂ avoided" value={`${metrics.co2AvoidedKg.toFixed(1)} kg`} highlight />
      <MetricRow label="Stops skipped" value={String(metrics.stopsSkipped)} />
      <MetricRow label="Distance saved" value={`${metrics.kmSaved.toFixed(1)} km`} />
    </div>

    {isForecast ? (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 py-2 px-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 font-semibold text-sm">
          Preview only — switch to This Week to save routes
        </div>
        <button
          onClick={onDiscard}
          className="w-full py-2.5 bg-muted hover:bg-muted/70 text-muted-foreground font-bold text-sm rounded-lg transition"
        >
          Got it
        </button>
      </div>
    ) : accepted ? (
      <div className="flex items-center gap-2 py-2 px-3 bg-green-50 rounded-lg text-green-700 font-semibold text-sm">
        <CheckIcon size={15} color="#15803d" />
        Saved to Geotab
      </div>
    ) : (
      <div className="flex gap-2">
        <button
          onClick={onAccept}
          disabled={accepting}
          className="flex-1 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {accepting ? (
            <span className="text-xs">Saving…</span>
          ) : (
            <>
              <CheckIcon size={14} color="white" />
              Accept &amp; Save
            </>
          )}
        </button>
        <button
          onClick={onDiscard}
          className="flex-1 py-2.5 bg-muted hover:bg-muted/70 text-muted-foreground font-bold text-sm rounded-lg transition"
        >
          Skip
        </button>
      </div>
    )}
  </div>
);

const OptimizeReviewModal: React.FC<OptimizeReviewModalProps> = ({
  optimizedRoutes,
  onAccept,
  onDiscard,
  onClose,
  onRouteChange,
  isForecast = false,
}) => {
  const [idx, setIdx] = useState(0);
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [accepting, setAccepting] = useState(false);

  const current = optimizedRoutes[idx];
  const total = optimizedRoutes.length;

  // Notify parent whenever route changes so map can zoom
  useEffect(() => {
    if (current) onRouteChange?.(current.route.id);
  }, [idx]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!current) return null;

  const handleAccept = async () => {
    setAccepting(true);
    await onAccept(current.route.id);
    setAccepted((prev) => ({ ...prev, [current.route.id]: true }));
    setAccepting(false);
    // Auto-advance after a moment
    if (idx < total - 1) {
      setTimeout(() => setIdx((i) => i + 1), 800);
    }
  };

  const handleDiscard = () => {
    onDiscard(current.route.id);
    if (idx < total - 1) setIdx((i) => i + 1);
  };

  const handleForecastDismiss = () => {
    if (idx < total - 1) setIdx((i) => i + 1);
    else onClose();
  };

  const isCurrentAccepted = accepted[current.route.id] || current.opt.accepted;

  const allDone = optimizedRoutes.every(
    (r) => accepted[r.route.id] || r.opt.accepted,
  );

  return (
    /* Panel — no backdrop; parent places this in the right column */
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-extrabold text-foreground">Optimized Routes</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Review and accept each route
          </p>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-full transition">
          <CloseIcon size={14} color="hsl(210, 15%, 50%)" />
        </button>
      </div>

      {/* Progress dots + bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            {idx + 1} of {total}
          </span>
          <div className="flex gap-1">
            {optimizedRoutes.map((r, i) => (
              <button
                key={r.route.id}
                onClick={() => setIdx(i)}
                className="rounded-full transition-all"
                style={{
                  width: i === idx ? 16 : 8,
                  height: 8,
                  background: i === idx ? r.route.color : "hsl(200, 18%, 85%)",
                }}
              />
            ))}
          </div>
        </div>
        <div className="h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${((idx + 1) / total) * 100}%`,
              background: current.route.color,
            }}
          />
        </div>
      </div>

      {/* Route card */}
      <div className="flex-1 overflow-y-auto">
        <RouteCard
          route={current.route}
          metrics={current.opt.result.metrics}
          accepted={isCurrentAccepted}
          accepting={accepting}
          assignedVehicle={current.opt.assignedVehicle}
          onAccept={handleAccept}
          onDiscard={isForecast ? handleForecastDismiss : handleDiscard}
          isForecast={isForecast}
        />
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4 border-t border-border mt-4">
        <button
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={idx === 0}
          className="text-xs font-semibold text-primary hover:underline disabled:opacity-30 disabled:no-underline"
        >
          ← Prev
        </button>

        {allDone ? (
          <button
            onClick={onClose}
            className="text-xs font-semibold text-green-600 hover:underline"
          >
            All done ✓
          </button>
        ) : idx < total - 1 ? (
          <button
            onClick={() => setIdx((i) => i + 1)}
            className="text-xs font-semibold text-primary hover:underline"
          >
            Next →
          </button>
        ) : (
          <button
            onClick={onClose}
            className="text-xs font-semibold text-primary hover:underline"
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
};

export default OptimizeReviewModal;
