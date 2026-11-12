// State choropleth: fills, value labels, hover/selection highlighting, and pointer/keyboard events.
import { color, labelInk, key } from './scales.js';

const WIDTH = 960;
const HEIGHT = 590;
const MAP_RIGHT = 870;          // space to the right of New England for callout labels
const CALLOUT_X = 905;
const CALLOUT_GAP = 21;         // minimum vertical spacing between callout labels
// States too small for an inside label get a callout in the Atlantic.
const CALLOUT_STATES = ['VT', 'NH', 'MA', 'RI', 'CT', 'NJ', 'DE', 'MD'];
// Nudges (in px) where the polygon centroid is a poor spot for a label.
const NUDGE = { FL: [12, 8], MI: [10, 18], LA: [-12, -4], KY: [6, 2], ID: [0, 22], WV: [-3, 4], NY: [6, 4] };
// Below this rendered width the labels would be unreadably small, so they are hidden.
const MIN_LABEL_WIDTH = 560;

export function createMap(container, geo, handlers) {
  const projection = d3.geoAlbersUsa().fitExtent([[8, 8], [MAP_RIGHT, HEIGHT - 8]], geo);
  const path = d3.geoPath(projection);
  const root = d3.select(container);

  const svg = root.append('svg')
    .attr('viewBox', `0 0 ${WIDTH} ${HEIGHT}`)
    .attr('role', 'group')
    .attr('aria-label', 'Map of projected warming by US state');

  // Grey outline drawn under the fills, so pale states keep an edge against the page background.
  svg.append('g').attr('class', 'outline')
    .selectAll('path').data(geo.features).join('path').attr('d', path);

  const paths = svg.append('g').attr('class', 'states')
    .selectAll('path')
    .data(geo.features, d => d.properties.name)
    .join('path')
      .attr('class', 'state')
      .attr('d', path)
      .attr('data-state', d => d.properties.name)
      .attr('tabindex', 0)
      .attr('role', 'button')
      .on('pointerenter pointermove', (event, d) => handlers.hover(d.properties.name, event.clientX, event.clientY))
      .on('pointerleave', () => handlers.leave())
      .on('click', (event, d) => handlers.select(d.properties.name))
      .on('focus', function (event, d) {
        const box = this.getBoundingClientRect();
        handlers.hover(d.properties.name, box.x + box.width / 2, box.y + box.height / 2);
      })
      .on('blur', () => handlers.leave())
      .on('keydown', (event, d) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handlers.select(d.properties.name);
        }
      });

  // Selected/hovered outlines live in their own layer: a white halo under a dark line stays
  // visible on both the palest and the darkest fills.
  const highlight = svg.append('g').attr('class', 'highlight').attr('aria-hidden', 'true');
  const featureByName = new Map(geo.features.map(f => [f.properties.name, f]));

  // ---- label positions: inside the state, or a callout to the right ----
  const anchors = geo.features.map(d => {
    const abbrev = d.properties.abbrev;
    const [cx, cy] = path.centroid(d);
    const [dx, dy] = NUDGE[abbrev] || [0, 0];
    return { name: d.properties.name, abbrev, x: cx + dx, y: cy + dy, callout: CALLOUT_STATES.includes(abbrev) };
  });
  const callouts = anchors.filter(a => a.callout).sort((a, b) => a.y - b.y);
  callouts.forEach((a, i) => {
    a.ly = i === 0 ? a.y - 10 : Math.max(a.y, callouts[i - 1].ly + CALLOUT_GAP);
  });

  const labelLayer = svg.append('g').attr('class', 'labels').attr('aria-hidden', 'true');
  const inside = labelLayer.selectAll('g.inside')
    .data(anchors.filter(a => !a.callout), a => a.name)
    .join('g')
      .attr('class', 'inside')
      .attr('transform', a => `translate(${a.x},${a.y})`);
  inside.append('text').attr('class', 'abbrev').attr('y', -3).text(a => a.abbrev);
  inside.append('text').attr('class', 'value').attr('y', 10);

  const outside = labelLayer.selectAll('g.callout')
    .data(callouts, a => a.name)
    .join('g')
      .attr('class', 'callout');
  outside.append('line')
    .attr('x1', a => a.x).attr('y1', a => a.y)
    .attr('x2', CALLOUT_X - 4).attr('y2', a => a.ly);
  outside.append('circle').attr('cx', a => a.x).attr('cy', a => a.y).attr('r', 1.6);
  const outsideText = outside.append('text')
    .attr('x', CALLOUT_X).attr('y', a => a.ly).attr('dy', '0.35em');
  outsideText.append('tspan').attr('class', 'abbrev').text(a => `${a.abbrev} `);
  outsideText.append('tspan').attr('class', 'value');

  let lastView = null;
  let labelsFit = true;
  new ResizeObserver(([entry]) => {
    labelsFit = entry.contentRect.width >= MIN_LABEL_WIDTH;
    svg.classed('labels-hidden', !labelsFit || !lastView?.labels);
  }).observe(root.node());

  function update(view, byName) {
    const k = key(view.scenario, view.period);
    const value = name => byName.get(name).values[k].median;
    const changed = !lastView || lastView.scenario !== view.scenario || lastView.period !== view.period;

    (changed ? paths.transition().duration(450) : paths)
      .attr('fill', d => color(value(d.properties.name)));
    paths
      .attr('data-value', d => value(d.properties.name))
      .attr('aria-label', d => `${d.properties.name}: ${d3.format('+.1f')(value(d.properties.name))} °C`)
      .attr('aria-pressed', d => d.properties.name === view.selected)
      .classed('is-selected', d => d.properties.name === view.selected)
      .classed('is-hovered', d => d.properties.name === view.hovered)
      .classed('is-dimmed', d => !!view.highlight && !view.highlight.has(d.properties.name));

    const marks = [{ kind: 'selected', name: view.selected }, { kind: 'hovered', name: view.hovered }]
      .filter(m => m.name && !(m.kind === 'hovered' && m.name === view.selected));
    highlight.selectAll('g')
      .data(marks, m => m.kind)
      .join(enter => {
        const g = enter.append('g').attr('class', m => m.kind);
        g.append('path').attr('class', 'halo');
        g.append('path').attr('class', 'line');
        return g;
      })
      .each(function (m) {
        d3.select(this).selectAll('path').attr('d', path(featureByName.get(m.name)));
      });

    inside.select('.value').text(a => d3.format('.1f')(value(a.name)));
    inside.selectAll('text').attr('fill', a => labelInk(value(a.name)));
    outside.select('.value').text(a => d3.format('.1f')(value(a.name)));
    labelLayer.selectAll('g').classed('is-active', a => a.name === view.hovered || a.name === view.selected)
      .classed('is-dimmed', a => !!view.highlight && !view.highlight.has(a.name));

    svg.classed('labels-hidden', !labelsFit || !view.labels);
    lastView = view;
  }

  return { update, svg, paths };
}
