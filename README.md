# SmartRoute: Dynamic Waste Fleet Optimization

Connecting bin fill-level sensors to Geotab telematics for real-time route decisions.

## Overview

SmartRoute is a Geotab Add-In that integrates bin fill-level sensor data with vehicle telematics to dynamically optimize waste collection routes. Instead of fixed routes that hit every bin every day, SmartRoute only routes to bins that actually need emptying.

**Sensor-agnostic:** Works on day one with no sensors — use demo data, driver feedback, or historical inference. Add bin sensors when you're ready; SmartRoute consumes fill levels from any source.

**Hackathon:** Geotab Vibe Coding Challenge (Feb 12 – Mar 2, 2026)  
**Path:** [Path D – Advanced Add-In Development](https://github.com/fhoffa/geotab-vibe-guide#path-d-advanced-add-in-development) (Custom Add-Ins hosted on GitHub)  
**Guide:** [Building Geotab Add-Ins (GEOTAB_ADDINS.md)](https://github.com/fhoffa/geotab-vibe-guide/blob/main/guides/GEOTAB_ADDINS.md)

---

## What We Built

### This Week — Live Optimization

- **Load routes** from Geotab (`Get.Route`, `Get.Zone`) — search, add multiple routes, see bins on the map
- **Bin threshold slider** — bins below this fill level are candidates to skip
- **Route intensity slider** — controls how aggressively sub-threshold bins get re-inserted if they're cheap to add
- **Optimize** — Clarke-Wright Savings + OR-Opt algorithm runs client-side; skips unnecessary stops
- **Review overlay** — floating panel on the map with before/after metrics, vehicle assignment (nearest Geotab vehicle to depot), Accept/Discard
- **Accept** — writes optimized route back to Geotab (`Add.Route`, `RoutePlanItems`, Zones); drivers see updated routes in GO app
- **Stats** — stops skipped, km saved, fuel saved, CO₂ avoided, hours saved (including ~5 min idle per skipped stop)
- **Geotab Ace** — fleet insight generated from optimization results; falls back to CO₂-to-trees message if Ace unavailable
- **Cost report** — editable fuel/driver/CO₂ assumptions → weekly + annual savings, copy to clipboard

### Next Week — Forecast Mode

- **Week toggle** — switch between "This Week" (live sensor data) and "Next Week Forecast" (predicted fill levels)
- **Projected fill** — `currentFill + fillRatePerDay × daysToNextMonday` per bin
- **Forecast optimization** — same algorithm on projected bins; stored in separate `forecastOptimizedMap` (never overwrites accepted routes)
- **Preview only** — no Accept button; look-ahead for capacity planning and driver scheduling
- **Day-of-week summary** — "Mon 4 · Tue 2 · Wed 1 · Thu 5 · Fri 3" bins hitting threshold by weekday

### Bin Fill Predictions

- **Per-bin predictions** — `fillRatePerDay`, `daysUntilThreshold`, `predictedThresholdDate` from collection history in AddInData
- **Recency-weighted model** — exponential decay 0.8; fleet-wide fallback for bins with insufficient data
- **Critical / Soon / On track** — bins grouped by urgency (≤2 days, ≤5 days, or on track)
- **Highlight on map** — pulse critical bins on the map
- **Action badges** — "Collect Mon/Tue", "Collect mid-week", etc. per bin
- **Estimated time** — "~45 min to collect 5 critical bins"

### UX

- **6-step onboarding tour** — search, week toggle, threshold, optimize, predicted data, next week forecast
- **Teal/navy palette** — modern, accessible
- **Animated stat icons** — clock, fuel, CO₂, stops
- **Map auto-zoom** — focuses on selected route when cycling review overlay
- **Accepted routes** — chips and polylines turn green; toast confirmation

---

## Algorithm

**Files:** `backend/smartroute-algo.js` (source) · `addin/src/services/algorithm.ts` (wrapper)

1. **Split by threshold** — Mandatory bins (`fillLevel >= threshold`) vs candidates
2. **Clarke-Wright Savings** — For each pair (i, j): `saving = depot→i + depot→j - i→j`. Greedy merge by highest savings; capacity 10 bins per route
3. **OR-Opt** — Move segments of 1–3 bins to other positions; accept if distance decreases
4. **Selective insertion** — For sub-threshold: `netValue = fillLevel - alpha × normalizedInsertionCost`. Insert when `netValue > 0`; `alpha = intensity × 3`
5. **Metrics** — km saved, fuel (0.3 L/km), CO₂ (2.68 kg/L), hours (driving + 5 min per bin + 5 min idle per skipped stop)

See [docs/avni-prompts.md](docs/avni-prompts.md) for prompts and judge Q&A.

---

## Quick Start

### Option A: GitHub-hosted (Path D – recommended for hackathon)

1. **Get Geotab credentials:** [Create a free demo database](https://my.geotab.com/registration.html) (click "Create a Demo Database")
2. **Host on GitHub Pages:**
   - Push this repo to GitHub (e.g. `avkap007/geotab-hackathon-smartroute`)
   - Settings → Pages → Source: Deploy from branch → main → Save
   - Your Add-In URL: `https://<your-username>.github.io/<repo>/addin/dist/index.html`
3. **Install the Add-In:**
   - Edit `addin/smartroute-config.json`: replace the `url` with your GitHub Pages URL
   - Copy the contents of `addin/smartroute-config.json`
   - In MyGeotab: User profile → Administration → System Settings → Add-Ins
   - Enable "Allow unverified Add-Ins" → Yes
   - New Add-In → Configuration tab → Paste → Save
4. **Refresh** and find "SmartRoute" in the sidebar

### Option B: Embedded (no hosting)

1. **Get Geotab credentials:** [Create a free demo database](https://my.geotab.com/registration.html)
2. Copy the **entire** contents of `addin/smartroute-embedded-config.json`
3. In MyGeotab: User profile → Administration → System Settings → Add-Ins → New Add-In → Configuration tab → Paste → Save
4. **Refresh** and find "SmartRoute" in the sidebar

### Build (for development)

```bash
cd addin
npm install
npm run build
```

The built Add-In lives in `addin/dist/`. Commit `addin/dist/` when deploying to GitHub Pages.

---

## Seed Demo Routes (Toronto)

Create zones + route in your Geotab DB:

```bash
node scripts/seed-demo-routes.js
```

Uses `data/toronto-route-demo.json`. Refresh the Add-In to see the new bins.

**Demo mode:** The Add-In also ships with fallback synthetic routes (Downtown West, Midtown East, Waterfront Loop) when no Geotab routes exist — no seeding required for a quick demo.

---

## Project Structure

```
smartroute/
├── .env.example              # Template for API keys (copy to .env)
├── addin/                    # Geotab Add-In (React + Vite)
│   ├── src/
│   │   ├── pages/Index.tsx   # Main dashboard
│   │   ├── hooks/useSmartRoute.ts  # State, Geotab API, algo orchestration
│   │   ├── services/
│   │   │   ├── algorithm.ts  # Wrapper for SmartRouteAlgo
│   │   │   ├── geotabApi.ts  # Route, Zone, DeviceStatusInfo, AddInData, Ace
│   │   │   └── routing.ts    # OSRM polyline fetch
│   │   └── components/      # Map, overlays, modals
│   ├── dist/                # Built output (deploy this to GitHub Pages)
│   ├── smartroute-config.json       # External hosted config
│   └── smartroute-embedded-config.json  # Embedded (no hosting)
├── backend/
│   └── smartroute-algo.js   # Clarke-Wright, OR-Opt, prediction (ES5)
├── data/
│   ├── bins-demo.json       # Synthetic bin data (fallback)
│   ├── bin-data.json        # Per-route fill + collection logs (used by addin)
│   └── toronto-route-demo.json  # Toronto zones for seed script
├── scripts/
│   ├── explore-db.js        # List devices, zones, routes
│   └── seed-demo-routes.js  # Create Toronto demo route
├── docs/
│   ├── API_KEYS.md          # Where to get API keys
│   ├── avni-prompts.md     # All prompts used for this project
│   ├── COLLABORATION.md    # Person 1/2 handoff, algo contract
│   ├── ROUTE_SCHEMA.md     # Zone/Route/RoutePlanItem schema
│   └── VISION.md           # Roadmap: skip logic, predictive, metrics
└── geotab-vibe-coding-resources/  # Curated refs from geotab-vibe-guide
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite, TypeScript, Tailwind |
| Map | Leaflet, react-leaflet, OSRM road polylines |
| Algorithm | Clarke-Wright + OR-Opt (ES5, `backend/smartroute-algo.js`) |
| Prediction | Recency-weighted fill rate, fleet fallback |
| Geotab | `api.call()` — Route, Zone, RoutePlanItem, DeviceStatusInfo, AddInData |
| AI | Geotab Ace API for fleet insight |
| Deployment | GitHub Pages → `addin/dist/` |

---

## Demo Mode

The hackathon demo uses **synthetic bin data** — no real sensor APIs needed. Bin fill levels come from `data/bin-data.json` and fallback demo routes. Geotab vehicle data comes from your demo database when connected.

---

## Production (Phase 2)

For real deployments:

- Backend proxies Sensoneo/Bigbelly APIs (keeps keys server-side)
- Mapbox Optimization API for route optimization
- Session verification per Geotab security patterns

See `backend/README.md` and `docs/API_KEYS.md`.

---

## References

- [geotab-vibe-guide](https://github.com/fhoffa/geotab-vibe-guide) — Add-In patterns, API reference, hackathon ideas
- [docs/avni-prompts.md](docs/avni-prompts.md) — All prompts used for this project (Ace API, development, demo)
