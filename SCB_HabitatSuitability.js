// ============================================
// SANTA CRUZ ISLAND — MARINE HABITAT SUITABILITY
// Southern California Bight | NASA EarthRISE Prep
// M. Youngblood | UH Hilo Marine Science
// github.com/sci-youngblood
// ============================================

// --- 1. DEFINE AREA OF INTEREST ---
// Southern California Bight — broad enough to capture
// offshore thermal gradients relevant to predator movement
var scb = ee.Geometry.Rectangle([-121.0, 32.5, -117.5, 35.0]);

// Santa Cruz Island centroid — for point-based verification
var santaCruz = ee.Geometry.Point([-119.73, 33.98]);

// --- 2. LOAD SST COLLECTION ---
// NOAA Pathfinder V5.3 — 4km daily SST, quality-screened
// 'sea_surface_temperature' band is in degrees Celsius * 100
// Scale factor: multiply by 0.01 to get real Celsius values
var sstCollection = ee.ImageCollection('NOAA/CDR/SST_PATHFINDER/V53')
  .filterDate('2020-01-01', '2020-12-31')
  .filterBounds(scb)
  .select('sea_surface_temperature');

// --- 3. APPLY SCALE FACTOR & BUILD ANNUAL MEDIAN COMPOSITE ---
var sstScaled = sstCollection.map(function(image) {
  return image.multiply(0.01)
              .rename('SST_C')
              .copyProperties(image, ['system:time_start']);
});

var sstMedian = sstScaled.median().clip(scb);

// --- 4. VISUALIZE ---
var sstViz = {
  min: 12,
  max: 24,
  palette: ['#0a1628','#1167b1','#48a9d4','#a0d4e8','#fef9c3','#f97316','#dc2626']
};

Map.setCenter(-119.73, 33.98, 7);
Map.setOptions('HYBRID');
// Map.addLayer(sstMedian, sstViz, 'Annual Median SST 2020 (°C)');

// ============================================
// Module 2: Chlorophyll-a Concentration (MODIS Aqua)
// ============================================

// --- 1. LOAD CHLOROPHYLL-a COLLECTION ---
// NASA Ocean Color L3 SMI — 4km daily
// 'chlor_a' band is in mg/m³ (no additional scale factor needed)
var chlCollection = ee.ImageCollection('NASA/OCEANDATA/MODIS-Aqua/L3SMI')
  .filterDate('2020-01-01', '2020-12-31')
  .filterBounds(scb)
  .select('chlor_a');

// --- 2. BUILD ANNUAL MEDIAN COMPOSITE ---
var chlMedian = chlCollection.median().clip(scb);

// --- 3. LOG-TRANSFORM FOR VISUALIZATION ---
// Chl-a is log-normally distributed — bloom pixels (>10 mg/m³)
// will crush the color scale if displayed linearly.
// log10() compresses the range without losing low-value detail.
var chlLog = chlMedian.log10().rename('CHL_log10');

// --- 4. VISUALIZE ---
// Palette follows oceanographic convention:
// deep blue (low productivity) → green (high productivity)
var chlViz = {
  min: -1.0,   // log10(0.1 mg/m³) — oligotrophic open ocean
  max: 1.0,    // log10(10 mg/m³)  — active upwelling/bloom
  palette: ['#0a1628','#0d3b6e','#1167b1','#2a9d8f','#57cc99','#ccff33']
};

// Map.addLayer(chlLog, chlViz, 'Annual Median Chl-a 2020 (log10 mg/m³)');

// ============================================
// Module 3: Bathymetry (ETOPO1 — NOAA/NGDC)
// ============================================

// --- 1. LOAD ETOPO1 ---
// Single static Image — no date filter needed
// 'bedrock' band contains elevation in meters
// Ocean values are NEGATIVE (depth below sea level)
// Land values are POSITIVE (elevation above sea level)
var etopo = ee.Image('NOAA/NGDC/ETOPO1')
  .select('bedrock')
  .clip(scb);

// --- 2. ISOLATE OCEAN PIXELS ONLY ---
// Keep only pixels where elevation < 0 (below sea level)
// This becomes our ocean mask — reusable in later modules
var oceanMask = etopo.lt(0);
var bathymetry = etopo.updateMask(oceanMask);

