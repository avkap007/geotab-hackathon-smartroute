# SmartRoute feasibility and hackathon alignment using the Geotab Vibe Guide

## Executive summary
SmartRoute (dynamic waste-fleet optimisation from bin fill levels) is **highly aligned** with the hackathon’s stated intent: it is explicitly a “Niche Solution” for **Waste Management**, fits the “Custom Add‑Ins” path, and can be built as a **functional prototype** against the hackathon’s “real‑world simulated data” environment. citeturn8view0turn22view1turn3view0

On feasibility (24‑hour prototype), the MVP is realistic **without** any live third‑party bin-sensor vendor API integrations. You can demo convincingly using simulated fill-level payloads because (a) the hackathon itself is framed around a simulator with live‑simulated fleet data, and (b) vendor systems largely boil down to a small schema (bin ID, location, fill %, timestamp) that can be faithfully mocked. citeturn8view0turn19view0turn12view2

The best “24‑hour” build strategy is:
- **Embedded MyGeotab Add‑In** (Gem/embedded config) hosting the map UI + threshold slider + instant re-optimisation. The repo explicitly recommends this as the fastest path (no hosting) and provides a Leaflet + DeviceStatusInfo example. citeturn22view1turn17view2  
- **Persist bin states + “collection logs” in AddInData** via the official Storage API, so the demo feels real (history, auditability, repeatability) without needing a backend. citeturn7view4turn7view3  
- **Write routes into MyGeotab** using the Route + RoutePlanItem + Zone entities (routes are defined as sequences of zones). Use Basic routes (no device assignment) to avoid subscription/UI dependencies and keep the demo reliable. citeturn21view0turn16view0turn9view0turn11view1

Evidence that this concept is “real-world plausible” and not just a hackathon gimmick is strong:
- Sensoneo’s case study reports bins being collected at **24% / 45% average fullness**, and after route/frequency recalculation they report **63% / 43% cost savings** in two municipalities; they also describe sensors measuring fill levels **24 times/day** and sending data to a cloud platform used for route planning. citeturn12view2turn12view3  
- A peer-reviewed optimisation study finds variable routing based on real‑time bin levels improves efficiency by **26.08%** at a **70% collection threshold**, with **44.44% cost savings** and **17.6% emissions reduction** at that threshold—this cleanly supports your threshold slider demo. citeturn18view0  

---

## Required APIs and repo files
The table below separates what’s **required for the MVP** from what’s **optional** for better realism, and ties each element to the exact repo paths you referenced.

