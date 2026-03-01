/* SmartRoute Add-In - Dynamic Waste Fleet Optimization */
/* ES5 only - MyGeotab embedded environment */
/* Implements DVRP patterns from dvpr_paper.md: AddInData, Zone+Route writeback, 2-opt */

var _debugData = {};
var MY_ADDIN_ID = 'SmartRouteBinState2026';

function debugLog(msg) {
  var el = document.getElementById('debug-log');
  if (el) {
    el.textContent += '[' + new Date().toLocaleTimeString() + '] ' + msg + '\n';
    el.scrollTop = el.scrollHeight;
  }
}

function copyDebugData() {
  var t = document.createElement('textarea');
  t.value = JSON.stringify(_debugData, null, 2);
  document.body.appendChild(t);
  t.select();
  document.execCommand('copy');
  document.body.removeChild(t);
  alert('Debug data copied to clipboard!');
}

function debugSample(key, arr) {
  _debugData[key] = arr ? { total: arr.length, sample: arr.slice(0, 5) } : null;
}

/* Embedded bin data - same as data/bins-demo.json */
var BINS_DATA = {
  bins: [
    { id: 'bin-1', lat: 40.7128, lng: -74.006, fillLevel: 85 },
    { id: 'bin-2', lat: 40.715, lng: -74.008, fillLevel: 42 },
    { id: 'bin-3', lat: 40.718, lng: -74.004, fillLevel: 92 },
    { id: 'bin-4', lat: 40.71, lng: -74.01, fillLevel: 28 },
    { id: 'bin-5', lat: 40.72, lng: -74.012, fillLevel: 67 },
    { id: 'bin-6', lat: 40.708, lng: -74.002, fillLevel: 15 },
    { id: 'bin-7', lat: 40.722, lng: -74.006, fillLevel: 78 },
    { id: 'bin-8', lat: 40.706, lng: -74.014, fillLevel: 55 },
    { id: 'bin-9', lat: 40.724, lng: -74.01, fillLevel: 91 },
    { id: 'bin-10', lat: 40.714, lng: -74, fillLevel: 33 },
    { id: 'bin-11', lat: 40.716, lng: -74.016, fillLevel: 72 },
    { id: 'bin-12', lat: 40.704, lng: -74.006, fillLevel: 8 },
    { id: 'bin-13', lat: 40.726, lng: -74.004, fillLevel: 88 },
    { id: 'bin-14', lat: 40.712, lng: -74.018, fillLevel: 61 },
    { id: 'bin-15', lat: 40.702, lng: -74.01, fillLevel: 45 },
    { id: 'bin-16', lat: 40.728, lng: -74.008, fillLevel: 95 },
    { id: 'bin-17', lat: 40.71, lng: -74.02, fillLevel: 22 },
    { id: 'bin-18', lat: 40.7, lng: -74.002, fillLevel: 76 },
    { id: 'bin-19', lat: 40.73, lng: -74.012, fillLevel: 54 },
    { id: 'bin-20', lat: 40.708, lng: -74.022, fillLevel: 39 },
    { id: 'bin-21', lat: 40.718, lng: -73.998, fillLevel: 83 },
    { id: 'bin-22', lat: 40.698, lng: -74.006, fillLevel: 12 },
    { id: 'bin-23', lat: 40.732, lng: -74.002, fillLevel: 69 },
    { id: 'bin-24', lat: 40.706, lng: -74.024, fillLevel: 97 },
    { id: 'bin-25', lat: 40.72, lng: -73.996, fillLevel: 51 },
    { id: 'bin-26', lat: 40.696, lng: -74.014, fillLevel: 36 },
    { id: 'bin-27', lat: 40.734, lng: -74.016, fillLevel: 74 },
    { id: 'bin-28', lat: 40.704, lng: -74.026, fillLevel: 19 },
    { id: 'bin-29', lat: 40.722, lng: -73.994, fillLevel: 87 },
    { id: 'bin-30', lat: 40.694, lng: -74.018, fillLevel: 63 }
  ],
  depot: { lat: 40.7128, lng: -74.006 }
};