// --- 3. DEFINE CONTINENTAL SHELF MASK ---
// Target habitat depth range for SCB predator species:
// Shelf break typically occurs at ~200m in the SCB
// Floor set at -1000m to exclude abyssal pixels from index
var shelfMask = bathymetry.gte(-1000).and(bathymetry.lte(-10));
var shelf = bathymetry.updateMask(shelfMask);

// --- 4. VISUALIZE ---
var bathyViz = {
  min: -3000,
  max: 0,
  palette: ['#0a1628','#1167b1','#48a9d4','#a0d4e8','#e8f4f8']
};

// Map.addLayer(bathymetry, bathyViz, 'Bathymetry — full (m)');
// Map.addLayer(shelf, bathyViz, 'Continental Shelf (-10 to -1000m)');

// ============================================
// Module 4: Habitat Suitability Index
// ============================================

// --- 1. APPLY OCEAN MASK TO SST AND CHL-A ---
// Removes land pixels and ETOPO-defined non-ocean areas
// Eliminates the -3°C artifact flagged in Module 3
var sstMasked = sstMedian.updateMask(oceanMask);
var chlMasked = chlMedian.updateMask(oceanMask);

// --- 2. NORMALIZE SST TO 0–1 ---
// Biological threshold: optimal range 14–18°C for SCB predators
// Below 10°C or above 22°C = unsuitable (score approaches 0)
// Using a linear ramp on each side of the optimal window
var sstSuitability = sstMasked
  .subtract(10)        // shift so optimal window starts at 4
  .divide(8)           // scale ramp width (14-10=4 to 18-10=8)
  .clamp(0, 1)         // hard floor/ceiling at 0 and 1
  .rename('SST_suit');

// --- 3. NORMALIZE CHL-A TO 0–1 ---
// Log-transform first — same reason as visualization
// Optimal: log10(1–5) = 0 to 0.7
var chlLog10 = chlMasked.log10();
var chlSuitability = chlLog10
  .subtract(-0.5)      // shift so ramp starts at 0.3 mg/m³
  .divide(1.2)         // scale across productive range
  .clamp(0, 1)
  .rename('CHL_suit');

// --- 4. NORMALIZE BATHYMETRY TO 0–1 ---
// Optimal shelf depth: -50m to -200m
// Excludes surf zone (> -10m) and abyssal (< -1000m)
var bathySuitability = shelf
  .multiply(-1)        // flip sign so deeper = larger number
  .subtract(10)        // shift floor to 0
  .divide(990)         // scale to 0–1 across -10 to -1000m range
  .clamp(0, 1)
  .rename('BATHY_suit');

// --- 5. COMBINE INTO COMPOSITE INDEX ---
// Multiplicative combination: ALL conditions must be met
// A zero in any layer zeroes the pixel in the final index
var habitatIndex = sstSuitability
  .multiply(chlSuitability)
  .multiply(bathySuitability)
  .rename('Habitat_Suitability');

// --- 6. VISUALIZE INDIVIDUAL SUITABILITY LAYERS ---
var suitViz = {min: 0, max: 1, palette: ['#0a1628','#1167b1','#57cc99','#ccff33','#ffffff']};

// Map.addLayer(sstSuitability, suitViz, 'SST Suitability (0–1)');
// Map.addLayer(chlSuitability, suitViz, 'Chl-a Suitability (0–1)');
// Map.addLayer(bathySuitability, suitViz, 'Bathymetry Suitability (0–1)');

// --- 7. VISUALIZE COMPOSITE INDEX ---
var indexViz = {
  min: 0,
  max: 0.5,    // multiplicative product compresses range — max: 0.5 not 1.0
  palette: ['#0a1628','#1167b1','#2a9d8f','#57cc99','#ccff33','#ffffff']
};

// Map.addLayer(habitatIndex, indexViz, '*** HABITAT SUITABILITY INDEX ***');

// ============================================
// Module 5: Interactive UI Panel
// ============================================

// --- 1. CONFIGURE BASE MAP ---
Map.setCenter(-119.73, 33.98, 8);
Map.setOptions('HYBRID');
Map.style().set('cursor', 'crosshair');

// --- 2. ADD LAYERS TO MAP (CONTROLLED) ---
// Layers added here are toggled by the panel checkboxes below
// Only the index is visible by default
var layerSST = ui.Map.Layer(sstMasked, {
  min: 12, max: 24,
  palette: ['#0a1628','#1167b1','#48a9d4','#a0d4e8','#fef9c3','#f97316','#dc2626']
}, 'SST 2020 (°C)', false);