| MVP feature | Geotab API objects & methods | Why it’s needed | Repo file(s) and why | Notes / constraints |
|---|---|---|---|---|
| Embedded Add‑In quick setup | Add‑In config (`items` + `files`) and `geotab.addin[...]` lifecycle (`initialize/focus/blur`) | Fastest hackathon-ready UI inside MyGeotab | `resources/GEM_INSTRUCTIONS.txt` (embedded JSON schema, lifecycle pattern, debug requirements, ES5 rules) citeturn3view1turn17view4 | Embedded Add‑Ins require **ES5-only JS** and inline CSS; modern JS is explicitly banned in Gem instructions. citeturn17view0 |
| Map with vehicles + bins | `DeviceStatusInfo` via `Get` | Real vehicle starting points + credibility (“this truck is here now”) | Gem instructions include a Leaflet + `DeviceStatusInfo` map example. citeturn17view2turn7view2 | DeviceStatusInfo’s role is “current state incl. bearing/location/speed.” citeturn7view2 |
| Fetch devices list | `Device` via `Get` (optional but typical) | Let user pick trucks; label markers; demo fleet selection | `skills/geotab/SKILL.md` lists common TypeNames and patterns. citeturn4view5 | Not strictly required if you just visualise DeviceStatusInfo markers. |
| Threshold slider + re-optimisation | No special Geotab entity—client logic | Live “recompute route when threshold changes” | Gem instructions recommend Leaflet/Chart.js and emphasise iterative prototyping. citeturn17view2turn22view1 | Keep the optimiser lightweight (heuristics) for 24h. |
| Persist simulated bin states (fill % time series) | `AddInData` via Storage API: `Add`, `Get`, `Set` | Makes the demo repeatable (“same bins, evolving fill levels”), no external DB | Official Storage API docs + AddInData object docs citeturn7view4turn7view3 | AddInData is explicitly for “structured JSON” storage. citeturn7view4 |
| Persist “collection logs” (what bin collected when, with fill %) | `AddInData` (separate “collectionLog” record type) | Core proof you’re building an operational system, not just a dashboard | Same as above citeturn7view4turn7view3 | AddInData has rate limits (Add: 100/min). citeturn7view3 |
| Make bins “real” inside MyGeotab | `Zone` via `Add` and `Get` | Routes are sequences of zones; zones give you durable IDs + exportability | `Zone` API reference: zones are “geofences” defined by points; must be closed polygon. citeturn9view0 | **Key detail:** Points must form a closed shape (first=last). citeturn9view0 |
| Write optimised route into MyGeotab | `Route` via `Add` / `Set` using `RoutePlanItemCollection`; `RoutePlanItem` objects require `Zone` + `Sequence` | This is your “operational intervention” proof: a real route object exists in platform | Route/RoutePlanItem references citeturn21view0turn16view0 | Routes are “connected sequence of zones.” citeturn21view0 |
| Avoid device/driver assignment risk | `RouteType` = Basic | Avoid entitlement and scheduling complexity | RouteType docs: Basic route has no Device; Plan route has Device. citeturn11view1turn21view0 | For hackathon: Basic route is safer (no assignment). |
| Optional: “merge bins with real vehicle traces” | `LogRecord` via `Get` (and possibly `GetFeed`) | Place bins along realistic street corridors; show “before route” trace | LogRecord docs: lat/lon/time/speed; includes GetFeed rate limits. citeturn7view6 | Treat availability + fields as **unspecified** in your demo DB until confirmed. |
| Optional: show “planned vs optimised” route using platform UX | Routes UI | Builds credibility: MyGeotab routes are built by connecting zones; planned vs unplanned exists | Routes help docs: routes built by connecting zones; planned vs unplanned. citeturn10search10turn0search1 | UI availability can vary; don’t make demo depend on a specific module. |
| Optional “agentic” automation (periodic updates) | n8n flow calling `Authenticate` + `Get` + `Add/Set` | Makes it feel “real time” even when Add‑In tab is closed | `guides/AGENTIC_QUICKSTART_N8N.md` (schedule→fetch→filter→act pattern; explicit note about balancing interval vs API limits). citeturn22view0turn4view6 | Useful but not required to win; adds operational realism. |
| Optional: Data Connector for KPIs | Data Connector (OData) | Fleet-wide aggregated KPIs, not needed for routing MVP | Data Connector guide in repo warns it is Basic Auth on separate server and “not accessible from Add-Ins.” citeturn4view1turn4view5 | Also requires enabling/install; pipelines may backfill 2–3h. citeturn4view1 |
| Optional: Drive app integration | Drive Add‑In path (`DriveAppLink/`) | “Push to driver” story | Drive Add‑In docs: assets get downloaded at login; dynamic requests can fail offline. citeturn7view9 | For hackathon: avoid making the demo depend on Drive/mobile/offline. |

**Do you need live vendor APIs?**  
No, not for the hackathon demo. The hackathon’s own environment is described as “real‑world simulated data” and the goal is “functional prototypes.” citeturn8view0  
Live sensor vendor APIs add integration and credential complexity, but they do not materially increase judge clarity if your simulated payload mirrors reality (bin ID, location, fill %, timestamp) and your routing/writeback pipeline is real. This is consistent with real deployments where sensor platforms provide fill‑level readings frequently (e.g., Sensoneo describes fill measurement 24 times/day sent to cloud routing tools). citeturn12view2  

---

## Minimal architecture diagram
The architecture below is intentionally minimal and “24-hour buildable” while still demonstrating end-to-end operational impact.