function haversineKm(lat1, lng1, lat2, lng2) {
  var R = 6371;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLng = (lng2 - lng1) * Math.PI / 180;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function routeDistanceKm(points) {
  var total = 0;
  for (var i = 0; i < points.length - 1; i++) {
    total += haversineKm(points[i].lat, points[i].lng, points[i + 1].lat, points[i + 1].lng);
  }
  return total;
}

function nearestNeighborRoute(start, bins) {
  var ordered = [];
  var remaining = bins.slice();
  var current = start;
  while (remaining.length > 0) {
    var bestIdx = 0;
    var bestDist = haversineKm(current.lat, current.lng, remaining[0].lat, remaining[0].lng);
    for (var i = 1; i < remaining.length; i++) {
      var d = haversineKm(current.lat, current.lng, remaining[i].lat, remaining[i].lng);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
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
        var newRoute = result.slice(0, i + 1).concat(rev).concat(result.slice(j + 1));
        var after = routeDistanceKm(newRoute);
        if (after < before) {
          result = newRoute;
          improved = true;
          break;
        }
      }
      if (improved) break;
    }
  }
  return result;
}

function getBinColor(fillLevel) {
  if (fillLevel < 50) return '#28a745';
  if (fillLevel < 70) return '#ffc107';
  return '#dc3545';
}

function createZonePoints(lat, lng) {
  var offset = 0.0001;
  return [
    { x: lng - offset, y: lat - offset },
    { x: lng + offset, y: lat - offset },
    { x: lng + offset, y: lat + offset },
    { x: lng - offset, y: lat + offset },
    { x: lng - offset, y: lat - offset }
  ];
}

