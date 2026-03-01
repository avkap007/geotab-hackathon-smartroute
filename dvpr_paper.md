# DVRP literature review insights for SmartRoute

## Executive summary
The paper you linked—**“Dynamic vehicle routing with random requests: A literature review”** by entity["people","Jian Zhang","operations research author"] and entity["people","Tom Van Woensel","eindhoven university researcher"] in entity["organization","International Journal of Production Economics","academic journal"]—focuses on *dynamic* routing where **service requests are not fully known in advance and arrive during route execution** (their term: DVRP with random requests, DVRPRR). citeturn19view1

For SmartRoute (bin fill‑level driven conditional stops + periodic updates + multi‑vehicle routing), the closest mapping is the paper’s **VRP with dynamic service requests (VRPDSR)** variant, because “requests” (bins requiring service) become known as the day unfolds when fill levels cross a threshold; you then update routes during execution. citeturn19view0

Given hackathon constraints (no live vendor APIs required, ≤50 vehicles, **ES5-only embedded Add‑In**, strict callback style, API rate limits, and need for **instant UI re-route on slider change**), the best algorithmic posture is a **rolling-horizon, reactive heuristic**:
- **Client-side (Add-In, instant):** filter bins by threshold → assign bins to vehicles using a fast rule (nearest vehicle or simple clustering) → order each vehicle’s stops with greedy nearest-neighbour (optionally + 2‑opt).  
- **Optional server/n8n (periodic):** re-run assignment + route ordering every N minutes, write updated “Basic” routes back to entity["organization","Geotab","fleet telematics company"] via API, but keep the judge demo independent of mobile/driver workflow entitlements. citeturn15view0turn18view0turn17view1

## What the DVRPRR review covers and how SmartRoute maps
### What the paper formally classifies as “dynamic”
The review distinguishes static vs dynamic and deterministic vs stochastic framing:
- It defines **DVRPRR** as routing where **customer requests are not fully known in advance and arrive dynamically during execution**. citeturn19view1  
- It discusses **dynamic deterministic (DD)** vs **dynamic stochastic (DS)**: DD updates plans based only on revealed information; DS can exploit probability distributions of unknown future events to anticipate and proactively adapt. citeturn19view2  
- It also positions a broader “dynamic aspects” view, separating DVRPs into problems with random **requests**, random **demands**, and random **travel times**. citeturn19view0

These definitions line up cleanly with SmartRoute: your “dynamic element” is **the revelation of which bins actually need service**, triggered by fill level updates, while vehicle positions evolve continuously.

### The paper’s taxonomy variants relevant to SmartRoute
The review states Section 2 introduces a taxonomy of four DVRPRR variants:  
- **VRP with dynamic service requests (VRPDSR)**  
- **Dynamic pickup and delivery problem (DPDP)**  
- **Same-day delivery problem (SDDP)**  
- **Dynamic multi-period VRP (DMPVRP)** citeturn19view0

SmartRoute maps primarily to **VRPDSR** because bins needing service are “dynamic service requests” (not necessarily pickup-and-delivery pairs). If you extend SmartRoute to multi-day learning (predictive scheduling or periodic servicing policies), it starts resembling a **dynamic multi-period** framing, but your 24‑hour MVP does not need that. citeturn19view0

### Decision strategies the paper highlights
A key lens the review introduces is **decision strategies** (it explicitly gives examples including **rejection, diversion, and waiting**). citeturn19view0  
For SmartRoute, “rejection” corresponds to **skipping bins below threshold** (a gated service policy), and “diversion” corresponds to rerouting an in-progress truck toward newly urgent bins.

image_group{"layout":"carousel","aspect_ratio":"16:9","query":["dynamic vehicle routing rolling horizon diagram","waste collection route optimization map dashboard","smart waste bin fill level sensor dashboard","vehicle routing problem re-optimization illustration"],"num_per_query":1}

## Technique families and feasibility matrix for a 24-hour prototype
### Evidence basis and access note
The entity["company","ScienceDirect","elsevier publishing platform"] preview exposes the paper’s abstract, part of the introduction, and section-snippet summaries, but not the full body text or its detailed technique breakdown. citeturn7view0  
To provide a usable technique taxonomy with concrete descriptions (as you requested), I triangulate from:
- the paper’s *explicit* scope and categories (DVRPRR, DD/DS; decision strategies; four variants), citeturn19view0turn19view2  
- and a highly-cited accessible survey **“A Review of Dynamic Vehicle Routing Problems”** (CIRRELT report) that gives formal DVRP definitions, degree-of-dynamism concepts, and solution approach families (including insertion heuristics, diversion issues, and tradeoffs between reactiveness and decision quality). citeturn11view0