```mermaid
flowchart TD
  A[MyGeotab Embedded Add-In UI<br/>Map + Threshold Slider + KPIs] -->|Get DeviceStatusInfo| B[MyGeotab API]
  A -->|Get/Add/Set AddInData<br/>bin states + collection logs| B
  A -->|Add/Get Zone<br/>bins as zones (optional but recommended)| B
  A -->|Add Route<br/>RoutePlanItemCollection referencing Zones| B

  A --> C[Sensor Simulator<br/>in-browser]
  C -->|Generate bin payloads<br/>fill% updates over time| A

  subgraph Optional "Agentic path (optional)"
    D[n8n workflow<br/>Schedule → Fetch → Decide → Act] -->|Authenticate + Get/Set| B
    D -->|Update AddInData<br/>bin fill levels / route assignments| B
  end

  B --> E[Routes UI in MyGeotab<br/>show created routes (optional in demo)]
```

**Auth patterns in this architecture**  
- Embedded Add‑In: uses the Add‑In API context/session (no username/password) and calls `api.call("Get"/"Add"/"Set")` as in repo patterns. citeturn17view4turn6search6  
- n8n (optional): uses explicit `Authenticate` call with database/username/password, then uses returned credentials for subsequent calls; the repo’s n8n skill + quickstart show this exact pattern. citeturn22view0turn4view6  

**Where to run the optimisation**  
- For the threshold slider, “instant recompute” strongly favours **client-side** (in Add‑In) because each slider movement can re-run the heuristic route ordering locally (no API round trip). This is consistent with the hackathon’s emphasis on functional prototypes over production scaling. citeturn8view0turn22view1  
- For “always-on” operation, relocate the optimiser to **n8n** or a server later; the repo explicitly positions n8n for continuous monitoring/alerts and multi-step workflows. citeturn22view0turn4view6  

---

## Synthetic data schema and sample generator
### Schema for simulated bin sensor payloads
A practical approach is to keep two conceptual tables: one static “bin registry” and one dynamic “bin readings”. You can store them as JSON in AddInData, or embed initial JSON in the Add‑In and persist updates in AddInData.

| Object | Key fields | Notes |
|---|---|---|
| `bin_registry` | `binId` (string), `lat`/`lon` (float), `capacityLitres` (number), `zoneId` (optional string), `vendor` (string), `routeGroup` (optional string) | `zoneId` lets you map a bin to a Zone object if you choose the “bins-as-zones” route-writing strategy. Zones are defined by points and must be closed polygons. citeturn9view0 |
| `bin_reading` | `binId`, `ts` (ISO), `fillPct` (0–100), `tempC` (optional), `tilt` (optional), `batteryPct` (optional), `signals` (map) | Keep it generic; real vendors differ, but core is fill% + timestamp. Bigbelly explicitly frames smart bins as reporting fullness level and GPS location into its management console. citeturn14view0 |
| `collection_log` | `routeId`, `deviceId`, `binId`, `collectedAt` (ISO), `fillPctAtCollection`, `lat`/`lon`, `thresholdUsed` | Store as AddInData records to provide an auditable “this was actually collected at X%” storyline. AddInData is intended for storing structured JSON by Add‑Ins. citeturn7view4turn7view3 |

### Realism: how to generate fill patterns that “feel right”
Use a fill model with:
- **Different fill rates by bin type/location** (CBD bins grow faster than suburban). This is consistent with the “static schedule has no visibility to actual needs” problem framing used by real smart-waste platforms. citeturn15view1  
- **Daily cycles + noise** (morning/afternoon spikes).  
- **Occasional event spikes** (stadium day, festival), to visibly justify dynamic rerouting.

This aligns with published optimisation research where real-time bin fill levels drive variable routing and threshold strategies; at 70% threshold, variable routing shows measurable efficiency and emissions benefits. citeturn18view0  

### JS (ES5) pseudocode: generate bins, update fills, trigger reroute
This snippet respects the repo’s embedded Add‑In constraints: ES5 only, callbacks, no arrow functions/async. citeturn17view0turn17view4

