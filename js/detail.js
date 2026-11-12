// Linked detail chart for one state: every period x scenario, with each model's value, the
// inter-model range, and the median. The row shown on the map is highlighted; clicking a row
// switches the map to that scenario and period.
import { SCENARIOS, PERIODS, MODEL_SYMBOLS, key, fmt1 } from './scales.js';

// Matches the panel's content width on desktop, so text renders at its CSS size.
const WIDTH = 368;
const M = { top: 6, right: 40, bottom: 40, left: 78 };
const LANE = 28;
const HEADER = 18;
const GROUP_GAP = 12;
// Fixed axis for every state (largest single-model value is 10.6 °C), so states compare directly.
const X_MAX = 11;

export function createDetail(container, models, handlers) {
  const rows = [];
  let y = M.top;
  for (const period of Object.keys(PERIODS)) {
    y += HEADER;
    for (const scenario of Object.keys(SCENARIOS)) {
      rows.push({ period, scenario, y: y + LANE / 2, header: rows.length % 2 === 0 ? y - 6 : null });
      y += LANE;
    }
    y += GROUP_GAP;
  }
  const height = y - GROUP_GAP + M.bottom;
  const x = d3.scaleLinear().domain([0, X_MAX]).range([M.left, WIDTH - M.right]);

  const svg = d3.select(container).append('svg')
    .attr('viewBox', `0 0 ${WIDTH} ${height}`)
    .attr('role', 'img');

  svg.append('g')
    .attr('class', 'grid')
    .attr('transform', `translate(0,${height - M.bottom})`)
    .call(d3.axisBottom(x).ticks(6).tickSize(-(height - M.bottom - M.top)).tickFormat(''))
    .call(g => g.select('.domain').remove());
  svg.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${height - M.bottom})`)
    .call(d3.axisBottom(x).ticks(6).tickFormat(d => `${d}°`))
    .call(g => g.select('.domain').remove());
  svg.append('text').attr('class', 'axis-title')
    .attr('x', x(X_MAX / 2)).attr('y', height - 6).attr('text-anchor', 'middle')
    .text('Projected warming vs. 1981–2010 (°C)');

  const row = svg.append('g').selectAll('g.row')
    .data(rows)
    .join('g')
      .attr('class', 'row')
      .attr('transform', r => `translate(0,${r.y})`)
      .on('click', (event, r) => handlers.pick(r.scenario, r.period));

  row.append('rect').attr('class', 'row-bg')
    .attr('x', 0).attr('y', -LANE / 2).attr('width', WIDTH).attr('height', LANE);
  row.filter(r => r.header !== null).append('text')
    .attr('class', 'period-label')
    .attr('x', 0).attr('y', -LANE / 2 - 5)
    .text(r => `${PERIODS[r.period].label} · ${PERIODS[r.period].note}`);
  row.append('rect').attr('class', 'swatch')
    .attr('x', 2).attr('y', -4).attr('width', 8).attr('height', 8)
    .attr('fill', r => SCENARIOS[r.scenario].color);
  row.append('text').attr('class', 'lane-label')
    .attr('x', 14).attr('dy', '0.35em')
    .text(r => SCENARIOS[r.scenario].short);
  row.append('line').attr('class', 'range')
    .attr('stroke', r => SCENARIOS[r.scenario].color);
  row.append('g').attr('class', 'models');
  row.append('line').attr('class', 'median')
    .attr('y1', -9).attr('y2', 9)
    .attr('stroke', r => SCENARIOS[r.scenario].color);
  row.append('text').attr('class', 'median-label').attr('dy', '0.35em');

  const symbol = d3.symbol().size(46);

  function update(view, state) {
    svg.attr('aria-label', `${state.name}: projected warming for each period and scenario`);
    row.classed('is-active', r => r.scenario === view.scenario && r.period === view.period);

    const t = svg.transition().duration(400);
    row.each(function (r) {
      const v = state.values[key(r.scenario, r.period)];
      const g = d3.select(this);
      g.select('.range').transition(t).attr('x1', x(v.min)).attr('x2', x(v.max));
      g.select('.median').transition(t).attr('x1', x(v.median)).attr('x2', x(v.median));
      // Numbers change immediately; only positions animate.
      g.select('.median-label').text(fmt1(v.median)).transition(t).attr('x', x(v.max) + 8);

      g.select('.models').selectAll('path')
        .data(v.models.map((value, i) => ({ value, i, model: models[i], row: r })), d => d.i)
        .join(enter => enter.append('path')
            .attr('class', 'model')
            .attr('d', d => symbol.type(MODEL_SYMBOLS[d.i].type)())
            .attr('transform', d => `translate(${x(d.value)},0) rotate(${MODEL_SYMBOLS[d.i].rotate})`)
            .on('pointerenter pointermove', (event, d) => handlers.hoverModel(d, event.clientX, event.clientY))
            .on('pointerleave', () => handlers.leaveModel()))
          .transition(t)
          .attr('transform', d => `translate(${x(d.value)},0) rotate(${MODEL_SYMBOLS[d.i].rotate})`);
    });
  }

  return { update };
}

// Static key for the model shapes, median tick, and range bar.
export function drawDetailLegend(container, models) {
  const items = [
    ...models.map((m, i) => ({ label: m, draw: g => g.append('path').attr('class', 'model')
      .attr('d', d3.symbol().type(MODEL_SYMBOLS[i].type).size(46)())
      .attr('transform', `translate(8,8) rotate(${MODEL_SYMBOLS[i].rotate})`) })),
    { label: 'Median', draw: g => g.append('line').attr('class', 'median key')
      .attr('x1', 8).attr('x2', 8).attr('y1', 0).attr('y2', 16) },
    { label: 'Model range', draw: g => g.append('line').attr('class', 'range key')
      .attr('x1', 1).attr('x2', 15).attr('y1', 8).attr('y2', 8) },
  ];
  const item = d3.select(container).selectAll('span.item').data(items).join('span').attr('class', 'item');
  item.append('svg').attr('width', 16).attr('height', 16).attr('aria-hidden', 'true').each(function (d) {
    d.draw(d3.select(this));
  });
  item.append('span').text(d => d.label);
}
