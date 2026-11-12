import { SCENARIOS, PERIODS, key, fmt1, fmt2, ordinal } from './scales.js';
import { createMap } from './map.js';
import { createLegend } from './legend.js';
import { createDetail, drawDetailLegend } from './detail.js';

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
const view = { scenario: 'ssp585', period: '2081-2100', selected: 'Minnesota', hovered: null, labels: true };

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
  select: name => set({ selected: name }),
});
const legend = createLegend('#legend');
const detail = createDetail('#detail-chart', data.meta.models, {
  pick: (scenario, period) => set({ scenario, period }),
  hoverModel: (d, cx, cy) => showTooltip(
    `<strong>${d.model}</strong><div>${fmt2(d.value)} °C</div>` +
    `<div class="muted">${SCENARIOS[d.row.scenario].short} · ${PERIODS[d.row.period].label} · ${view.selected}</div>`, cx, cy),
  leaveModel: hideTooltip,
});
drawDetailLegend('#detail-legend', data.meta.models);

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
    ? '<div class="muted">Models disagree on which scenario is warmer in this period, so the difference is within natural variability.</div>'
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
    ${signNote}
    <div class="tt-hint">${view.selected === name ? 'Shown in the detail panel' : 'Click to compare scenarios and models'}</div>`, cx, cy);
}

// ---- render ----
function set(patch) {
  const prev = { ...view };
  Object.assign(view, patch);
  render(prev);
}

function render(prev = {}) {
  const k = key(view.scenario, view.period);
  d3.select('#subtitle').text(`Projected change in annual mean near-surface air temperature, ${PERIODS[view.period].label} vs. 1981–2010, ${SCENARIOS[view.scenario].long}`);
  scenarioButtons.attr('aria-pressed', ([v]) => v === view.scenario).classed('is-active', ([v]) => v === view.scenario);
  periodButtons.attr('aria-pressed', ([v]) => v === view.period).classed('is-active', ([v]) => v === view.period);

  map.update(view, byName);
  legend.update(view, states);

  if (prev.selected !== view.selected || prev.scenario !== view.scenario || prev.period !== view.period) {
    const s = byName.get(view.selected);
    const v = s.values[k];
    const g = s.gaps[view.period];
    d3.select('#detail-title').text(s.name);
    d3.select('#detail-summary').html(
      `${SCENARIOS[view.scenario].short}, ${PERIODS[view.period].label}: <strong>${fmt1(v.median)} °C</strong> ` +
      `(models ${fmt1(v.min)} to ${fmt1(v.max)} °C), ranked ${ordinal(ranks(k).get(s.name))} of 48 states. ` +
      `${SCENARIOS.ssp585.short} minus ${SCENARIOS.ssp245.short} in this period: <strong>${fmt1(g.median)} °C</strong> ` +
      `(models ${fmt1(g.min)} to ${fmt1(g.max)} °C).`);
    detail.update(view, s);
  }
}

render();
