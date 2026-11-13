// Shared encodings and labels, so the map, legend and tooltip always agree.

export const SCENARIOS = {
  ssp245: { short: 'SSP2-4.5', long: 'SSP2-4.5 (intermediate emissions)', color: '#2a78d6' },
  ssp585: { short: 'SSP5-8.5', long: 'SSP5-8.5 (very high emissions)', color: '#eb6834' },
};

export const PERIODS = {
  '2021-2040': { label: '2021–2040', note: 'near term' },
  '2041-2060': { label: '2041–2060', note: 'mid-century' },
  '2081-2100': { label: '2081–2100', note: 'end of century' },
};

// One fixed domain for every scenario and period, so a colour always means the same warming.
// State medians span 1.33–6.72 °C across all six views.
// Reversed Inferno (light yellow -> orange -> red -> dark purple): lightness falls steadily with
// warming and the hue also shifts. Values 0.5 °C apart differ by at least 9.6 CIELAB dE across the
// whole domain, vs. 6.9 for YlOrRd and 6.1 for the single-hue Oranges used at the checkpoint.
export const COLOR_DOMAIN = [1, 7];
export const color = d3.scaleSequential()
  .domain(COLOR_DOMAIN)
  .interpolator(t => d3.interpolateInferno(0.97 - 0.8 * t))
  .clamp(true);

// Dark text on light fills, white text on dark fills.
export const labelInk = value => d3.lab(color(value)).l < 55 ? '#ffffff' : '#0b0b0b';

export const fmt1 = d3.format('+.1f');
export const fmt2 = d3.format('+.2f');
export const key = (scenario, period) => `${scenario}/${period}`;

export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
