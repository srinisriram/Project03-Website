# Methodology

How the values shown in the visualization were produced. The data was processed offline in Python; the website only loads the resulting static files in `data/`.

## Dataset

- **Source:** NOAA Public CMIP6 dataset (Google Cloud), accessed as Zarr stores through the public CMIP6 catalog.
- **Variable:** `tas`, monthly mean near-surface air temperature (Kelvin), table `Amon`.
- **Experiments:** `historical` (for the baseline), `ssp245` and `ssp585` (2015–2100).

## Models

Five CMIP6 models with equal weight: ACCESS-CM2, CanESM5, GFDL-ESM4, MIROC6 and MRI-ESM2-0. Each model contributes one simulation (`r1i1p1f1`), and the same run is used in all three experiments.

## Historical baseline

1981–2010. Each model's warming is measured against **its own** 1981–2010 average, not an observed climate. Models disagree on absolute temperature by up to about 6 °C in some states, so comparing changes is more meaningful than comparing raw temperatures.

## Geographic processing

1. Monthly values are averaged into annual means, weighting each month by its number of days in that model's calendar.
2. Each model's grid (roughly 1°–2.8°) is bilinearly interpolated to a common 0.25° grid. This lets every state be sampled consistently, but it does not add detail beyond the original model resolution.
3. State averages use the 0.25° cells whose centres fall inside each state boundary (Natural Earth), weighted by cell area (cosine of latitude).
4. The 48 contiguous states are included. Alaska, Hawaii and DC are excluded.

## Future projections

- **Scenarios:** SSP2-4.5 (intermediate emissions) and SSP5-8.5 (very high emissions).
- **Periods (20-year averages):** 2021–2040 (near term), 2041–2060 (mid-century) and 2081–2100 (end of century).

## Statistical summaries

For every state, scenario and period:

- **Warming:** each model's 20-year average minus that model's 1981–2010 baseline, in °C.
- **Five-model median:** the value used for the map colours.
- **Model spread:** the lowest and highest of the five models (min–max), shown in the tooltip and detail panel.
- **Scenario difference:** SSP5-8.5 minus SSP2-4.5, computed for each model first and then summarised with the median and min–max.

The map uses one fixed colour scale (1–7 °C) for every scenario and period, so the same colour always means the same amount of warming.

## Limitations

- **Small ensemble:** five models with one run each. The min–max range is model spread, not a confidence interval or probability range, and the five models do not cover the full range of CMIP6 results.
- **Median depends on few models:** with five models, the median is simply the middle model's value in each state. For example, on the end-of-century SSP5-8.5 map it comes from MIROC6 in 38 states and MRI-ESM2-0 in the other 10.
- **Model disagreement:** models agree that every state warms but disagree on how much, by up to about 5 °C by the end of the century under SSP5-8.5. Disagreement is largest where warming is largest.
- **Natural variability:** with one run per model, small differences reflect year-to-year variability. In 2021–2040 the two scenarios differ by only a few tenths of a degree, and in every state at least one model has SSP2-4.5 slightly warmer than SSP5-8.5.
- **Not forecasts:** SSP2-4.5 and SSP5-8.5 are "what-if" emissions pathways with no assigned likelihood. The values are scenario-dependent projections, not deterministic predictions.
- **Coarse resolution:** small states (e.g. Rhode Island, Delaware) are covered by only part of one model grid cell, so their values reflect the surrounding region. Coastal values include some over-water temperature.
- **Annual averages only:** seasonal changes and extremes are not shown.
