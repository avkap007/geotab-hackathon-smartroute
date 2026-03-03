import React, { useState } from "react";
import type { AlgoMetrics } from "@/services/algorithm";
import type { LoadedRoute, OptimizedResult } from "@/hooks/useSmartRoute";
import { CheckIcon, CloseIcon } from "./SvgIcons";

interface OptimizeReviewModalProps {
  optimizedRoutes: { route: LoadedRoute; opt: OptimizedResult }[];
  onAccept: (routeId: string) => Promise<string | null>;
  onDiscard: (routeId: string) => void;
  onClose: () => void;
}

const MetricRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex justify-between items-center py-2 border-b border-border last:border-0">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="text-sm font-bold text-foreground">{value}</span>
  </div>
);

const RouteCard: React.FC<{
  route: LoadedRoute;
  metrics: AlgoMetrics;
  accepted: boolean;
  onAccept: () => void;
  onDiscard: () => void;
}> = ({ route, metrics, accepted, onAccept, onDiscard }) => (
  <div className="flex flex-col gap-4">
    {/* Route header */}
    <div className="flex items-center gap-3">
      <span className="w-4 h-4 rounded-full shrink-0" style={{ background: route.color }} />
      <h3 className="text-lg font-extrabold text-foreground">{route.name}</h3>
      <span className="text-xs text-muted-foreground ml-auto">{route.bins.length} stops</span>
    </div>

    {/* Metrics */}
    <div className="bg-muted/40 rounded-xl p-4">
      <MetricRow label="Hours saved" value={`${metrics.hoursSaved.toFixed(1)} hrs`} />
      <MetricRow label="Fuel saved" value={`${metrics.fuelSavedL.toFixed(1)} L`} />
      <MetricRow label="CO₂ avoided" value={`${metrics.co2AvoidedKg.toFixed(1)} kg`} />
      <MetricRow label="Stops skipped" value={String(metrics.stopsSkipped)} />
      <MetricRow label="Distance saved" value={`${metrics.kmSaved.toFixed(1)} km`} />
    </div>

    {/* Action buttons */}
    {accepted ? (
      <div className="flex items-center gap-2 text-green-600 font-semibold text-sm">
        <CheckIcon size={16} color="#16a34a" />
        Route accepted and saved to Geotab
      </div>
    ) : (
      <div className="flex gap-3">
        <button
          onClick={onAccept}
          className="flex-1 py-3 bg-green-500 hover:bg-green-600 text-white font-bold text-sm rounded-xl transition flex items-center justify-center gap-2"
        >
          <CheckIcon size={16} color="white" />
          Accept & Save Route
        </button>
        <button
          onClick={onDiscard}
          className="flex-1 py-3 bg-muted hover:bg-muted/80 text-muted-foreground font-bold text-sm rounded-xl transition"
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
}) => {
  const [idx, setIdx] = useState(0);
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [accepting, setAccepting] = useState(false);

  const current = optimizedRoutes[idx];
  const total = optimizedRoutes.length;

  if (!current) return null;

  const handleAccept = async () => {
    setAccepting(true);
    await onAccept(current.route.id);
    setAccepted((prev) => ({ ...prev, [current.route.id]: true }));
    setAccepting(false);
  };

  const handleDiscard = () => {
    onDiscard(current.route.id);
    if (idx < total - 1) {
      setIdx((i) => i + 1);
    }
  };

  const isCurrentAccepted = accepted[current.route.id] || current.opt.accepted;

  return (
    /* Backdrop */
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-extrabold text-foreground">Optimized Routes</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Review and accept each optimized route
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition">
            <CloseIcon size={16} color="hsl(240, 5%, 55%)" />
          </button>
        </div>

        {/* Progress indicator */}
        <div className="px-6 pt-4 pb-0">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              Route {idx + 1} of {total}
            </span>
            <div className="flex gap-1">
              {optimizedRoutes.map((r, i) => (
                <button
                  key={r.route.id}
                  onClick={() => setIdx(i)}
                  className="w-2 h-2 rounded-full transition-all"
                  style={{
                    background: i === idx ? r.route.color : "hsl(214, 20%, 85%)",
                    transform: i === idx ? "scale(1.4)" : "scale(1)",
                  }}
                />
              ))}
            </div>
          </div>
          {/* Progress bar */}
          <div className="h-1 bg-muted rounded-full overflow-hidden mb-4">
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
        <div className="px-6 pb-4">
          <RouteCard
            route={current.route}
            metrics={current.opt.result.metrics}
            accepted={isCurrentAccepted}
            onAccept={handleAccept}
            onDiscard={handleDiscard}
          />
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/20">
          <button
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            disabled={idx === 0}
            className="text-xs font-semibold text-primary hover:underline disabled:opacity-30 disabled:no-underline"
          >
            ← Previous
          </button>

          {accepting && (
            <span className="text-xs text-muted-foreground">Saving to Geotab...</span>
          )}

          {idx < total - 1 ? (
            <button
              onClick={() => setIdx((i) => i + 1)}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Next Route →
            </button>
          ) : (
            <button
              onClick={onClose}
              className="text-xs font-semibold text-green-600 hover:underline"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OptimizeReviewModal;
