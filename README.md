# Marine Habitat Suitability — Santa Cruz Island
### Southern California Bight | Google Earth Engine

![Platform](https://img.shields.io/badge/platform-Google%20Earth%20Engine-4285F4?style=flat-square)
![Language](https://img.shields.io/badge/language-JavaScript-F7DF1E?style=flat-square)
![Domain](https://img.shields.io/badge/domain-Ocean%20Remote%20Sensing-57cc99?style=flat-square)
![Status](https://img.shields.io/badge/status-active-brightgreen?style=flat-square)

---

## Overview

A multi-variable marine habitat suitability index for the Southern California Bight (SCB), built entirely in Google Earth Engine. The application combines sea surface temperature, chlorophyll-a concentration, and bathymetric depth into a composite 0–1 suitability score with an interactive, deployable UI panel.

Developed as part of NASA EarthRISE Developers Academy preparation and as a portfolio demonstration of cloud-native oceanographic remote sensing workflows.

**[Live App →](https://atlantean-house-406306.projects.earthengine.app/view/scb-habitat-suitability)**

---

## Scientific Context

The Santa Cruz Island shelf sits at the northern boundary of the Southern California Bight — a region of high ecological significance where the California Current, Point Conception upwelling, and the Southern California Countercurrent converge. This thermal and productivity boundary drives aggregations of marine predator species including White Sharks (*Carcharodon carcharias*) and Giant Sea Bass (*Stereolepis gigas*).

This index asks: **what oceanographic conditions define high-probability habitat for marine predators in the SCB?**

The approach is grounded in 11 years of acoustic telemetry data collected across the Channel Islands National Marine Sanctuary (CINMS), which identified SST gradients, upwelling-driven productivity zones, and continental shelf structure as primary predictors of aggregation site selection across seven threatened and vulnerable marine predator species.

---

## Datasets

| Variable | Dataset | Resolution | Source |
|---|---|---|---|
| Sea Surface Temperature | NOAA CDR Pathfinder V5.3 | 4 km daily | `NOAA/CDR/SST_PATHFINDER/V53` |
| Chlorophyll-a | MODIS Aqua Ocean Color L3 SMI | 4 km daily | `NASA/OCEANDATA/MODIS-Aqua/L3SMI` |
| Bathymetry | ETOPO1 Global Relief Model | ~1.8 km static | `NOAA/NGDC/ETOPO1` |

All temporal composites represent annual medians for the year 2020.

---

## Methods

### 1. Variable Processing

**SST** — Daily Pathfinder imagery filtered to the SCB, cloud-screened, and scaled from raw integer format (`× 0.01`) to degrees Celsius. Annual median composite.

**Chlorophyll-a** — MODIS Aqua L3 daily imagery, annual median composite. Log₁₀ transformation applied for visualization due to log-normal distribution of ocean color data.

**Bathymetry** — ETOPO1 bedrock elevation band. Ocean pixels isolated via zero-contour mask (`elevation < 0`). Continental shelf constrained to -10m to -1000m depth range, excluding surf zone and abyssal pixels.

### 2. Suitability Normalization

Each variable is independently normalized to a 0–1 suitability score using linear ramp functions anchored to biologically meaningful thresholds:

| Variable | Unsuitable (→ 0) | Optimal (→ 1) |
|---|---|---|
| SST | < 10°C or > 22°C | 14–18°C |
| Chlorophyll-a | < 0.3 mg/m³ | 1–5 mg/m³ |
| Depth | > -10m or < -1000m | -50 to -200m |

### 3. Composite Index

Variables are combined multiplicatively:

```
Habitat_Suitability = SST_suit × CHL_suit × BATHY_suit
```

Multiplicative combination requires all three conditions to be simultaneously satisfied. A pixel scoring zero on any single variable scores zero in the composite — appropriate for predator habitat modeling where thermal, productivity, and depth constraints are non-compensatory.

Observed index range: 0–0.22 (expected compression from multiplicative method).

This index is intended as an exploratory, rule-based habitat suitability surface 
for hypothesis generation. Thresholds reflect published thermal and depth 
preferences for SCB predator species and should be validated against occurrence 
or telemetry data before scientific application.

---

## Application Features

- **Layer toggles** — Independent checkbox control for SST, Chlorophyll-a, Bathymetry, and Habitat Suitability Index
- **Click-to-inspect** — Click any ocean pixel to return SST (°C), Chl-a (mg/m³), depth (m), and suitability score
- **Export-ready** — GeoTIFF export tasks registered for both the suitability index and full multi-band stack (EPSG:4326, 4km resolution)

---

## Repository Structure

```
/
├── SCB_HabitatSuitability.js    # Main GEE script
└── README.md
```

The exported GeoTIFF outputs (`SCB_HabitatSuitability_2020.tif`, `SCB_MultivarStack_2020.tif`) are compatible with ArcGIS Pro, QGIS, and R's `terra` package for downstream multivariate analysis.

---

## Usage

1. Open [Google Earth Engine Code Editor](https://code.earthengine.google.com)
2. Copy the contents of `SCB_HabitatSuitability.js` into a new script
3. Click **Run**
4. Use the left panel to toggle layers and inspect pixel values
5. To export: open the **Tasks** tab (top right) and click **Run** on either export task

---

## Author

**Morgan R. Youngblood**
B.S. Marine Science — University of Hawaiʻi at Hilo
[github.com/sci-youngblood](https://github.com/sci-youngblood) · [LinkedIn](https://www.linkedin.com/in/morgan-youngblood-b82a511a3/)

*Related work: [CINMS Acoustic Telemetry Analysis](https://github.com/sci-youngblood/WCO_Tag_Analysis) · [Climate Modeling — California Current](https://github.com/sci-youngblood/thesis)*
