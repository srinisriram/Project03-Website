import { SCENARIOS, PERIODS, key, fmt1, fmt2, ordinal } from './scales.js';
import { createMap } from './map.js';
import { createLegend } from './legend.js';

const [geo, data] = await Promise.all([
  d3.json('data/us_states.geojson'),
  d3.json('data/state_warming.json'),
]);

const states = data.states;
const byName = new Map(states.map(s => [s.name, s]));

// Every geometry needs a value and every value needs a geometry.
const geoNames = new Set(geo.features.map(f => f.properties.name));
const unmatched = [...geoNames].filter(n => !byName.has(n)).concat(states.map(s => s.name).filter(n => !geoNames.has(n)));
if (unmatched.length) console.error('Unmatched states:', unmatched);

// ---- view state: the single source of truth every component renders from ----
const view = { scenario: 'ssp585', period: '2081-2100', hovered: null, labels: true };

// Rank of each state (1 = most warming) for the current scenario and period.
const rankCache = new Map();
function ranks(k) {
  if (!rankCache.has(k)) {
    const order = d3.sort(states, s => -s.values[k].median);
    rankCache.set(k, new Map(order.map((s, i) => [s.name, i + 1])));
  }
  return rankCache.get(k);
}

// ---- components ----
const tooltip = d3.select('#tooltip');
const map = createMap('#map', geo, {
  hover: (name, cx, cy) => {
    if (view.hovered !== name) set({ hovered: name });
    showStateTooltip(name, cx, cy);
  },
  leave: () => { set({ hovered: null }); hideTooltip(); },
});
const legend = createLegend('#legend');

// Segmented buttons for scenario and period.
function buttons(selector, options, field) {
  return d3.select(selector).selectAll('button')
    .data(Object.entries(options))
    .join('button')
      .attr('type', 'button')
      .html(([, o]) => o.html)
      .on('click', (event, [value]) => set({ [field]: value }));
}
const scenarioButtons = buttons('#scenario-buttons', Object.fromEntries(Object.entries(SCENARIOS).map(([k, s]) =>
  [k, { html: `<span class="swatch" style="background:${s.color}"></span>${s.long}` }])), 'scenario');
const periodButtons = buttons('#period-buttons', Object.fromEntries(Object.entries(PERIODS).map(([k, p]) =>
  [k, { html: `${p.label} <span class="muted">${p.note}</span>` }])), 'period');
d3.select('#labels-toggle').on('change', event => set({ labels: event.target.checked }));

// ---- tooltip ----
function showTooltip(html, cx, cy) {
  tooltip.html(html).attr('hidden', null);
  const node = tooltip.node();
  const { width, height } = node.getBoundingClientRect();
  const left = cx + 16 + width > window.innerWidth - 8 ? cx - 16 - width : cx + 16;
  const top = Math.min(cy + 16, window.innerHeight - height - 8);
  tooltip.style('left', `${Math.max(8, left)}px`).style('top', `${Math.max(8, top)}px`);
}
function hideTooltip() { tooltip.attr('hidden', true); }

function showStateTooltip(name, cx, cy) {
  const s = byName.get(name);
  const k = key(view.scenario, view.period);
  const v = s.values[k];
  const g = s.gaps[view.period];
  const rank = ranks(k).get(name);
  const signNote = g.min < 0
    ? '<div class="muted">Models split on which scenario is warmer.</div>'
    : '';
  showTooltip(`
    <div class="tt-head"><strong>${name}</strong><span class="muted">${SCENARIOS[view.scenario].short} · ${PERIODS[view.period].label}</span></div>
    <div class="tt-value">${fmt2(v.median)} °C</div>
    <div class="muted">median of 5 models</div>
    <dl>
      <dt>Model range</dt><dd>${fmt1(v.min)} to ${fmt1(v.max)} °C</dd>
      <dt>Rank</dt><dd>${ordinal(rank)} highest of 48</dd>
      <dt>${SCENARIOS.ssp585.short} − ${SCENARIOS.ssp245.short}</dt><dd>${fmt2(g.median)} °C (models ${fmt1(g.min)} to ${fmt1(g.max)})</dd>
    </dl>
    ${signNote}`, cx, cy);
}

// One-sentence takeaway for the current view, built from the data: the range across states,
// the three states that warm most and the one that warms least.
function takeaway(k) {
  const order = d3.sort(states, s => -s.values[k].median);
  const lo = order.at(-1), hi = order[0];
  const top = order.slice(0, 3).map(s => s.name);
  const every = lo.values[k].median > 0 ? 'every state warms ' : 'states change ';
  return `${SCENARIOS[view.scenario].long}, ${PERIODS[view.period].label}: ${every}${fmt1(lo.values[k].median)} to ${fmt1(hi.values[k].median)} °C ` +
    `relative to 1981–2010, most in ${top[0]}, ${top[1]} and ${top[2]} and least in ${lo.name}.`;
}

// ---- render ----
function set(patch) {
  Object.assign(view, patch);
  render();
}

function render() {
  d3.select('#subtitle').text(takeaway(key(view.scenario, view.period)));
  scenarioButtons.attr('aria-pressed', ([v]) => v === view.scenario).classed('is-active', ([v]) => v === view.scenario);
  periodButtons.attr('aria-pressed', ([v]) => v === view.period).classed('is-active', ([v]) => v === view.period);

  map.update(view, byName);
  legend.update(view, states);

}

render();