geotab.addin['smartroute'] = function() {
  var map, apiRef;
  var binMarkers = [];
  var vehicleMarkers = [];
  var vehiclePolylines = [];
  var vehicleStatuses = [];
  var originalPolyline = null;
  var optimizedPolyline = null;
  var bins = [];
  var binStateId = null;
  var lastOptimizedOrder = [];
  var lastThreshold = 70;

  function randomizeFillLevels() {
    bins = BINS_DATA.bins.map(function(b) {
      return {
        id: b.id,
        lat: b.lat,
        lng: b.lng,
        fillLevel: Math.floor(Math.random() * 95) + 5
      };
    });
  }

  function loadBinState(cb) {
    apiRef.call('Get', {
      typeName: 'AddInData',
      search: { addInId: MY_ADDIN_ID }
    }, function(results) {
      var binState = null;
      for (var i = 0; i < (results || []).length; i++) {
        var r = results[i];
        if (r.details && r.details.type === 'bin_state') {
          binState = r.details;
          binStateId = r.id;
          break;
        }
      }
      if (binState && binState.bins && binState.bins.length > 0) {
        bins = binState.bins;
        debugLog('Loaded bin_state from AddInData: ' + bins.length + ' bins');
      } else {
        randomizeFillLevels();
        saveBinState(cb);
        return;
      }
      if (cb) cb();
    }, function(err) {
      debugLog('AddInData Get error: ' + err);
      randomizeFillLevels();
      if (cb) cb();
    });
  }

  function saveBinState(cb) {
    var entity = {
      addInId: MY_ADDIN_ID,
      groups: [{ id: 'GroupCompanyId' }],
      details: {
        type: 'bin_state',
        bins: bins,
        savedAt: new Date().toISOString()
      }
    };
    if (binStateId) entity.id = binStateId;
    apiRef.call(binStateId ? 'Set' : 'Add', {
      typeName: 'AddInData',
      entity: entity
    }, function(id) {
      if (!binStateId) binStateId = id;
      debugLog('Saved bin_state');
      if (cb) cb();
    }, function(err) {
      debugLog('AddInData save error: ' + err);
      if (cb) cb();
    });
  }

  function addCollectionLog(routeId, deviceId, binId, fillPct, lat, lng, thresholdUsed) {
    apiRef.call('Add', {
      typeName: 'AddInData',
      entity: {
        addInId: MY_ADDIN_ID,
        groups: [{ id: 'GroupCompanyId' }],
        details: {
          type: 'collection_log',
          routeId: routeId || 'demo',
          deviceId: deviceId || 'demo',
          binId: binId,
          collectedAt: new Date().toISOString(),
          fillPctAtCollection: fillPct,
          lat: lat,
          lng: lng,
          thresholdUsed: thresholdUsed
        }
      }
    }, function() {
      debugLog('Collection logged: ' + binId);
    }, function(err) {
      debugLog('Collection log error: ' + err);
    });
  }

  function clearMapOverlays() {
    binMarkers.forEach(function(m) { if (map && map.removeLayer) map.removeLayer(m); });
    binMarkers = [];
    vehiclePolylines.forEach(function(p) { if (map && map.removeLayer) map.removeLayer(p); });
    vehiclePolylines = [];
    if (originalPolyline && map) map.removeLayer(originalPolyline);
    originalPolyline = null;
    if (optimizedPolyline && map) map.removeLayer(optimizedPolyline);
    optimizedPolyline = null;
  }

  function addBinMarker(bin) {
    var color = getBinColor(bin.fillLevel);
    var icon = L.divIcon({
      className: 'bin-marker',
      html: '<div style="width:14px;height:14px;border-radius:50%;background:' + color + ';border:2px solid #333;"></div>',
      iconSize: [14, 14]
    });
    var m = L.marker([bin.lat, bin.lng], { icon: icon })
      .addTo(map)
      .bindPopup('<b>' + bin.id + '</b><br>Fill: ' + bin.fillLevel + '%');
    binMarkers.push(m);
  }

  function addVehicleMarker(status) {
    var name = (status.device && status.device.id) ? status.device.id : 'Vehicle';
    var m = L.marker([status.latitude, status.longitude])
      .addTo(map)
      .bindPopup('<b>' + name + '</b><br>Speed: ' + (status.speed || 0) + ' km/h');
    vehicleMarkers.push(m);
  }

  function drawRoute(points, color, weight) {
    var latlngs = points.map(function(p) { return [p.lat, p.lng]; });
    return L.polyline(latlngs, { color: color, weight: weight || 4 }).addTo(map);
  }

  function updateStats(originalStops, optimizedStops, originalKm, optimizedKm) {
    var stopsReduced = originalStops - optimizedStops;
    var kmSaved = Math.max(0, originalKm - optimizedKm);
    var fuelPerKm = 0.3;
    var fuelSaved = kmSaved * fuelPerKm;
    var co2PerLiter = 2.68;
    var co2Avoided = fuelSaved * co2PerLiter;

    document.getElementById('val-stops').textContent = stopsReduced;
    document.getElementById('val-km').textContent = kmSaved.toFixed(1);
    document.getElementById('val-fuel').textContent = fuelSaved.toFixed(2) + ' L';
    document.getElementById('val-co2').textContent = co2Avoided.toFixed(1) + ' kg';
  }

  function assignBinsToVehicles(binsList, vehicles) {
    var clusters = {};
    vehicles.forEach(function(v, i) {
      clusters['v' + i] = { vehicle: v, bins: [] };
    });
    binsList.forEach(function(bin) {
      var bestIdx = 0;
      var bestDist = haversineKm(bin.lat, bin.lng, vehicles[0].latitude, vehicles[0].longitude);
      for (var i = 1; i < vehicles.length; i++) {
        var d = haversineKm(bin.lat, bin.lng, vehicles[i].latitude, vehicles[i].longitude);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      clusters['v' + bestIdx].bins.push(bin);
    });
    return clusters;
  }

  function runOptimization() {
    var threshold = parseInt(document.getElementById('threshold-slider').value, 10);
    document.getElementById('threshold-value').textContent = threshold;
    lastThreshold = threshold;

    var binsAboveThreshold = bins.filter(function(b) { return b.fillLevel >= threshold; });
    var depot = BINS_DATA.depot;
    var vehiclesWithPos = (vehicleStatuses || []).filter(function(s) { return s.latitude && s.longitude; });

    clearMapOverlays();

    bins.forEach(function(b) { addBinMarker(b); });

    var originalOrder = nearestNeighborRoute(depot, bins.slice());
    var originalPoints = [depot].concat(originalOrder.map(function(b) { return { lat: b.lat, lng: b.lng }; }));
    if (originalPoints.length > 1) originalPoints.push(depot);
    originalPolyline = drawRoute(originalPoints, '#6c757d', 3);

    var optimizedOrder = [];
    var optimizedKm = 0;

    if (binsAboveThreshold.length > 0 && vehiclesWithPos.length > 0) {
      var clusters = assignBinsToVehicles(binsAboveThreshold, vehiclesWithPos);
      var colors = ['#0d6efd', '#198754', '#fd7e14', '#6f42c1'];
      Object.keys(clusters).forEach(function(k, i) {
        var c = clusters[k];
        if (c.bins.length === 0) return;
        var start = { lat: c.vehicle.latitude, lng: c.vehicle.longitude };
        var order = nearestNeighborRoute(start, c.bins.slice());
        var pts = [start].concat(order.map(function(b) { return { lat: b.lat, lng: b.lng }; }));
        pts = twoOptImprove(pts);
        pts.push(start);
        optimizedKm += routeDistanceKm(pts);
        var color = colors[i % colors.length];
        vehiclePolylines.push(drawRoute(pts, color, 4));
        if (i === 0) optimizedOrder = order;
      });
      lastOptimizedOrder = optimizedOrder.length > 0 ? optimizedOrder : binsAboveThreshold;
    } else if (binsAboveThreshold.length > 0) {
      optimizedOrder = nearestNeighborRoute(depot, binsAboveThreshold.slice());
      var optimizedPoints = [depot].concat(optimizedOrder.map(function(b) { return { lat: b.lat, lng: b.lng }; }));
      optimizedPoints = twoOptImprove(optimizedPoints);
      optimizedPoints.push(depot);
      optimizedPolyline = drawRoute(optimizedPoints, '#0d6efd', 5);
      optimizedKm = routeDistanceKm(optimizedPoints);
      lastOptimizedOrder = optimizedOrder;
    }

    var originalKm = routeDistanceKm(originalPoints);
    updateStats(bins.length, binsAboveThreshold.length, originalKm, optimizedKm);

    var statusExtra = vehiclesWithPos.length > 0 ? ' (' + vehiclesWithPos.length + ' vehicles)' : '';
    document.getElementById('status-text').textContent =
      binsAboveThreshold.length + ' bins above ' + threshold + '% (of ' + bins.length + ')' + statusExtra + ' — ' +
      (bins.length - binsAboveThreshold.length) + ' stops skipped';

    debugLog('Threshold: ' + threshold + '%, bins above: ' + binsAboveThreshold.length);
    debugSample('binsAboveThreshold', binsAboveThreshold);

    saveBinState();
  }

  function writeRouteToGeotab() {
    if (lastOptimizedOrder.length < 2) {
      alert('Need at least 2 bins above threshold to create a route.');
      return;
    }

    var btn = document.getElementById('write-route-btn');
    btn.disabled = true;
    btn.textContent = 'Writing...';

    var routeName = 'SmartRoute-' + new Date().toISOString().slice(0, 10) + '-' + Date.now();
    var zoneIds = [];
    var idx = 0;

    function createNextZone() {
      if (idx >= lastOptimizedOrder.length) {
        createRoute(zoneIds);
        return;
      }
      var bin = lastOptimizedOrder[idx];
      var zoneName = 'SmartRoute-' + bin.id;
      apiRef.call('Add', {
        typeName: 'Zone',
        entity: {
          name: zoneName,
          points: createZonePoints(bin.lat, bin.lng),
          displayed: true
        }
      }, function(zoneId) {
        zoneIds.push({ id: zoneId });
        idx++;
        createNextZone();
      }, function(err) {
        debugLog('Zone Add error: ' + err);
        btn.disabled = false;
        btn.textContent = 'Write Route to MyGeotab';
        alert('Failed to create zone: ' + err);
      });
    }

    function createRoute(zones) {
      apiRef.call('Add', {
        typeName: 'Route',
        entity: {
          name: routeName,
          comment: 'SmartRoute optimized waste collection route'
        }
      }, function(routeId) {
        var seq = 0;
        function addNextPlanItem() {
          if (seq >= zones.length) {
            debugLog('Route created: ' + routeName);
            btn.disabled = false;
            btn.textContent = 'Write Route to MyGeotab';
            alert('Route "' + routeName + '" created successfully!');
            return;
          }
          apiRef.call('Add', {
            typeName: 'RoutePlanItem',
            entity: {
              route: { id: routeId },
              zone: zones[seq],
              sequence: seq
            }
          }, function() {
            seq++;
            addNextPlanItem();
          }, function(err) {
            debugLog('RoutePlanItem Add error: ' + err);
            btn.disabled = false;
            btn.textContent = 'Write Route to MyGeotab';
            alert('Route created but failed to add waypoint: ' + err);
          });
        }
        addNextPlanItem();
      }, function(err) {
        debugLog('Route Add error: ' + err);
        btn.disabled = false;
        btn.textContent = 'Write Route to MyGeotab';
        alert('Failed to create route: ' + err);
      });
    }

    createNextZone();
  }

  function logCollectionSimulate() {
    if (lastOptimizedOrder.length === 0) {
      alert('Optimize a route first (set threshold).');
      return;
    }
    var bin = lastOptimizedOrder[0];
    var deviceId = (vehicleStatuses[0] && vehicleStatuses[0].device) ? vehicleStatuses[0].device.id : 'demo';
    addCollectionLog('demo', deviceId, bin.id, bin.fillLevel, bin.lat, bin.lng, lastThreshold);
    bin.fillLevel = 0;
    saveBinState(function() {
      runOptimization();
      alert('Simulated collection of ' + bin.id + ' (fill reset to 0%).');
    });
  }

  function loadVehicles() {
    apiRef.call('Get', { typeName: 'DeviceStatusInfo' }, function(statuses) {
      debugLog('DeviceStatusInfo: ' + (statuses ? statuses.length : 0) + ' vehicles');
      debugSample('deviceStatuses', statuses);
      vehicleStatuses = statuses || [];
      if (statuses) {
        statuses.forEach(function(s) {
          if (s.latitude && s.longitude) addVehicleMarker(s);
        });
      }
      runOptimization();
    }, function(err) {
      debugLog('DeviceStatusInfo error: ' + err);
      _debugData.lastError = String(err);
      runOptimization();
    });
  }

  return {
    initialize: function(api, state, callback) {
      apiRef = api;
      debugLog('SmartRoute initialize');

      map = L.map('map').setView([40.7128, -74.006], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }).addTo(map);

      document.getElementById('threshold-slider').oninput = function() {
        runOptimization();
      };

      document.getElementById('write-route-btn').onclick = writeRouteToGeotab;
      document.getElementById('log-collection-btn').onclick = logCollectionSimulate;

      loadBinState(function() {
        loadVehicles();
      });
      callback();
    },
    focus: function(api, state) {
      apiRef = api;
      if (map) setTimeout(function() { map.invalidateSize(); }, 200);
    },
    blur: function() {}
  };
};