```javascript
// ES5-safe helpers (no arrow funcs, no let/const)
function randBetween(a, b) { return a + Math.random() * (b - a); }
function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

function generateBinsAroundVehicles(vehicleStatuses, nBins) {
  // Choose a bounding box around vehicle points
  var lats = [], lons = [];
  for (var i = 0; i < vehicleStatuses.length; i++) {
    var s = vehicleStatuses[i];
    if (s.latitude && s.longitude) { lats.push(s.latitude); lons.push(s.longitude); }
  }
  // Fallback if no statuses (unspecified availability in demo DB)
  if (lats.length === 0) { lats = [28.6139]; lons = [77.2090]; }

  var minLat = Math.min.apply(null, lats), maxLat = Math.max.apply(null, lats);
  var minLon = Math.min.apply(null, lons), maxLon = Math.max.apply(null, lons);

  var bins = [];
  for (var j = 0; j < nBins; j++) {
    var binId = "BIN-" + ("0000" + j).slice(-4);
    bins.push({
      binId: binId,
      lat: randBetween(minLat, maxLat),
      lon: randBetween(minLon, maxLon),
      capacityLitres: 1200,
      vendor: "SIM",
      // Initialise fill in a believable range
      fillPct: Math.floor(randBetween(10, 85)),
      // Per-bin fill rate: some fast, some slow
      fillRatePerHour: randBetween(1, 8)
    });
  }
  return bins;
}

function updateFillLevels(bins, hoursElapsed) {
  // Simple model: fill increases, with noise and occasional spikes
  for (var i = 0; i < bins.length; i++) {
    var b = bins[i];
    var noise = randBetween(-2, 2);
    var eventSpike = (Math.random() < 0.02) ? randBetween(10, 25) : 0;
    b.fillPct = clamp(b.fillPct + b.fillRatePerHour * hoursElapsed + noise + eventSpike, 0, 100);
  }
  return bins;
}

function binsAboveThreshold(bins, thresholdPct) {
  var out = [];
  for (var i = 0; i < bins.length; i++) {
    if (bins[i].fillPct >= thresholdPct) out.push(bins[i]);
  }
  return out;
}

// Greedy nearest-neighbour route ordering (fast + demoable)
// Use Haversine or simple lat/lon distance approximation for demo.
function orderStopsNearest(startLat, startLon, stops) {
  var remaining = stops.slice();
  var ordered = [];
  var curLat = startLat, curLon = startLon;

  while (remaining.length > 0) {
    var bestIdx = 0, bestD = 1e18;
    for (var i = 0; i < remaining.length; i++) {
      var dLat = (remaining[i].lat - curLat);
      var dLon = (remaining[i].lon - curLon);
      var d = dLat * dLat + dLon * dLon;
      if (d < bestD) { bestD = d; bestIdx = i; }
    }
    var next = remaining.splice(bestIdx, 1)[0];
    ordered.push(next);
    curLat = next.lat; curLon = next.lon;
  }
  return ordered;
}

// Trigger reroute on slider change:
function onThresholdChanged(thresholdPct, vehicleStatus, bins) {
  var candidates = binsAboveThreshold(bins, thresholdPct);
  var routeStops = orderStopsNearest(vehicleStatus.latitude, vehicleStatus.longitude, candidates);
  return routeStops; // then render polyline + stats, and optionally write Zones/Route via API
}
```

### Optional SQL sketch (if you want “predictive scheduling” flavour)
If you later use an in-browser SQL engine (the repo lists an Ace + DuckDB example), you can express “which bins will cross 70% in next 6h” as a simple query. citeturn4view2

```sql
-- Pseudocode schema:
-- bin_state(binId, lat, lon, fillPct, fillRatePerHour, lastTs)

SELECT
  binId,
  fillPct,
  fillPct + fillRatePerHour * 6 AS projectedFillIn6h
FROM bin_state
WHERE fillPct + fillRatePerHour * 6 >= 70
ORDER BY projectedFillIn6h DESC;
```

---

## Implementation plan for a 24-hour sprint
This schedule optimises for “judge-visible” progress early and postpones optional integrations until the end.

