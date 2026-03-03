# SmartRoute — Demo Script
**3-Minute Presentation**

---

## Before You Start

- SmartRoute open in MyGeotab (or GitHub Pages preview), page refreshed
- No routes loaded, threshold at 50%, week toggle on "This Week"

---

## The Hook (20 sec)



"Our motivation for the problem comes from garbage trucks. They run fixed routes, same bins, say day, every week. They stop at half-empty bins whilst missing overflowing ones. A Stockholm pilot study proved a feasible alternative. They cut collection stops by 80% by only emptying bins that actually needed it. and with that, we present our solution -- Smartroute; What makes it unique: it works with real-time sensor data when you have it, and with driver feedback or predictions from collection history when you don't."
---

## Load + Optimize (1 min)

**Action:** Type "Downtown" → select "Downtown West." Add "Midtown East."
> "SmartRoute calls Geotab's API directly — `Get.Route`, `Get.Zone`, `Get.DeviceStatusInfo` — no separate login. When a route loads, the map shows each bin colored by fill level. Red is full, green is empty."

**Action:** Click "Optimize This Week's Routes."

> The algorithm solves a hybrid two-zone Vehicle Routing Problem. Bins are split into two zones based on a user-set threshold, and each zone is handled differently:

Zone 1 — Mandatory (fill level ≥ threshold): Always collected. Routed using Clarke-Wright Savings.
Zone 2 — Selective (fill level < threshold): Each bin is evaluated on profit vs. detour cost. Inclusion is controlled by an intensity slider.

**Point at the stats:**

> "X stops skipped. X km saved. X litres of fuel. X kg of CO₂. And Geotab Ace fires in the background — it reads the optimization result and generates a one-sentence fleet insight."

---

## Review + Accept (45 sec)

**Action:** Click "Review Routes" — overlay appears bottom-left on the map.

> "The review panel floats on the map so you can see the optimized route while you review it. It shows before/after stop count, savings metrics, and — because we call `DeviceStatusInfo` — it assigns the nearest real Geotab vehicle to this route's depot using a Haversine distance calculation."

**Action:** Click the arrow to cycle routes — map auto-zooms to each one.

**Action:** Accept a route.

> "Accepting writes back to Geotab: `api.call('Add', { typeName: 'Route' })` with the optimized stop sequence. The route chip turns green. The driver sees the updated route in their GO app immediately."

---

## Next Week Forecast (45 sec)

**Action:** Click "Next Week Forecast" toggle.

> "Switch to Next Week and the data source changes — amber badge, 'Predicted fill levels.' Click Optimize."

> "For each bin, we project fill to next Monday: `currentFill + fillRatePerDay × daysToNextMonday`. Fill rates come from a linear regression on 4 weeks of collection history stored in AddInData. The result goes into a separate forecast state — it never overwrites this week's accepted routes."

**Point at the review overlay:**

> "'Preview only — not saved.' This is a look-ahead tool. Scroll down and you see the day-of-week summary: which bins hit threshold Monday, Tuesday, Wednesday. Plan your capacity and driver shifts before the week starts."

---

## The Close (10 sec)

> "Works on day one with no sensors. Sensor data plugs straight in when you have it. Sensor-agnostic, Geotab-native, and everything writes back to your database."

---

## If Asked: Judge Questions

**Algorithm?** See "How the Algorithm Works" below.

**Fill level source?** `AddInData` — seeded for demo. In production: bin sensors, driver feedback, or inferred from collection history. Sensor-agnostic.

**Geotab writeback real?** Yes — `Add.Route` + `RoutePlanItems` + Zones. Works against a live Geotab database.

**Next Week forecast?** `projectedFill = currentFill + fillRatePerDay × daysToNextMonday`. Linear regression on collection logs. Stored in `forecastOptimizedMap` — separate from live results.

**Ace API?** We pass km saved + stops skipped to Ace and get a natural language fleet insight back. Falls back to a CO₂-to-trees equivalent if Ace is unavailable.

---

## How the Algorithm Works

**Files:** `backend/smartroute-algo.js` (source) · `addin/src/services/algorithm.ts` (wrapper) · `addin/dist/smartroute-algo.js` (built copy)

### Flow (from `runWithDistFn` in smartroute-algo.js)

1. **Split by threshold** — Bins with `fillLevel >= threshold` are mandatory. The rest are candidates.

2. **Phase 1-A: Clarke-Wright Savings** — For every pair of bins (i, j), compute:
   ```
   saving = depot→i + depot→j - i→j
   ```
   Sort pairs by saving descending. Greedily merge routes: take the highest-saving pair first. If both bins are endpoints of different routes and the merged route doesn't exceed capacity (default 10 bins), merge them. Repeat until no more merges. Each route is a depot round-trip.

3. **Phase 1-B: OR-Opt** — For each route, try moving segments of 1, 2, or 3 consecutive bins to every other position. Accept the move only if it strictly reduces total route distance. Repeat until no improvement.

4. **Phase 2: Selective insertion** — For sub-threshold candidates:
   ```
   netValue = fillLevel - (alpha × normalizedInsertionCost)
   ```
   `alpha = intensity × 3` (maps the 0–1 slider to 0–3). Sort candidates by fillLevel descending. Insert candidates with `netValue > 0` at their cheapest insertion position. If `intensity = 0`, insert all candidates unconditionally at cheapest positions. High-fill bins get first dibs on cheap slots.

5. **Metrics** — `kmSaved` = original NN baseline vs optimized. `fuelSavedL = kmSaved × 0.3`. `co2AvoidedKg = fuelSavedL × 2.68`. `hoursSaved` includes driving time (25 km/h) + service time (5 min per bin). The wrapper in `algorithm.ts` adds `idleMinutesSaved = stopsSkipped × 5` for engine idle + collection time per skipped stop.

### Prediction model (from `predict` in smartroute-algo.js)

- Recency-weighted average of fill rates (exponential decay 0.8 — most recent logs weigh more)
- `fillRatePerDay` from consecutive collection log pairs: `fillPctAtCollection / daysBetween`
- `daysUntilThreshold = (threshold - currentFill) / fillRatePerDay`
- Confidence: high (≥5 observations, stdDev < 5), medium (≥3 or stdDev < 15), low otherwise
- Fleet-wide fallback: if a bin has < 2 observations, use the global fleet average fill rate (or 10%/day if no fleet data)

---

## Prize Alignment (tailor your pitch)

| Award | What to emphasize |
|-------|-------------------|
| **Vibe Master** | Innovation (threshold + forecast), utility (works today, no sensors), execution (Geotab-native, writes back) |
| **Innovator** | Clarke-Wright + OR-Opt + selective insertion; Geotab Ace for fleet insight; prediction model from collection history |
| **Disruptor** | Same pattern for waste, deliveries, inspections, service — not locked to one vertical |
| **Best Use of Google Tools** | Geotab Ace API for natural-language fleet insight; optional Google Distance Matrix for road distances |
| **Green Award** | CO₂ avoided, fuel saved, idle time eliminated; "less driving, same service" |

---

## Hook Sources (if asked)

- **80% stop reduction:** Stockholm pilot — 7,138 stops/week → 1,072 with sensor-based collection (Connected Bins / Kista)
- **Half-empty bins:** Traditional fixed routes "repeatedly visit half-empty bins while missing overflow situations" (Smart Ends, BrighterBins)
- **30% cost reduction:** Edinburgh Council, 11,000 bins with smart sensors (BrighterBins case study)
- **Sensor + human:** Most fleets still rely on driver observation; SmartRoute supports both sensor data and driver feedback / historical inference