var layerCHL = ui.Map.Layer(chlLog, {
  min: -1.0, max: 1.0,
  palette: ['#0a1628','#0d3b6e','#1167b1','#2a9d8f','#57cc99','#ccff33']
}, 'Chlorophyll-a 2020 (log10 mg/m³)', false);

var layerBathy = ui.Map.Layer(bathymetry, {
  min: -3000, max: 0,
  palette: ['#0a1628','#1167b1','#48a9d4','#a0d4e8','#e8f4f8']
}, 'Bathymetry (m)', false);

var layerIndex = ui.Map.Layer(habitatIndex, {
  min: 0, max: 0.5,
  palette: ['#0a1628','#1167b1','#2a9d8f','#57cc99','#ccff33','#ffffff']
}, 'Habitat Suitability Index', true);

Map.layers().add(layerSST);
Map.layers().add(layerCHL);
Map.layers().add(layerBathy);
Map.layers().add(layerIndex);

// --- 3. BUILD PANEL STRUCTURE ---
var panel = ui.Panel({
  style: {
    width: '320px',
    padding: '12px',
    backgroundColor: '#0a1628'
  }
});

// --- 4. PANEL CONTENT ---
// Title
panel.add(ui.Label('Marine Habitat Suitability', {
  fontSize: '18px',
  fontWeight: 'bold',
  color: '#57cc99',
  backgroundColor: '#0a1628',
  margin: '0 0 4px 0'
}));

// Subtitle
panel.add(ui.Label('Santa Cruz Island — Southern California Bight', {
  fontSize: '12px',
  color: '#a0d4e8',
  backgroundColor: '#0a1628',
  margin: '0 0 12px 0'
}));

// Description
panel.add(ui.Label(
  'Multi-variable habitat suitability index for marine predator species ' +
  '(White Shark, Giant Sea Bass) based on annual median SST, ' +
  'Chlorophyll-a concentration, and bathymetric depth. ' +
  'Data: NOAA CDR Pathfinder, MODIS Aqua, ETOPO1. Year: 2020.',
  {
    fontSize: '11px',
    color: '#e8f4f8',
    backgroundColor: '#0a1628',
    margin: '0 0 16px 0'
  }
));

// Divider
panel.add(ui.Label('─────────────────────────', {
  color: '#1167b1',
  backgroundColor: '#0a1628',
  margin: '0 0 8px 0'
}));

// Layer toggle header
panel.add(ui.Label('LAYERS', {
  fontSize: '11px',
  fontWeight: 'bold',
  color: '#a0d4e8',
  backgroundColor: '#0a1628',
  margin: '0 0 8px 0'
}));

// --- 5. LAYER TOGGLE CHECKBOXES ---
// Each checkbox directly controls its layer's visibility
var checkboxIndex = ui.Checkbox({
  label: 'Habitat Suitability Index',
  value: true,
  style: {color: '#57cc99', backgroundColor: '#0a1628', fontSize: '12px'}
});
checkboxIndex.onChange(function(checked) {
  layerIndex.setShown(checked);
});

var checkboxSST = ui.Checkbox({
  label: 'Sea Surface Temperature (°C)',
  value: false,
  style: {color: '#f97316', backgroundColor: '#0a1628', fontSize: '12px'}
});
checkboxSST.onChange(function(checked) {
  layerSST.setShown(checked);
});

var checkboxCHL = ui.Checkbox({
  label: 'Chlorophyll-a (log10 mg/m³)',
  value: false,
  style: {color: '#ccff33', backgroundColor: '#0a1628', fontSize: '12px'}
});
checkboxCHL.onChange(function(checked) {
  layerCHL.setShown(checked);
});

var checkboxBathy = ui.Checkbox({
  label: 'Bathymetry (m)',
  value: false,
  style: {color: '#48a9d4', backgroundColor: '#0a1628', fontSize: '12px'}
});
checkboxBathy.onChange(function(checked) {
  layerBathy.setShown(checked);
});

panel.add(checkboxIndex);
panel.add(checkboxSST);
panel.add(checkboxCHL);
panel.add(checkboxBathy);

// --- 6. CLICK-TO-INSPECT INTERACTION ---
// User clicks any point on the map → panel displays values
panel.add(ui.Label('─────────────────────────', {
  color: '#1167b1',
  backgroundColor: '#0a1628',
  margin: '8px 0 8px 0'
}));

