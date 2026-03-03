# SmartRoute — Prompts Used for This Project

All prompts used during the development of SmartRoute for the Geotab Vibe Coding Hackathon (Feb–Mar 2026).

---

## 1. In-App Prompts (Geotab Ace API)

**Location:** `addin/src/hooks/useSmartRoute.ts` (lines 276–279)

Sent to Geotab Ace after optimization completes to generate a fleet insight:

```
Give one concise sentence of fleet insight about smart waste collection efficiency. Context: route optimization reduced total travel distance by {totalKmSaved} km and skipped {totalStopsSkipped} unnecessary bin stops. Focus on environmental or operational benefit.
```

**Template (with placeholders):**
```
Give one concise sentence of fleet insight about smart waste collection efficiency. Context: route optimization reduced total travel distance by ${totalKmSaved.toFixed(1)} km and skipped ${totalStopsSkipped} unnecessary bin stops. Focus on environmental or operational benefit.
```

---

## 2. Development Prompts (User → AI Assistant)

Prompts used to guide feature development and implementation.

### Onboarding & Tour

- *"Add onboarding steps 5 and 6: step 5 = bottom half 'this is predicted data'; step 6 = back to top 'click next week to see next week's forecast'"*
- *"In the onboarding flow add after step 4 we have like step 5 and 6 also to show the bottom half to say this is predicted data and then going back to top to say click next week to see next weeks forecast"*

### Next Week Forecast Workflow

- *"Implement the Next Week Forecast Workflow plan"* (referencing `next_week_forecast_workflow_7502b848.plan.md`)
- *"Add forecastOptimizedMap and runForecastOptimize"*
- *"Add isForecast to OptimizeReviewModal and RouteOverlayPanel"*
- *"Day-of-week summary, View on map, Estimated stops"*
- *"Section headers: This Week · Optimize and save vs Next Week · Look ahead"*
- *"Optimize Next Week button"*

### UI & UX

- *"Add route intensity info tooltip"*
- *"Add guided onboarding"*
- *"Move optimize button"*
- *"Rename to 'Optimize & See Savings'"*
- *"Auto-zoom to selected route when cycling"*
- *"Change review panel to an overlay beside the map that moves with each route when cycling"*
- *"Teal palette, remove purple"*
- *"Make Ace insight visible with fallback"*
- *"Replace bin threshold icon with a simple dot (like Route Intensity)"*
- *"Animate metric icons"*
- *"Use same dot for bin threshold as Route Intensity"*

### Bin Predictions & Fleet Manager

- *"Add action items for fleet managers"*
- *"Add Overflow Risk Score and Driver Report Impact Simulator"*
- *"Implement Fleet Manager UX Story: week toggle, data labels, vehicle assignment, cost report"*
- *"Split bin fill predictions: top = this week status, bottom = next week forecast"*
- *"Add 'Highlight on map' for critical bins"*
- *"Better accept toast and show accepted routes in green"*
- *"Add idle/stop time to algo metrics"*
- *"Remove two charts (Fuel Saved This Month, Weekly Stops Skipped)"*

### Demo & Documentation

- *"Make me a script to do the demo"*
- *"Talk about how we made it, look at the code and the logic"*
- *"Update the README properly with all the info"*
- *"Add how does the algo work — read the code first and tell me which files have it"*
- *"Make the hook more exciting and pitch-like"*
- *"Make sure we show it's for garbage trucks, it is unique, it allows for both sensor data + human in the loop data"*
- *"Do a web search to check to make the hook stronger"*

---

## 3. Starter Prompts (Project Kickoff)

Prompts that could be used to start a similar project from scratch.

### From geotab-vibe-guide HACKATHON_IDEAS.md (RouteGenius)

```
"Create a map visualization showing all delivery routes from the past week using Geotab GPS data and Leaflet.js. Color-code routes by efficiency (green = optimal, red = poor)."

"Build a route optimizer that takes a list of delivery addresses and uses historical Geotab data to suggest the optimal visiting order to minimize drive time."

"Integrate with Geotab Ace to analyze idle time on routes and suggest where drivers can reduce stops or take better paths."
```

### Generic Project Plan

```
"I want to build [SmartRoute / waste collection optimizer]. Help me create a project plan with steps, technologies to use, and first 3 API calls to make."
```

### Add-In Scaffold (from GEOTAB_ADDINS.md)

```
"Build a Geotab Add-In that [loads routes from Geotab, displays bins on a map, runs optimization, writes back optimized routes]. Use the Geotab API for Route, Zone, RoutePlanItem. Include a threshold slider and a map with Leaflet."
```

---

## 4. Demo Script Prompts (For Judges)

The hook and key talking points:

### Hook (20 sec)

> "Picture this: a garbage truck stops at a bin that's 10% full. Then drives past one that's overflowing. Same route, same day, every week. That's not a bug — that's how most waste fleets run. But what if 80% of those stops were unnecessary? A Stockholm pilot proved it. SmartRoute is the Geotab Add-In that makes it real. We built it for waste fleets — and here's the kicker: it works with sensors when you have them, and with driver feedback or predictions from history when you don't. No vendor lock-in. Skip the bins that can wait. Optimize the rest. Write back to Geotab. Less miles. Less CO₂. Same service. That's SmartRoute."

### Prize-Alignment Talking Points

| Award | Emphasize |
|-------|-----------|
| **Vibe Master** | Innovation, utility, execution |
| **Innovator** | Clarke-Wright + OR-Opt, Geotab Ace, prediction model |
| **Disruptor** | Same pattern for waste, deliveries, inspections, service |
| **Best Use of Google Tools** | Geotab Ace API, optional Google Distance Matrix |
| **Green Award** | CO₂ avoided, fuel saved, idle time eliminated |

---

## 5. Plan Reference

The Next Week Forecast Workflow was implemented from:

**File:** `~/.cursor/plans/next_week_forecast_workflow_7502b848.plan.md`

Key implementation prompts derived from the plan:

- Add `forecastOptimizedMap` state (separate from `optimizedMap`)
- When `isForecast`: build bins with `projectedFill = min(100, currentFill + fillRatePerDay × daysToNextMonday)`
- Add `isForecast` prop to OptimizeReviewModal and RouteOverlayPanel
- Show "Preview only" UI instead of Accept/Discard when forecast mode
- Replace BinThresholdSlider with plain range input
- Add day-of-week summary: "Mon 4 · Tue 2 · Wed 1 · Thu 5 · Fri 3"

---

## 6. Sources for Hook Stats

- **80% stop reduction:** Stockholm pilot (Connected Bins / Kista)
- **Half-empty bins:** Smart Ends, BrighterBins
- **30% cost reduction:** Edinburgh Council, 11,000 bins (BrighterBins)
- **Sensor + human:** Most fleets still rely on driver observation; SmartRoute supports both
