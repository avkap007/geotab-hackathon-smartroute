import React from "react";
import type { AlgoMetrics } from "@/services/algorithm";
import { CheckIcon, CloseIcon } from "./SvgIcons";

interface RouteOverlayPanelProps {
  routeName: string;
  routeColor: string;
  metrics: AlgoMetrics;
  accepted: boolean;
  onAccept: () => void;
  onDiscard: () => void;
  onClose: () => void;
}

const RouteOverlayPanel: React.FC<RouteOverlayPanelProps> = ({
  routeName, routeColor, metrics, accepted, onAccept, onDiscard, onClose,
}) => {
  return (
    <div className="absolute bottom-4 left-4 z-[1000] bg-card/95 backdrop-blur-sm rounded-xl shadow-lg p-4 min-w-[260px] border border-border">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full" style={{ background: routeColor }} />
          <span className="text-sm font-bold text-foreground">{routeName}</span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-muted rounded-full transition">
          <CloseIcon size={14} color="hsl(240, 5%, 55%)" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
        <div>
          <span className="text-muted-foreground">Hours saved:</span>{" "}
          <b>{metrics.hoursSaved.toFixed(1)}</b>
        </div>
        <div>
          <span className="text-muted-foreground">Fuel saved:</span>{" "}
          <b>{metrics.fuelSavedL.toFixed(1)}L</b>
        </div>
        <div>
          <span className="text-muted-foreground">CO2 avoided:</span>{" "}
          <b>{metrics.co2AvoidedKg.toFixed(1)}kg</b>
        </div>
        <div>
          <span className="text-muted-foreground">Stops skipped:</span>{" "}
          <b>{metrics.stopsSkipped}</b>
        </div>
      </div>
      {accepted ? (
        <div className="text-xs text-green-600 font-semibold flex items-center gap-1">
          <CheckIcon size={14} color="#16a34a" /> Route accepted
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={onAccept}
            className="flex-1 py-2 bg-green-500 text-white text-xs font-bold rounded-lg hover:bg-green-600 transition"
          >
            Accept
          </button>
          <button
            onClick={onDiscard}
            className="flex-1 py-2 bg-red-100 text-red-600 text-xs font-bold rounded-lg hover:bg-red-200 transition"
          >
            Discard
          </button>
        </div>
      )}
    </div>
  );
};

export default RouteOverlayPanel;
