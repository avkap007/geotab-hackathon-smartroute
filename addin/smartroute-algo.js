/* SmartRoute Algorithm Module */
/* Person 2 owns this file. ES5 only. No DOM access. No apiRef calls. */
/* Exposes window.SmartRouteAlgo — see docs/COLLABORATION.md for the contract */

(function () {

  /* ── Geometry helpers ─────────────────────────────────────────────────── */

  function haversineKm(lat1, lng1, lat2, lng2) {
    var R = 6371;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLng = (lng2 - lng1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function routeDistanceKm(points) {
    var total = 0;
    for (var i = 0; i < points.length - 1; i++) {
      total += haversineKm(points[i].lat, points[i].lng, points[i + 1].lat, points[i + 1].lng);
    }
    return total;
  }

  /* ── STUB: Nearest-neighbour + 2-opt ─────────────────────────────────── */
  /* Person 2: replace the body of optimizeForVehicle() with               */
  /* Clarke-Wright, capacity constraints, time windows, etc.               */

  function nearestNeighborRoute(start, bins) {
    var ordered = [];
    var remaining = bins.slice();
    var current = start;
    while (remaining.length > 0) {
      var bestIdx = 0;
      var bestDist = haversineKm(current.lat, current.lng, remaining[0].lat, remaining[0].lng);
      for (var i = 1; i < remaining.length; i++) {
        var d = haversineKm(current.lat, current.lng, remaining[i].lat, remaining[i].lng);
        if (d < bestDist) { bestDist = d; bestIdx = i; }
      }
      ordered.push(remaining[bestIdx]);
      current = remaining[bestIdx];
      remaining.splice(bestIdx, 1);
    }
    return ordered;
  }

  function twoOptImprove(points) {
    if (points.length < 4) return points;
    var improved = true;
    var result = points.slice();
    while (improved) {
      improved = false;
      for (var i = 0; i < result.length - 2; i++) {
        for (var j = i + 2; j < result.length; j++) {
          var before = routeDistanceKm(result);
          var rev = result.slice(i + 1, j + 1).reverse();
          var candidate = result.slice(0, i + 1).concat(rev).concat(result.slice(j + 1));
          if (routeDistanceKm(candidate) < before) {
            result = candidate;
            improved = true;
            break;
          }
        }
        if (improved) break;
      }
    }
    return result;
  }

  /* optimizeForVehicle — given a start point and a list of bins, returns
     { points: [{lat,lng}…], order: [bin…] } with depot at start and end.
     REPLACE THE BODY of this function with your better algorithm.         */
  function optimizeForVehicle(start, binsForVehicle) {
    var ordered = nearestNeighborRoute(start, binsForVehicle);
    var pts = [start].concat(ordered.map(function (b) { return { lat: b.lat, lng: b.lng }; }));
    pts = twoOptImprove(pts);
    pts.push(start);
    return { points: pts, order: ordered };
  }

  /* ── Public interface ─────────────────────────────────────────────────── */

  window.SmartRouteAlgo = {

    /* Set by Person 1 once on initialize. Called with results after run(). */
    onComplete: null,

    /*
     * run(bins, depot, options)
     *
     * bins    — [{ id, name, lat, lng, fillLevel }]
     * depot   — { lat, lng }
     * options — { threshold: Number, vehicleCapacity: Number,
     *             vehicles: [{ latitude, longitude }] }
     *
     * Calls this.onComplete(results) when done.
     * Returns results directly as well (for testing outside the add-in).
     */
    run: function (bins, depot, options) {
      var threshold       = (options && options.threshold)       || 70;
      var vehicles        = ((options && options.vehicles) || []).filter(function (v) {
        return v.latitude && v.longitude;
      });

      /* Split bins by threshold */
      var toCollect = bins.filter(function (b) { return b.fillLevel >= threshold; });
      var skipped   = bins.filter(function (b) { return b.fillLevel < threshold; });

      /* Unoptimised baseline (all bins) — used to calculate km saved */
      var allOrdered = nearestNeighborRoute(depot, bins.slice());
      var originalPoints = [depot].concat(
        allOrdered.map(function (b) { return { lat: b.lat, lng: b.lng }; })
      );
      if (originalPoints.length > 1) originalPoints.push(depot);
      var originalKm = routeDistanceKm(originalPoints);

      /* Optimise */
      var COLORS = ['#0d6efd', '#198754', '#fd7e14', '#6f42c1', '#d63384'];
      var vehicleRoutes  = [];
      var optimizedOrder = [];
      var optimizedKm    = 0;

      if (toCollect.length > 0) {
        if (vehicles.length > 1) {
          /* Multi-vehicle: assign bins to nearest vehicle, then optimise each.  */
          /* TODO Person 2: replace with k-means or Clarke-Wright multi-vehicle. */
          var clusters = vehicles.map(function () { return []; });
          toCollect.forEach(function (bin) {
            var bestIdx  = 0;
            var bestDist = haversineKm(bin.lat, bin.lng, vehicles[0].latitude, vehicles[0].longitude);
            for (var i = 1; i < vehicles.length; i++) {
              var d = haversineKm(bin.lat, bin.lng, vehicles[i].latitude, vehicles[i].longitude);
              if (d < bestDist) { bestDist = d; bestIdx = i; }
            }
            clusters[bestIdx].push(bin);
          });

          clusters.forEach(function (clusterBins, i) {
            if (clusterBins.length === 0) return;
            var vStart = { lat: vehicles[i].latitude, lng: vehicles[i].longitude };
            var res    = optimizeForVehicle(vStart, clusterBins);
            optimizedKm += routeDistanceKm(res.points);
            vehicleRoutes.push({ points: res.points, color: COLORS[i % COLORS.length] });
            if (i === 0) optimizedOrder = res.order;
          });

          if (optimizedOrder.length === 0) optimizedOrder = toCollect;

        } else {
          /* Single vehicle (or no live vehicle GPS) */
          var start = vehicles.length > 0
            ? { lat: vehicles[0].latitude, lng: vehicles[0].longitude }
            : depot;
          var res = optimizeForVehicle(start, toCollect);
          optimizedKm    = routeDistanceKm(res.points);
          optimizedOrder = res.order;
          vehicleRoutes  = [{ points: res.points, color: COLORS[0] }];
        }
      }

      var kmSaved    = Math.max(0, originalKm - optimizedKm);
      var fuelSavedL = kmSaved * 0.3;

      var results = {
        optimizedOrder: optimizedOrder,   /* bins to collect, in sequence         */
        skippedBins:    skipped,          /* bins below threshold                  */
        vehicleRoutes:  vehicleRoutes,    /* [{ points: [{lat,lng}…], color }]    */
        originalPoints: originalPoints,   /* all-bins baseline for grey polyline   */
        savings: {
          stopsReduced: bins.length - toCollect.length,
          kmSaved:      kmSaved,
          fuelSavedL:   fuelSavedL,
          co2AvoidedKg: fuelSavedL * 2.68
        }
      };

      if (typeof this.onComplete === 'function') {
        this.onComplete(results);
      }

      return results;
    },

    /*
     * predict(collectionLogs, bins)
     *
     * collectionLogs — AddInData records with details.type === 'collection_log'
     * bins           — current bins array
     *
     * Returns a predictions array. The caller (Person 1) stores this to AddInData.
     * Person 2: implement fill-rate regression here.
     */
    predict: function (_collectionLogs, bins) {
      /* STUB: returns low-confidence nulls until regression is implemented */
      return bins.map(function (b) {
        return {
          binId: b.id,
          predictedFullDate: null,
          fillRatePerDay: null,
          recommendedCollectionDays: [],
          confidence: 'low'
        };
      });
    }

  };

}());
