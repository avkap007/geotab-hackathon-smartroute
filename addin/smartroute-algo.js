/* SmartRoute Algorithm Module */
/* Person 2 owns this file. ES5 only. No DOM access. No apiRef calls. */
/* Exposes window.SmartRouteAlgo */

(function () {

  /* ─────────────────────────────────────────────────────────────────────────
     GEOMETRY HELPERS
  ───────────────────────────────────────────────────────────────────────── */

  function haversineKm(lat1, lng1, lat2, lng2) {
    var R    = 6371;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLng = (lng2 - lng1) * Math.PI / 180;
    var a    = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
               Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
               Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /* Default distance function — straight-line (Haversine).
     All optimisation functions accept an optional distFn(a, b) so that
     a road-distance matrix can be substituted when available. */
  function defaultDist(a, b) {
    return haversineKm(a.lat, a.lng, b.lat, b.lng);
  }

  function routeDistanceKm(points, distFn) {
    var d     = distFn || defaultDist;
    var total = 0;
    for (var i = 0; i < points.length - 1; i++) {
      total += d(points[i], points[i + 1]);
    }
    return total;
  }

  /* Builds a {lat,lng} point array from a bin array with depot bookends */
  function toPoints(depot, bins) {
    var pts = [{ lat: depot.lat, lng: depot.lng }];
    for (var i = 0; i < bins.length; i++) {
      pts.push({ lat: bins[i].lat, lng: bins[i].lng });
    }
    pts.push({ lat: depot.lat, lng: depot.lng });
    return pts;
  }

  /* ─────────────────────────────────────────────────────────────────────────
     GOOGLE MAPS DISTANCE MATRIX
     Fetches a road-distance matrix for all points (depot + bins).
     Calls back with a distFn(a,b) closure, or null on failure (Haversine used).
  ───────────────────────────────────────────────────────────────────────── */

  /* Max elements Google Distance Matrix allows per request (origins × destinations) */
  var GM_MAX_ELEMENTS = 625; /* 25 × 25 */

  function buildDistanceMatrix(allPoints, callback) {
    /* Fall back to Haversine if Google Maps SDK is not loaded */
    if (typeof google === 'undefined' ||
        !google.maps ||
        !google.maps.DistanceMatrixService) {
      callback(null);
      return;
    }

    var n = allPoints.length;

    /* Safety: if too many points for one request, skip matrix and use Haversine */
    if (n * n > GM_MAX_ELEMENTS) {
      callback(null);
      return;
    }

    var svc     = new google.maps.DistanceMatrixService();
    var latLngs = allPoints.map(function (p) {
      return new google.maps.LatLng(p.lat, p.lng);
    });

    svc.getDistanceMatrix({
      origins:      latLngs,
      destinations: latLngs,
      travelMode:   google.maps.TravelMode.DRIVING,
      unitSystem:   google.maps.UnitSystem.METRIC
    }, function (response, status) {
      if (status !== 'OK') { callback(null); return; }

      /* Build km matrix[i][j] */
      var matrix = [];
      for (var i = 0; i < n; i++) {
        matrix[i] = [];
        var row = response.rows[i].elements;
        for (var j = 0; j < n; j++) {
          matrix[i][j] = (row[j].status === 'OK')
            ? row[j].distance.value / 1000   /* metres → km */
            : haversineKm(allPoints[i].lat, allPoints[i].lng,
                          allPoints[j].lat, allPoints[j].lng);
        }
      }

      /* Index map: "lat,lng" → row/col index */
      var idxMap = {};
      for (var k = 0; k < n; k++) {
        idxMap[allPoints[k].lat + ',' + allPoints[k].lng] = k;
      }

      callback(function matrixDist(a, b) {
        var ai = idxMap[a.lat + ',' + a.lng];
        var bi = idxMap[b.lat + ',' + b.lng];
        if (ai == null || bi == null) {
          return haversineKm(a.lat, a.lng, b.lat, b.lng);
        }
        return matrix[ai][bi];
      });
    });
  }

  /* ─────────────────────────────────────────────────────────────────────────
     NEAREST-NEIGHBOUR  (kept for baseline / fallback only)
  ───────────────────────────────────────────────────────────────────────── */

  function nearestNeighborRoute(start, bins, distFn) {
    var d         = distFn || defaultDist;
    var ordered   = [];
    var remaining = bins.slice();
    var current   = start;
    while (remaining.length > 0) {
      var bestIdx  = 0;
      var bestDist = d(current, remaining[0]);
      for (var i = 1; i < remaining.length; i++) {
        var dist = d(current, remaining[i]);
        if (dist < bestDist) { bestDist = dist; bestIdx = i; }
      }
      ordered.push(remaining[bestIdx]);
      current = remaining[bestIdx];
      remaining.splice(bestIdx, 1);
    }
    return ordered;
  }

  /* ─────────────────────────────────────────────────────────────────────────
     PHASE 1-A: CLARKE-WRIGHT SAVINGS ALGORITHM
     Returns an array of routes; each route is an ordered array of bin objects.
  ───────────────────────────────────────────────────────────────────────── */

  function clarkeWright(depot, bins, capacity, distFn) {
    if (bins.length === 0) return [];
    if (bins.length === 1) return [bins.slice()];

    var d   = distFn || defaultDist;
    var cap = capacity || 10;

    /* 1. Compute savings for every pair (i, j) */
    var savings = [];
    for (var i = 0; i < bins.length; i++) {
      for (var j = i + 1; j < bins.length; j++) {
        var s = d(depot, bins[i])
              + d(depot, bins[j])
              - d(bins[i], bins[j]);
        savings.push({ i: i, j: j, saving: s });
      }
    }
    savings.sort(function (a, b) { return b.saving - a.saving; });

    /* 2. Initialise: each bin in its own singleton route
          routes[r] = array of bin indices (or null if merged away)
          routeOf[binIdx] = index into routes[] */
    var routes  = [];
    var routeOf = [];
    for (var k = 0; k < bins.length; k++) {
      routes.push([k]);
      routeOf.push(k);
    }

    function isEndpoint(routeIdx, binIdx) {
      var r = routes[routeIdx];
      return r !== null && (r[0] === binIdx || r[r.length - 1] === binIdx);
    }

    /* 3. Greedy merge */
    for (var s = 0; s < savings.length; s++) {
      var bi = savings[s].i;
      var bj = savings[s].j;
      var ri = routeOf[bi];
      var rj = routeOf[bj];

      if (ri === rj)           continue;   /* already in the same route  */
      if (!routes[ri])         continue;   /* route was merged away       */
      if (!routes[rj])         continue;
      if (!isEndpoint(ri, bi)) continue;   /* bi is interior — can't merge */
      if (!isEndpoint(rj, bj)) continue;
      if (routes[ri].length + routes[rj].length > cap) continue; /* capacity */

      /* Orient ri so bi is at the END */
      if (routes[ri][0] === bi) {
        routes[ri] = routes[ri].slice().reverse();
      }
      /* Orient rj so bj is at the START */
      if (routes[rj][routes[rj].length - 1] === bj) {
        routes[rj] = routes[rj].slice().reverse();
      }

      /* Merge rj into ri */
      var merged = routes[ri].concat(routes[rj]);
      for (var m = 0; m < merged.length; m++) {
        routeOf[merged[m]] = ri;
      }
      routes[ri] = merged;
      routes[rj] = null;
    }

    /* 4. Collect surviving routes as bin-object arrays */
    var result = [];
    for (var r = 0; r < routes.length; r++) {
      if (routes[r] !== null) {
        result.push(routes[r].map(function (idx) { return bins[idx]; }));
      }
    }
    return result;
  }

  /* ─────────────────────────────────────────────────────────────────────────
     PHASE 1-B: OR-OPT POST-PROCESSING
     Tries moving segments of 1–3 consecutive bins to every other position.
     Accepts the move only if it strictly reduces total route distance.
     Uses a labeled break to restart cleanly after each improvement.
  ───────────────────────────────────────────────────────────────────────── */

  function orOpt(depot, binRoute, distFn) {
    if (binRoute.length < 3) return binRoute;

    var d        = distFn || defaultDist;
    var improved = true;
    var current  = binRoute.slice();

    while (improved) {
      improved = false;
      var currentDist = routeDistanceKm(toPoints(depot, current), d);

      outerLoop:
      for (var segLen = 1; segLen <= 3; segLen++) {
        for (var i = 0; i <= current.length - segLen; i++) {
          var seg     = current.slice(i, i + segLen);
          var without = current.slice(0, i).concat(current.slice(i + segLen));

          for (var j = 0; j <= without.length; j++) {
            /* Skip: re-inserting in the same logical position */
            if (j >= i && j <= i + segLen - 1) { continue; }

            var candidate = without.slice(0, j).concat(seg).concat(without.slice(j));
            if (routeDistanceKm(toPoints(depot, candidate), d) < currentDist - 1e-9) {
              current  = candidate;
              improved = true;
              break outerLoop;
            }
          }
        }
      }
    }
    return current;
  }

  /* ─────────────────────────────────────────────────────────────────────────
     PHASE 2: SELECTIVE INSERTION
     Sub-threshold candidate bins are scored by net value:
       netValue = fillLevel - alpha * normalizedInsertionCost
     Candidates with netValue > 0 are inserted at their cheapest position.
     Sorted by fillLevel desc so high-fill bins claim cheap slots first.
  ───────────────────────────────────────────────────────────────────────── */

  function selectiveInsertion(depot, mandatoryRoutes, candidates, alpha, distFn) {
    if (candidates.length === 0 || mandatoryRoutes.length === 0) {
      return { routes: mandatoryRoutes, inserted: [] };
    }
    if (alpha === 0) {
      /* intensity = 0: collect all candidates unconditionally (cheapest insert) */
      var allRoutes = mandatoryRoutes.map(function (r) { return r.slice(); });
      var allInserted = candidates.slice().sort(function (a, b) { return b.fillLevel - a.fillLevel; });
      allInserted.forEach(function (bin) {
        var best = cheapestInsert(depot, allRoutes, bin, distFn);
        if (best.routeIdx >= 0) {
          allRoutes[best.routeIdx].splice(best.pos, 0, bin);
        }
      });
      return { routes: allRoutes, inserted: allInserted };
    }

    var routes = mandatoryRoutes.map(function (r) { return r.slice(); });
    var sorted = candidates.slice().sort(function (a, b) { return b.fillLevel - a.fillLevel; });

    /* First pass: compute insertion cost per candidate */
    var insertions = sorted.map(function (bin) {
      return { bin: bin, best: cheapestInsert(depot, routes, bin, distFn) };
    });

    /* Normalize insertion costs to 0–100 */
    var maxCost = 0;
    for (var k = 0; k < insertions.length; k++) {
      if (insertions[k].best.cost > maxCost) { maxCost = insertions[k].best.cost; }
    }

    var inserted = [];
    for (var ci = 0; ci < insertions.length; ci++) {
      var entry         = insertions[ci];
      var normalizedCost = maxCost > 0 ? (entry.best.cost / maxCost) * 100 : 0;
      var netValue       = entry.bin.fillLevel - alpha * normalizedCost;

      if (netValue > 0 && entry.best.routeIdx >= 0) {
        routes[entry.best.routeIdx].splice(entry.best.pos, 0, entry.bin);
        inserted.push(entry.bin);
        /* Recompute insertion positions for remaining candidates after route changed */
        for (var rem = ci + 1; rem < insertions.length; rem++) {
          insertions[rem].best = cheapestInsert(depot, routes, insertions[rem].bin, distFn);
        }
        /* Recompute max cost after update */
        maxCost = 0;
        for (var rk = ci + 1; rk < insertions.length; rk++) {
          if (insertions[rk].best.cost > maxCost) { maxCost = insertions[rk].best.cost; }
        }
      }
    }

    return { routes: routes, inserted: inserted };
  }

  /* Find cheapest insertion position for a bin across all routes */
  function cheapestInsert(depot, routes, bin, distFn) {
    var d    = distFn || defaultDist;
    var best = { cost: Infinity, routeIdx: -1, pos: -1 };
    for (var ri = 0; ri < routes.length; ri++) {
      var route = routes[ri];
      /* Full sequence with depot bookends for cost calc */
      var full = [depot].concat(route).concat([depot]);
      for (var pos = 1; pos < full.length; pos++) {
        var prev = full[pos - 1];
        var next = full[pos];
        var cost = d(prev, bin) + d(bin, next) - d(prev, next);
        if (cost < best.cost) {
          best = { cost: cost, routeIdx: ri, pos: pos - 1 };
        }
      }
    }
    return best;
  }

  /* ─────────────────────────────────────────────────────────────────────────
     CORE OPTIMISATION LOGIC (shared by run() and runAsync())
  ───────────────────────────────────────────────────────────────────────── */

  function runWithDistFn(bins, depot, options, distFn) {
    var threshold = (options && options.threshold != null) ? options.threshold : 70;
    var intensity = (options && options.intensity != null) ? options.intensity : 0.5;
    var capacity  = (options && options.vehicleCapacity)  || 10;
    var alpha     = intensity * 3.0;   /* maps 0–1 slider to 0–3 alpha range */

    var vehicles  = ((options && options.vehicles) || []).filter(function (v) {
      return v.latitude && v.longitude;
    });

    var COLORS              = ['#4361ee', '#16a34a', '#f97316', '#7c3aed', '#db2777'];
    var TRUCK_SPEED_KMH     = 25;
    var SERVICE_MIN_PER_BIN = 5;

    /* ── Split by threshold ── */
    var mandatory  = bins.filter(function (b) { return b.fillLevel >= threshold; });
    var candidates = bins.filter(function (b) { return b.fillLevel <  threshold; });

    /* ── Baseline (NN over ALL bins) for savings comparison ── */
    var allOrdered     = nearestNeighborRoute(depot, bins.slice(), distFn);
    var originalPoints = toPoints(depot, allOrdered);
    var originalKm     = routeDistanceKm(originalPoints, distFn);
    var originalHours  = (originalKm / TRUCK_SPEED_KMH) + (bins.length * SERVICE_MIN_PER_BIN / 60);

    /* ── Edge case: nothing mandatory — skip everything, save the whole route ── */
    if (mandatory.length === 0) {
      var empty = {
        optimizedBins:  [],
        skippedBins:    bins,
        insertedBins:   [],
        vehicleRoutes:  [],
        originalPoints: originalPoints,
        metrics: {
          stopsSkipped: bins.length,
          kmSaved:      originalKm,
          fuelSavedL:   originalKm * 0.3,
          co2AvoidedKg: originalKm * 0.3 * 2.68,
          hoursSaved:   originalHours
        }
      };
      return empty;
    }

    /* ── Phase 1: Clarke-Wright on mandatory bins ── */
    var start     = vehicles.length > 0
                  ? { lat: vehicles[0].latitude, lng: vehicles[0].longitude }
                  : depot;
    var cwRoutes  = clarkeWright(start, mandatory, capacity, distFn);

    /* Or-opt post-processing on each CW route */
    var phase1Routes = cwRoutes.map(function (route) {
      return orOpt(depot, route, distFn);
    });

    /* ── Phase 2: Selective insertion of sub-threshold candidates ── */
    var phase2       = selectiveInsertion(depot, phase1Routes, candidates, alpha, distFn);
    var finalRoutes  = phase2.routes;
    var insertedBins = phase2.inserted;

    /* ── Build output ── */
    var vehicleRoutes    = [];
    var allOptimizedBins = [];
    var optimizedKm      = 0;

    for (var ri = 0; ri < finalRoutes.length; ri++) {
      var route = finalRoutes[ri];
      if (route.length === 0) { continue; }
      var pts = toPoints(start, route);
      optimizedKm += routeDistanceKm(pts, distFn);
      vehicleRoutes.push({ points: pts, color: COLORS[ri % COLORS.length] });
      for (var bi = 0; bi < route.length; bi++) { allOptimizedBins.push(route[bi]); }
    }

    /* ── Savings ── */
    var kmSaved        = Math.max(0, originalKm - optimizedKm);
    var fuelSavedL     = kmSaved * 0.3;
    var optimizedHours = (optimizedKm / TRUCK_SPEED_KMH) +
                         (allOptimizedBins.length * SERVICE_MIN_PER_BIN / 60);
    var hoursSaved     = Math.max(0, originalHours - optimizedHours);

    /* skippedBins = candidates that failed the profit test */
    var insertedIds = {};
    for (var ii = 0; ii < insertedBins.length; ii++) { insertedIds[insertedBins[ii].id] = true; }
    var skippedBins = candidates.filter(function (b) { return !insertedIds[b.id]; });

    return {
      optimizedBins:  allOptimizedBins,
      skippedBins:    skippedBins,
      insertedBins:   insertedBins,
      vehicleRoutes:  vehicleRoutes,
      originalPoints: originalPoints,
      metrics: {
        stopsSkipped:  skippedBins.length,
        kmSaved:       kmSaved,
        fuelSavedL:    fuelSavedL,
        co2AvoidedKg:  fuelSavedL * 2.68,
        hoursSaved:    hoursSaved
      }
    };
  }

  /* ─────────────────────────────────────────────────────────────────────────
     PUBLIC INTERFACE
  ───────────────────────────────────────────────────────────────────────── */

  window.SmartRouteAlgo = {

    onComplete: null,

    /*
     * run(bins, depot, options) → results  [synchronous, Haversine distances]
     *
     * options.threshold       0–100  hard fill-level cutoff (Slider 1)
     * options.intensity       0–1    selective-insertion aggressiveness (Slider 2)
     * options.vehicleCapacity int    max bins per route
     * options.vehicles        [{latitude, longitude}]  live GPS (may be empty)
     *
     * results shape:
     *   optimizedBins   — all bins to collect (mandatory + inserted selective)
     *   skippedBins     — sub-threshold bins excluded by the profit model
     *   insertedBins    — sub-threshold bins that passed the profit model
     *   vehicleRoutes   — [{points:[{lat,lng}…], color}]  for map rendering
     *   originalPoints  — [{lat,lng}]  NN baseline of ALL bins (grey overlay)
     *   metrics         — { stopsSkipped, kmSaved, fuelSavedL, co2AvoidedKg, hoursSaved }
     */
    run: function (bins, depot, options) {
      var result = runWithDistFn(bins, depot, options, defaultDist);
      if (typeof this.onComplete === 'function') { this.onComplete(result); }
      return result;
    },

    /*
     * runAsync(bins, depot, options, callback)
     *
     * Same as run() but pre-fetches a Google Maps road-distance matrix first.
     * If Google Maps SDK is unavailable, falls back to Haversine automatically.
     * callback(result) is called when optimisation is complete.
     */
    runAsync: function (bins, depot, options, callback) {
      var self    = this;
      var allPts  = [depot].concat(bins);
      buildDistanceMatrix(allPts, function (distFn) {
        var result = runWithDistFn(bins, depot, options, distFn || defaultDist);
        callback(result);
        if (typeof self.onComplete === 'function') { self.onComplete(result); }
      });
    },

    /*
     * predict(collectionLogs, bins, options) → predictions array
     *
     * Implements the Step 3 predictive fill model:
     *   - Recency-weighted fill rate (exponential decay 0.8)
     *   - Day-of-week fill rate grouping
     *   - Std-dev based confidence scoring
     *   - Forward predictions to threshold and 100%
     *   - 14-day cadence projection for recommended collection days
     *   - Fleet-wide fallback for bins with insufficient history
     *
     * options.threshold  0–100  (default 70) — fill level that triggers collection
     */
    predict: function (collectionLogs, bins, options) {
      var DAY_NAMES  = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      var MS_PER_DAY = 24 * 60 * 60 * 1000;
      var today      = new Date();
      var threshold  = (options && options.threshold != null) ? options.threshold : 70;

      /* ── Recency-weighted average of a numeric array (most recent = index n-1) ── */
      function weightedAvg(values) {
        if (values.length === 0) { return 0; }
        var decay = 0.8;
        var wSum = 0, wTotal = 0;
        for (var i = 0; i < values.length; i++) {
          var w = Math.pow(decay, values.length - 1 - i);
          wSum   += values[i] * w;
          wTotal += w;
        }
        return wSum / wTotal;
      }

      /* ── Step 1: Group and sort logs per bin ── */
      var logsByBin = {};
      for (var li = 0; li < collectionLogs.length; li++) {
        var log = collectionLogs[li];
        if (!logsByBin[log.binId]) { logsByBin[log.binId] = []; }
        logsByBin[log.binId].push(log);
      }
      for (var bid in logsByBin) {
        if (Object.prototype.hasOwnProperty.call(logsByBin, bid)) {
          logsByBin[bid].sort(function (a, b) {
            return new Date(a.collectedAt) - new Date(b.collectedAt);
          });
        }
      }

      /* ── Step 8 (first): Compute global fleet fill rate as fallback ── */
      var allFleetRates = [];
      for (var fbid in logsByBin) {
        if (!Object.prototype.hasOwnProperty.call(logsByBin, fbid)) { continue; }
        var fLogs = logsByBin[fbid];
        for (var fi = 1; fi < fLogs.length; fi++) {
          var fDays = (new Date(fLogs[fi].collectedAt) - new Date(fLogs[fi - 1].collectedAt)) / MS_PER_DAY;
          if (fDays > 0) {
            allFleetRates.push(fLogs[fi].fillPctAtCollection / fDays);
          }
        }
      }
      /* If entire fleet has no data, fall back to 10 %/day */
      var globalFillRate = allFleetRates.length >= 2 ? weightedAvg(allFleetRates) : 10;

      /* ── Per-bin prediction ── */
      return bins.map(function (bin) {
        var logs = logsByBin[bin.id] || [];

        /* ── Step 2: Fill rate observations from consecutive log pairs ── */
        var observations = [];   /* { fillRate, dayOfWeek } */
        for (var j = 1; j < logs.length; j++) {
          var daysBetween = (new Date(logs[j].collectedAt) - new Date(logs[j - 1].collectedAt)) / MS_PER_DAY;
          if (daysBetween <= 0) { continue; }   /* skip same-day pairs */
          observations.push({
            fillRate:  logs[j].fillPctAtCollection / daysBetween,
            dayOfWeek: new Date(logs[j].collectedAt).getDay()
          });
        }

        var fillRatePerDay, confidenceStdDev, confidence, inferredFromFleet;

        if (observations.length < 2) {
          /* ── Step 8: Fleet fallback ── */
          fillRatePerDay    = globalFillRate;
          inferredFromFleet = true;
          confidenceStdDev  = 0;
          confidence        = 'low';
        } else {
          /* ── Step 3: Recency-weighted average ── */
          var rawRates = observations.map(function (o) { return o.fillRate; });
          fillRatePerDay    = weightedAvg(rawRates);
          inferredFromFleet = false;

          /* ── Step 5: Confidence via standard deviation ── */
          var mean = rawRates.reduce(function (s, r) { return s + r; }, 0) / rawRates.length;
          var variance = rawRates.reduce(function (s, r) {
            return s + Math.pow(r - mean, 2);
          }, 0) / rawRates.length;
          confidenceStdDev = Math.sqrt(variance);

          if (observations.length >= 5 && confidenceStdDev < 5) {
            confidence = 'high';
          } else if (observations.length >= 3 || confidenceStdDev < 15) {
            confidence = 'medium';
          } else {
            confidence = 'low';
          }
        }

        /* ── Edge case: fill rate is zero or invalid ── */
        if (!fillRatePerDay || fillRatePerDay <= 0) {
          return {
            binId: bin.id, fillRatePerDay: 0,
            daysUntilThreshold: Infinity, daysUntilFull: Infinity,
            predictedThresholdDate: null, predictedFullDate: null,
            collectionIntervalDays: null, recommendedCollectionDays: [],
            confidence: confidence || 'low', confidenceStdDev: 0, inferredFromFleet: inferredFromFleet
          };
        }

        /* ── Step 6: Forward predictions ── */
        var daysUntilThreshold = bin.fillLevel >= threshold
          ? 0
          : (threshold - bin.fillLevel) / fillRatePerDay;

        var daysUntilFull = bin.fillLevel >= 100
          ? 0
          : (100 - bin.fillLevel) / fillRatePerDay;

        var predictedThresholdDate = new Date(
          today.getTime() + Math.max(0, daysUntilThreshold) * MS_PER_DAY
        ).toISOString().substring(0, 10);

        var predictedFullDate = new Date(
          today.getTime() + Math.max(0, daysUntilFull) * MS_PER_DAY
        ).toISOString().substring(0, 10);

        /* ── Step 7: Recommended collection schedule (14-day projection) ── */
        var collectionIntervalDays = threshold / fillRatePerDay;
        var recommendedCollectionDays = [];
        var todayDow = today.getDay();

        for (var d = 0; d < 14; d++) {
          if (collectionIntervalDays > 0 && Math.round(d % collectionIntervalDays) === 0) {
            var dayName = DAY_NAMES[(todayDow + d) % 7];
            if (recommendedCollectionDays.indexOf(dayName) === -1) {
              recommendedCollectionDays.push(dayName);
            }
          }
        }

        return {
          binId:                    bin.id,
          fillRatePerDay:           Math.round(fillRatePerDay   * 10) / 10,
          daysUntilThreshold:       daysUntilThreshold <= 0 ? 0 : Math.round(daysUntilThreshold * 10) / 10,
          daysUntilFull:            daysUntilFull      <= 0 ? 0 : Math.round(daysUntilFull      * 10) / 10,
          predictedThresholdDate:   predictedThresholdDate,
          predictedFullDate:        predictedFullDate,
          collectionIntervalDays:   Math.round(collectionIntervalDays * 10) / 10,
          recommendedCollectionDays: recommendedCollectionDays,
          confidence:               confidence,
          confidenceStdDev:         Math.round(confidenceStdDev * 10) / 10,
          inferredFromFleet:        inferredFromFleet
        };
      });
    }

  };

}());