### Feasibility matrix (what to implement vs what to cite as “future work”)
| Technique family | What it is (short) | Implementable in 24h | Complexity (code + compute) | Data needs | Pros for SmartRoute | Cons / risks under your constraints |
|---|---|---:|---|---|---|---|
| Reactive greedy ordering (nearest-neighbour / cheapest next) | Treat “urgent bins” as current requests; build a route by repeatedly choosing next closest stop | Yes | Low + Low | Vehicle lat/lon; bin lat/lon; thresholded fill% | Instant UI recompute; ES5 friendly; robust without travel-time model | Can be myopic; may zig-zag without smoothing |
| Insertion heuristics | When a new request appears, insert it into current route at best position with minimal disruption | Yes | Medium + Low/Med | Current route; travel cost metric; new-bin events | Matches “dynamic requests” narrative well; supports “diversion” | More code; still needs distance proxy; can churn routes |
| Rolling horizon re-optimisation | Recompute routes periodically using the latest known requests, rather than continuously | Yes | Medium + Medium | Update interval; fleet state snapshot | Fits sensor polling; maps to “updated info in real time” framing | Needs careful throttling with API rate limits |
| Waiting / batching policy | Delay dispatching/committing to reduce churn, batch more information | Yes | Low + Low | Timing rules | Stabilises routes; makes UI less jumpy | Tradeoff with urgency; may look “less real-time” |
| Cluster-first route-second (sweep / k-means / grid) | Split bins among vehicles by geography, then order stops per vehicle | Yes | Medium + Medium | Multi-vehicle positions; bins; optional capacity proxy | Multi-vehicle scalability with ≤50 vehicles; very demoable | Clustering edge cases; balancing load is nontrivial |
| Local search improvement (2‑opt) | Improve a route by swapping edges to reduce crossings and distance | Yes (optional) | Medium + Medium | A complete ordered route | Significant visual improvement; easy “before/after” story | More compute; implement carefully in ES5 |
| Metaheuristics (tabu, VNS, ALNS, GA) | Larger neighbourhood search / evolutionary methods for higher-quality solutions | No (as core) | High + High | Stable travel-time model & tuning | Strong quality at scale | Tuning time; compute; hard to justify in 24h UI loop |
| Exact optimisation (MIP/branch-and-cut) | Solve formulation optimally with MILP solvers | No | Very high + Very high | Full cost matrix; solver runtime | Best optimality guarantees | Not feasible in ES5 Add-In; solver dependency |
| Stochastic programming / MDP / RL | Optimise with probabilistic future arrivals and uncertainty | No (as core) | Very high + High | Historical distributions; training/simulation | Aligns with DS framing | Data not available; too heavy; hard to validate in hackathon |

Dynamic routing also introduces a core operational tradeoff: **more reactiveness vs more computation time and route stability**, because spending time searching for a “better” decision reduces the ability to respond quickly to new information. citeturn11view0  
This tradeoff strongly supports choosing simple heuristics for your hackathon MVP.

## Recommended hybrid approach for the hackathon MVP
### Why this approach best matches your constraints
You need:
- **instant re-route** when the threshold slider moves, in an **ES5-only embedded Add‑In** environment with callback-based API calls and CDN JS allowed. citeturn14view0  
- to pull current vehicle positions from `DeviceStatusInfo` (explicitly designed to represent current bearing/location/speed) with known rate limits. citeturn16view1  
- to write back a route without relying on driver/mobile UX: create **Basic routes** (no device association) to avoid dependency on scheduling/drive flows. citeturn18view0turn17view1  
- to persist synthetic sensor state + collection logs using `AddInData` (storage API supports storing structured JSON). citeturn17view5turn17view4  
- to respect rate limits across objects you’ll touch: `Route`, `RoutePlanItem`, `Zone`, `AddInData`, `DeviceStatusInfo`. citeturn17view1turn17view2turn17view3turn17view4turn16view1  