panel.add(ui.Label('INSPECT', {
  fontSize: '11px',
  fontWeight: 'bold',
  color: '#a0d4e8',
  backgroundColor: '#0a1628',
  margin: '0 0 8px 0'
}));

panel.add(ui.Label('Click any ocean point to inspect values.', {
  fontSize: '11px',
  color: '#e8f4f8',
  backgroundColor: '#0a1628',
  margin: '0 0 8px 0'
}));

// Dynamic label — updates on click
var inspectLabel = ui.Label('—', {
  fontSize: '11px',
  color: '#57cc99',
  backgroundColor: '#0a1628'
});
panel.add(inspectLabel);

// Stack all variables into one image for efficient sampling
var inspectImage = sstMasked
  .rename('SST_C')
  .addBands(chlMasked.rename('CHL_mgm3'))
  .addBands(bathymetry.rename('Depth_m'))
  .addBands(habitatIndex.rename('Suitability'));

Map.onClick(function(coords) {
  var point = ee.Geometry.Point([coords.lon, coords.lat]);
  var sample = inspectImage.reduceRegion({
    reducer: ee.Reducer.first(),
    geometry: point,
    scale: 4000
  });

  // Pull values and format display string
  sample.evaluate(function(result) {
    if (!result || result.SST_C === null) {
      inspectLabel.setValue('No ocean data at this point.');
      return;
    }
    inspectLabel.setValue(
  'SST: ' + (result.SST_C !== null && result.SST_C !== undefined ? result.SST_C.toFixed(2) + ' °C' : 'n/a') + '\n' +
  'Chl-a: ' + (result.CHL_mgm3 !== null && result.CHL_mgm3 !== undefined ? result.CHL_mgm3.toFixed(3) + ' mg/m³' : 'n/a') + '\n' +
  'Depth: ' + (result.Depth_m !== null && result.Depth_m !== undefined ? result.Depth_m.toFixed(0) + ' m' : 'n/a') + '\n' +
  'Suitability: ' + (result.Suitability !== null && result.Suitability !== undefined ? result.Suitability.toFixed(4) : 'n/a')
);
  });
});

// --- 7. ATTRIBUTION ---
panel.add(ui.Label('─────────────────────────', {
  color: '#1167b1',
  backgroundColor: '#0a1628',
  margin: '8px 0 8px 0'
}));

panel.add(ui.Label('M. Youngblood | UH Hilo Marine Science\ngithub.com/sci-youngblood', {
  fontSize: '10px',
  color: '#1167b1',
  backgroundColor: '#0a1628'
}));

// --- 8. ADD PANEL TO UI ---
ui.root.insert(0, panel);

// ============================================
// Module 6: Export
// ============================================

// --- 1. EXPORT HABITAT SUITABILITY INDEX TO DRIVE ---
// Outputs a GeoTIFF suitable for ArcGIS Pro, QGIS, or publication
Export.image.toDrive({
  image: habitatIndex,
  description: 'SCB_HabitatSuitability_2020',   // Task name in GEE Tasks tab
  folder: 'GEE_Exports',                          // Google Drive folder
  fileNamePrefix: 'SCB_HabitatSuitability_2020',
  region: scb,
  scale: 4000,          // Match MODIS native resolution
  crs: 'EPSG:4326',     // Standard geographic CRS
  maxPixels: 1e8,
  fileFormat: 'GeoTIFF'
});

// --- 2. EXPORT MULTI-BAND STACK ---
// Single GeoTIFF with all four variables as separate bands
// Useful for multivariate analysis in R or Python downstream
var exportStack = sstMasked.rename('SST_C')
  .addBands(chlMasked.rename('CHL_mgm3'))
  .addBands(bathymetry.rename('Depth_m'))
  .addBands(habitatIndex.rename('Suitability'));

Export.image.toDrive({
  image: exportStack,
  description: 'SCB_MultivarStack_2020',
  folder: 'GEE_Exports',
  fileNamePrefix: 'SCB_MultivarStack_2020',
  region: scb,
  scale: 4000,
  crs: 'EPSG:4326',
  maxPixels: 1e8,
  fileFormat: 'GeoTIFF'
});

print('Export tasks registered. Go to Tasks tab (top right) to run.');