| Time block | Deliverable | What you do | Evidence/constraints it addresses |
|---|---|---|---|
| Hour 0–2 | Working embedded Add‑In skeleton | Use Gem/embedded config pattern; build page shell, debug panel, lifecycle methods | Embedded JSON schema, debug tooling expectations, and callback pattern are explicitly required by Gem instructions. citeturn3view1turn17view4 |
| Hour 2–4 | Map renders + vehicle markers | Load Leaflet via CDN and plot DeviceStatusInfo markers | Repo’s Gem instructions explicitly recommend Leaflet + include a DeviceStatusInfo marker example. citeturn17view2turn7view2 |
| Hour 4–6 | Synthetic bins appear + colour coding | Generate bins around vehicle bounding box; colour green/yellow/red by fillPct | Matches hackathon’s focus on functional prototypes using simulated data. citeturn8view0 |
| Hour 6–8 | Threshold slider + instant re-route | Implement candidate filter + nearest-neighbour ordering + draw polyline; compute “stops reduced / km saved” | 70% threshold is a well-supported concept in literature (efficiency & emissions improvements). citeturn18view0 |
| Hour 8–11 | Persist bins + logs using AddInData | Store bin registry + evolving fill states and a collection log record structure in AddInData | Storage API and AddInData exist specifically for Add‑In data persistence. citeturn7view4turn7view3 |
| Hour 11–15 | “Write route to MyGeotab” | Create/lookup Zones per bin; then create Route with RoutePlanItemCollection referencing ordered zone IDs | Route is a sequence of zones; RoutePlanItem explicitly contains Zone + Sequence. citeturn21view0turn16view0turn9view0 |
| Hour 15–18 | Reliability hardening | Add resultsLimit/property-selector to avoid heavy calls; caching; guard null lat/lon | Gem instructions call out resultsLimit and warn about large arrays freezing debug copy; route/zone/addindata have explicit limits. citeturn17view4turn21view0turn9view0turn7view3 |
| Hour 18–21 | Optional “agentic” n8n workflow | If time: schedule “update fill levels + recompute + write route” every N minutes | n8n guide teaches schedule→fetch→filter→act and mentions choosing interval to respect rate limits. citeturn22view0 |
| Hour 21–24 | Demo polish + 3-min video storyboard | Tighten KPI panel, add “before vs after” toggle, record demo | Submission requires a 3‑minute video and public GitHub repo including prompts used. citeturn8view2 |

---

## Risks and mitigations
| Risk area | What can go wrong | Why it matters | Mitigation that fits 24h | Sources |
|---|---|---|---|---|
| Vendor API dependence | Vendor APIs may require contracts/keys; integration time sink | Demo fails due to auth/network, not product weakness | Use simulated payloads; show the “adapter interface” where vendor calls plug in later | Hackathon is about functional prototypes on simulated data citeturn8view0turn19view0 |
| Data Connector access | Not accessible from Add‑Ins; needs Basic Auth and installation; may backfill for hours | You lose time debugging entitlement/pipeline | Avoid Data Connector entirely for MVP; rely on MyGeotab API + local computations | Repo explicitly states Data Connector not accessible from Add‑Ins and may backfill 2–3 hours citeturn4view1turn4view5turn1search0 |
| Routing entitlements or UI variability | Some routing modules may not appear in demo DB; Drive/mobile is risky | Judge demo must not depend on UI modules | Create Route entity via API and show it exists; treat “driver push” as roadmap | Route object exists in API; Drive Add‑Ins have offline/dynamic-load constraints citeturn21view0turn7view9 |
| Drive / offline behaviour | External CSS/JS requests fail offline | Demo breaks if tested in Drive without network | Don’t demo on Drive; demo in MyGeotab web UI; mention Drive as future step | Drive Add‑In docs warn dynamic loading fails without network citeturn7view9 |
| Embedded Add‑In JS constraints | ES6+ syntax causes runtime SyntaxError | Hard failure in demo | Enforce ES5-only in all code; avoid async/await, arrow funcs, template strings | Gem instructions explicitly ban modern JS in embedded environment citeturn17view0 |
| Map library CSS load | Static `<link>` gets rewritten and breaks | Map may render incorrectly | Use the repo’s “dynamic CSS injection” pattern for Leaflet/Bootstrap | Gem instructions explain CDN CSS via dynamic loading citeturn17view2 |
| Route creation constraints | Incomplete route payload or <2 stops | Route creation fails or produces unusable objects | Ensure ≥2 waypoints; build routePlanItemCollection with sequential numbering | Official sample notes route needs minimum of two waypoints citeturn20view0turn16view0 |
| Zone geometry rules | Incorrect polygon (not closed) | Zone creation fails or renders wrong | Create a tiny square around bin location; repeat first point as last | Zone points must form a closed set (first = last) citeturn9view0 |
| API call rate limits | Too many calls per minute (routes/zones/addindata/logrecord) | Throttling mid-demo | Cache results; batch operations; use resultsLimit; don’t re-auth in loops | Route/Zone/AddInData/LogRecord rate limits are explicit in API reference citeturn21view0turn9view0turn7view3turn7view6 |
| Add‑In code hosting requirement mismatch | Docs say code must be external; embedded approach is “hacky” | Potential compliance question (less likely in hackathon) | For hackathon, use embedded config (endorsed by Vibe Guide); for “real product”, move to hosted add‑in | Official Add‑Ins docs state code should be stored externally; repo encourages embedded for prototypes citeturn6search13turn4view2turn22view1 |