This yields the hybrid design:
- **Client Add‑In (always):** threshold filter + greedy ordering + KPI computation + “Write Route” (Zones + Route + RoutePlanItems).  
- **Optional n8n (only if you have time):** periodic re-run to demonstrate “real-time operational system,” using the repo’s n8n Authenticate→Get pattern and schedule triggers. citeturn15view0  

### Mermaid flowchart of the hybrid system
```mermaid
flowchart TD
  UI[Embedded MyGeotab Add-In (ES5)<br/>Map + threshold slider + KPIs] -->|Get DeviceStatusInfo| API[(MyGeotab API)]
  UI -->|Get/Set AddInData<br/>bin_state + collection_log| API
  UI -->|Optional Add Zone per bin| API
  UI -->|Add Route (RoutePlanItemCollection)| API

  UI --> SIM[In-browser sensor simulator<br/>fill% updates + events]
  SIM --> UI

  subgraph Optional["Optional n8n rolling-horizon re-optimiser"]
    N8N[n8n schedule trigger] --> AUTH[Authenticate + Get fleet snapshot]
    AUTH --> OPT[Assign bins -> vehicles + build routes]
    OPT --> WRITE[Write updated Route/Zone/AddInData]
    AUTH --> API
    WRITE --> API
  end
```

### Algorithm recommendation (single approach)
**Rolling-horizon + cluster-first route-second + greedy ordering (+ optional 2‑opt).**

**Stepwise logic**
1. Snapshot fleet state: pull current vehicle locations from `DeviceStatusInfo`. citeturn16view1  
2. Generate/refresh `bin_state` (simulated) stored in `AddInData`. citeturn17view5turn17view4  
3. Filter bins: `fillPct >= threshold`.  
4. Assign bins to vehicles:
   - simplest: nearest-vehicle assignment (O(V·B)),  
   - or sweep/grid clustering if you want nicer spatial coherence.  
5. For each vehicle cluster: build route by greedy nearest-neighbour from current vehicle position; optionally run 2‑opt to remove crossings.  
6. Display: baseline vs optimised polyline + delta metrics.  
7. Persist: write “collection_log” as AddInData records. citeturn17view5turn17view4  
8. Writeback (optional):  
   - Create `Zone` for each bin (small closed polygon; Zones are “geofence” boundaries and should be closed). citeturn17view3  
   - Create a **Basic** `Route` with `RoutePlanItemCollection` sequencing those zones. citeturn17view1turn17view2turn18view0  

**Complexity sketch**
- Nearest assignment: O(V·B)  
- Per vehicle greedy ordering: O(Bᵢ²) worst-case for each vehicle i (if implemented as repeated nearest search)  
- 2‑opt: O(Bᵢ²) per pass, typically a few passes  
With hackathon-sized demo (tens–few hundred bins), this is fast enough in-browser; the *instant slider* requirement pushes you toward these polynomial heuristics rather than metaheuristics or exact solvers.

## Validation, assumptions, and fallback heuristics
### Assumptions and what is unspecified
- Exact demo database field availability beyond what `DeviceStatusInfo` guarantees is **unspecified** here (e.g., whether you can reliably pull historical `LogRecord` traces in your demo DB). Your algorithm should not depend on that. citeturn16view1  
- Travel times are assumed to be approximated by Euclidean distance (or a simple coordinate distance). Real travel times are time-dependent; modelling them is out of scope for 24h. The DVRP literature recognises travel time as a dynamic element; implementing full time-dependent travel time is not required for the hackathon MVP. citeturn19view0turn11view0  
- “Real-time latency” is treated as *periodic update* (rolling horizon). The n8n guide itself recommends balancing responsiveness with API limits (example uses 15 minutes). citeturn15view0  

### Fallback heuristics and when to use them
- **Nearest-neighbour only:** use when you have one truck or want instant stability; best for the slider demo.  
- **Sweep algorithm (angle sort around depot/vehicle):** use when bins are dense and you want a clean, non-crossing path without 2‑opt.  
- **Cluster-first route-second:** use when you want the multi-vehicle story with low complexity; it is usually “good enough” for a hackathon.  
- **Insertion heuristic:** use when you want to show “diversion” for new urgent bins appearing mid-run; insert urgent bins into an existing sequence rather than recomputing from scratch (aligns with the review’s emphasis on dynamic updates and decision strategies). citeturn19view0turn11view0  

