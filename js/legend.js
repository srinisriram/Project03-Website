// Colour legend: continuous bar on the fixed 1–7 °C scale, a tick for every state's current value,
// and a marker for the hovered state.
import { color, COLOR_DOMAIN, key, fmt1 } from './scales.js';

const WIDTH = 560;
const HEIGHT = 74;
const M = { left: 14, right: 30 };
const BAR_Y = 40;
const BAR_H = 12;

export function createLegend(container) {
  const x = d3.scaleLinear().domain(COLOR_DOMAIN).range([M.left, WIDTH - M.right]);
  const svg = d3.select(container).append('svg')
    .attr('viewBox', `0 0 ${WIDTH} ${HEIGHT}`)
    .attr('role', 'img')
    .attr('aria-label', `Colour legend: projected warming from ${COLOR_DOMAIN[0]} to ${COLOR_DOMAIN[1]} °C`);

  const gradient = svg.append('defs').append('linearGradient').attr('id', 'legend-gradient');
  gradient.selectAll('stop')
    .data(d3.ticks(...COLOR_DOMAIN, 30))
    .join('stop')
      .attr('offset', v => (v - COLOR_DOMAIN[0]) / (COLOR_DOMAIN[1] - COLOR_DOMAIN[0]))
      .attr('stop-color', v => color(v));

  svg.append('text').attr('class', 'legend-title').attr('x', M.left).attr('y', 13)
    .text('Projected warming (°C), median of 5 models · same scale for every view');

  const rug = svg.append('g').attr('class', 'rug');
  svg.append('rect')
    .attr('x', x.range()[0]).attr('y', BAR_Y)
    .attr('width', x.range()[1] - x.range()[0]).attr('height', BAR_H)
    .attr('fill', 'url(#legend-gradient)');
  svg.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${BAR_Y + BAR_H})`)
    .call(d3.axisBottom(x).ticks(6).tickFormat(d => `${d}°`).tickSize(4))
    .call(g => g.select('.domain').remove());

  const marker = svg.append('g').attr('class', 'legend-marker').style('display', 'none');
  marker.append('path').attr('d', 'M-5,-11 L5,-11 L0,-2 Z');
  marker.append('text').attr('y', -14);

  function update(view, states) {
    const k = key(view.scenario, view.period);
    rug.selectAll('line')
      .data(states, s => s.name)
      .join('line')
        .attr('y1', BAR_Y - 9).attr('y2', BAR_Y - 2)
        .attr('x1', s => x(s.values[k].median)).attr('x2', s => x(s.values[k].median));

    const focus = states.find(s => s.name === view.hovered);
    marker.style('display', focus ? null : 'none');
    if (focus) {
      const v = focus.values[k].median;
      const mx = x(Math.max(COLOR_DOMAIN[0], Math.min(COLOR_DOMAIN[1], v)));
      marker.attr('transform', `translate(${mx},${BAR_Y})`);
      marker.select('text')
        .attr('text-anchor', mx > WIDTH - 90 ? 'end' : mx < 90 ? 'start' : 'middle')
        .text(`${focus.abbrev} ${fmt1(v)} °C`);
    }
    rug.lower();
  }

  return { update };
}