---

## Pitch bullets and 60-second demo script
### Suggested judge pitch bullets (tight and evidence-backed)
1) **Fixed routes collect air.** Real deployments show bins were collected at **24% and 45% fullness** on average before optimisation, indicating systemic inefficiency. citeturn12view2  
2) **Smart bins already exist; fleets already have telematics.** Bigbelly bins report fullness + GPS into a console; Enevo and others build demand-driven routing from sensor data—SmartRoute is the missing integration layer inside fleet ops. citeturn14view0turn15view1  
3) **Threshold routing is a proven lever.** Research shows variable routing based on real-time bin fill can improve efficiency at a **70% threshold** and reduce cost/emissions. Your slider is not cosmetic; it operationalises a validated strategy. citeturn18view0  
4) **We’re not just visualising; we write the route back.** Routes in MyGeotab are sequences of zones; SmartRoute creates zones for bins and writes a route object via API. citeturn21view0turn9view0turn16view0  
5) **Hackathon-real, production-extensible.** Built as a MyGeotab Add‑In using the repo’s fastest embedded path; vendor APIs are swapped in later via the same payload schema. citeturn22view1turn3view1turn8view0  

### 60-second demo script (what to show on screen)
**0–10s — Problem framing on the map**  
“Here’s today’s planned collection route in grey—every bin, every street. But our bins are not equally full, so this schedule collects a lot of partially empty bins.”

**10–25s — Reveal the demand signal**  
“SmartRoute overlays bin fill-levels—green bins are low, yellow medium, red bins urgent. This data is what real smart-bin systems provide; in Sensoneo’s case study, they found bins collected at just 24% and 45% fullness on average before optimisation.” citeturn12view2

**25–40s — The operational intervention (slider)**  
“I’ll set the collection threshold to 70% and SmartRoute recalculates instantly: the blue route skips the greens and prioritises reds. This is the variable routing strategy that research shows can improve efficiency and reduce emissions at a 70% threshold.” citeturn18view0

**40–52s — The ‘this is real’ moment: writeback**  
“Now I click ‘Write route to MyGeotab’. SmartRoute creates zones for the selected bins and writes a Route entity made of RoutePlanItems pointing to those zones—so this is not a dashboard; it becomes an operational route object.” citeturn21view0turn16view0turn9view0

**52–60s — Measurable impact + logging**  
“We log each collection event with bin ID, fill%, vehicle ID and timestamp into AddInData, so the fleet builds a dataset for predictive scheduling and accountability—plus we show immediate KPIs: stops reduced, kilometres saved, and CO₂ avoided.” citeturn7view4turn7view3  

image_group{"layout":"carousel","aspect_ratio":"16:9","query":["smart waste bin sensor dashboard fill level map","waste collection route optimization map dashboard","Bigbelly smart bin sensor","Sensoneo smart waste management system map"],"num_per_query":1}