### Testing correctness with synthetic data
You can validate routing logic without any vendor API by generating bin updates and checking invariants:
- **Threshold invariant:** every stop in the computed route must satisfy `fillPct >= threshold` at computation time.  
- **Stability invariant:** if no bins change and threshold doesn’t change, recomputation should be idempotent (route remains same).  
- **Writeback invariant:** zones used in `RoutePlanItemCollection` must exist and be closed polygons (first point equals last). citeturn17view3turn17view2turn17view1  
- **Rate-limit safety:** cap API calls; batch via `multiCall` where possible; avoid recomputing/writing routes on every slider tick—compute instantly, write only on button click. (Rate limits are documented per object.) citeturn17view1turn17view2turn17view3turn17view4turn16view1  

## Technical appendix
### ES5-friendly pseudocode snippets
Client-side (instant recompute, single or per-vehicle cluster):
```javascript
// ES5-only (var + function + callbacks). Inspired by repo constraints. 
// (MyGeotab embedded Add-Ins do not support modern JS.) 
// Source for ES5 constraint: GEM instructions. 

function dist2(aLat, aLon, bLat, bLon) {
  var dx = (aLat - bLat), dy = (aLon - bLon);
  return dx*dx + dy*dy;
}

function filterBinsByThreshold(bins, threshold) {
  var out = [];
  for (var i=0; i<bins.length; i++) {
    if (bins[i].fillPct >= threshold) out.push(bins[i]);
  }
  return out;
}

function assignBinsNearestVehicle(vehicles, bins) {
  // vehicles: [{deviceId, lat, lon}], bins: [{binId, lat, lon, fillPct}]
  var assign = {}; // deviceId -> [bins]
  for (var v=0; v<vehicles.length; v++) assign[vehicles[v].deviceId] = [];

  for (var i=0; i<bins.length; i++) {
    var bestV = 0, bestD = 1e18;
    for (var v2=0; v2<vehicles.length; v2++) {
      var d = dist2(vehicles[v2].lat, vehicles[v2].lon, bins[i].lat, bins[i].lon);
      if (d < bestD) { bestD = d; bestV = v2; }
    }
    assign[vehicles[bestV].deviceId].push(bins[i]);
  }
  return assign;
}

function greedyRouteOrder(startLat, startLon, stops) {
  var rem = stops.slice();
  var ordered = [];
  var curLat = startLat, curLon = startLon;

  while (rem.length > 0) {
    var bestIdx = 0, bestD = 1e18;
    for (var i=0; i<rem.length; i++) {
      var d = dist2(curLat, curLon, rem[i].lat, rem[i].lon);
      if (d < bestD) { bestD = d; bestIdx = i; }
    }
    var next = rem.splice(bestIdx, 1)[0];
    ordered.push(next);
    curLat = next.lat; curLon = next.lon;
  }
  return ordered;
}
```

Optional n8n/server “rolling horizon” re-optimiser (runs every N minutes; write only if route materially changes):
```javascript
// Pseudocode structure (n8n node logic):
// 1) Get DeviceStatusInfo snapshot
// 2) Get bin_state from AddInData (or generate)
// 3) threshold -> filter -> assign -> order routes
// 4) create/update Zones (if needed)
// 5) Add Route (RouteType: Basic) with RoutePlanItemCollection

// Note: Use n8n Authenticate + Get pattern as shown in repo guide.
```

### Key implementation hooks to cite in your README/demo narration
- Embedded Add‑In must use ES5 + callbacks + dynamic CSS loading; Leaflet is explicitly recommended and `DeviceStatusInfo` is used in the repo’s map example. citeturn14view0  
- `DeviceStatusInfo` is designed for “current state” including location/speed, with explicit API rate limits. citeturn16view1  
- Routes are defined as a “connected sequence of zones,” built from `RoutePlanItemCollection`, and “Basic” routes have no associated device. citeturn17view1turn17view2turn18view0  
- `AddInData` / Storage API exists specifically for storing structured JSON; it is searchable and rate limited. citeturn17view5turn17view4  
- Hackathon rubric explicitly pushes functional prototypes built from the repo’s stack, with submission requirements (3‑minute demo video + public repo with prompts). citeturn16view0turn14view0