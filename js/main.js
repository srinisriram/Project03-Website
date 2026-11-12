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
const view = { scenario: 'ssp585', period: '2081-2100', selected: 'Minnesota', hovered: null, labels: true, highlight: null, pattern: null };

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
  pick: (scenario, period) => { stopPlay(); set({ scenario, period, highlight: null, pattern: null }); },
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
      .on('click', (event, [value]) => { stopPlay(); set({ [field]: value, highlight: null, pattern: null }); });
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

// ---- key patterns: guided entry points computed from the data ----
const med = (s, k) => s.values[k].median;
const spread = (s, k) => s.values[k].max - s.values[k].min;
const END = 'ssp585/2081-2100';
const byEnd = d3.sort(states, s => -med(s, END));
const top5 = byEnd.slice(0, 5), low5 = byEnd.slice(-5);
const bySpread = d3.sort(states, s => -spread(s, END));
const gapMed = p => d3.median(states, s => s.gaps[p].median);
const corr = (() => {
  const xs = states.map(s => med(s, END)), ys = states.map(s => spread(s, END));
  const mx = d3.mean(xs), my = d3.mean(ys);
  return d3.sum(xs, (x, i) => (x - mx) * (ys[i] - my)) / Math.sqrt(d3.sum(xs, x => (x - mx) ** 2) * d3.sum(ys, y => (y - my) ** 2));
})();
const names = arr => arr.map(s => s.name);
const list = arr => arr.map(s => s.abbrev).join(', ');
const f1 = d3.format('.1f');

const PATTERNS = [
  {
    title: 'The interior North warms most',
    sub: `${top5[0].abbrev} +${f1(med(top5[0], END))} °C vs ${low5.at(-1).abbrev} +${f1(med(low5.at(-1), END))} °C`,
    apply: () => set({ scenario: 'ssp585', period: '2081-2100', selected: top5[0].name, highlight: new Set(names([...top5, ...low5])) }),
    text: `By 2081–2100 under very high emissions, the five warmest states are all in the northern interior (${list(top5)}, +${f1(med(top5.at(-1), END))} to +${f1(med(top5[0], END))} °C), far from the ocean’s moderating effect. The five least-warming are coastal or in the Southeast (${list(low5)}, +${f1(med(low5.at(-1), END))} to +${f1(med(low5[0], END))} °C). Those ten are highlighted.`,
  },
  {
    title: 'Our choices matter after 2050',
    sub: `scenario gap: ${f1(gapMed('2021-2040'))} → ${f1(gapMed('2041-2060'))} → ${f1(gapMed('2081-2100'))} °C`,
    apply: () => playPeriods(),
    text: `Watch the periods play: the median state’s difference between very high (SSP5-8.5) and intermediate (SSP2-4.5) emissions is only ${f1(gapMed('2021-2040'))} °C in 2021–2040 and ${f1(gapMed('2041-2060'))} °C by mid-century, but ${f1(gapMed('2081-2100'))} °C by 2081–2100. Near-term warming is already locked in; end-of-century warming depends on emissions. The detail panel shows the two scenarios pulling apart for ${'${state}'}.`,
  },
  {
    title: 'Biggest warming, least certainty',
    sub: `model spread ${f1(spread(bySpread[0], END))} °C in ${bySpread[0].abbrev} vs ${f1(spread(bySpread.at(-1), END))} °C in ${bySpread.at(-1).abbrev}`,
    apply: () => set({ scenario: 'ssp585', period: '2081-2100', selected: bySpread[0].name, highlight: new Set(names(bySpread.slice(0, 5))) }),
    text: `The five models disagree most exactly where warming is largest (correlation ${d3.format('.2f')(corr)} between a state’s median warming and its model spread). In ${bySpread[0].name} the models range from +${f1(bySpread[0].values[END].min)} to +${f1(bySpread[0].values[END].max)} °C; in ${bySpread.at(-1).name} only ${f1(spread(bySpread.at(-1), END))} °C apart. Every model still shows every state warming. See the markers in the detail panel.`,
  },
  {
    title: 'High emissions arrives 50 years early',
    sub: `SSP5-8.5 by 2050 ≈ SSP2-4.5 by 2100`,
    apply: () => set({ scenario: 'ssp585', period: '2041-2060', selected: view.selected, highlight: null }),
    text: `Under very high emissions the median state warms ${f1(d3.median(states, s => med(s, 'ssp585/2041-2060')))} °C by 2041–2060, close to the ${f1(d3.median(states, s => med(s, 'ssp245/2081-2100')))} °C that intermediate emissions reach only by 2081–2100. Compare this map with SSP2-4.5 · 2081–2100: the colours are nearly the same.`,
  },
];

let playTimer = null;
function stopPlay() { if (playTimer) { clearInterval(playTimer); playTimer = null; } }
function playPeriods() {
  stopPlay();
  const seq = Object.keys(PERIODS);
  let i = 0;
  set({ scenario: 'ssp585', period: seq[0], highlight: null });
  playTimer = setInterval(() => {
    i += 1;
    if (i >= seq.length) return stopPlay();
    set({ period: seq[i] });
  }, 1600);
}

const patternCards = d3.select('#pattern-cards').selectAll('button')
  .data(PATTERNS)
  .join('button')
    .attr('type', 'button')
    .attr('class', 'pattern-card')
    .html((p, i) => `<span class="num">${i + 1}</span><span class="ttl">${p.title}</span><span class="sub">${p.sub}</span>`)
    .on('click', (event, p) => { stopPlay(); view.pattern = p; p.apply(); });
d3.select('#pattern-clear').on('click', () => { stopPlay(); set({ highlight: null, pattern: null }); });

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

  patternCards.classed('is-active', p => p === view.pattern).attr('aria-pressed', p => p === view.pattern);
  d3.select('#pattern-text').text(view.pattern ? view.pattern.text.replace('${state}', view.selected) : 'Pick a pattern above, or explore on your own with the buttons below.');
  d3.select('#pattern-clear').attr('hidden', view.highlight ? null : true);

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
