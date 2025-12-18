import * as d3 from 'd3';
import { JSDOM } from 'jsdom';
import sharp from 'sharp';

type NodeDatum = {
  id: string;
  group: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
};

type LinkDatum = d3.SimulationLinkDatum<NodeDatum> & {
  source: string | NodeDatum;
  target: string | NodeDatum;
  value: number;
};

const main = async (): Promise<void> => {
  const outPath = process.argv[2] ?? 'graph.png';

  const width = 900;
  const height = 500;

  const nodes: NodeDatum[] = [
    { id: 'You', group: 1 },
    { id: 'D3', group: 2 },
    { id: 'jsdom', group: 2 },
    { id: 'sharp', group: 2 },
    { id: 'PNG', group: 3 },
    { id: 'SVG', group: 3 },
  ];

  const links: LinkDatum[] = [
    { source: 'You', target: 'D3', value: 2 },
    { source: 'D3', target: 'SVG', value: 3 },
    { source: 'jsdom', target: 'SVG', value: 2 },
    { source: 'SVG', target: 'sharp', value: 2 },
    { source: 'sharp', target: 'PNG', value: 3 },
    { source: 'You', target: 'jsdom', value: 1 },
  ];

  const simulation = d3
    .forceSimulation<NodeDatum>(nodes)
    .force(
      'link',
      d3
        .forceLink<NodeDatum, LinkDatum>(links)
        .id((d: NodeDatum) => d.id)
        .distance((d: LinkDatum) => 70 + 25 * d.value)
        .strength(0.6)
    )
    .force('charge', d3.forceManyBody().strength(-420))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide<NodeDatum>().radius(26))
    .stop();

  simulation.tick(300);

  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  const document = dom.window.document;

  const svg = d3
    .select(document.body)
    .append('svg')
    .attr('xmlns', 'http://www.w3.org/2000/svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('background', '#0b1020');

  const defs = svg.append('defs');
  defs
    .append('marker')
    .attr('id', 'arrow')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 18)
    .attr('refY', 0)
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-5L10,0L0,5')
    .attr('fill', '#94a3b8');

  svg
    .append('text')
    .attr('x', 24)
    .attr('y', 42)
    .attr('fill', '#e2e8f0')
    .attr(
      'font-family',
      'system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
    )
    .attr('font-size', 22)
    .attr('font-weight', 700)
    .text('D3 Graph Rendered to PNG (Node)');

  const g = svg.append('g').attr('transform', 'translate(0, 10)');

  g.append('g')
    .attr('stroke', '#94a3b8')
    .attr('stroke-opacity', 0.75)
    .selectAll('line')
    .data(links)
    .join('line')
    .attr('x1', (d: LinkDatum) => (d.source as NodeDatum).x ?? 0)
    .attr('y1', (d: LinkDatum) => (d.source as NodeDatum).y ?? 0)
    .attr('x2', (d: LinkDatum) => (d.target as NodeDatum).x ?? 0)
    .attr('y2', (d: LinkDatum) => (d.target as NodeDatum).y ?? 0)
    .attr('stroke-width', (d: LinkDatum) => Math.max(1, d.value))
    .attr('marker-end', 'url(#arrow)');

  const node = g
    .append('g')
    .selectAll('g')
    .data(nodes)
    .join('g')
    .attr(
      'transform',
      (d: NodeDatum) => `translate(${d.x ?? width / 2}, ${d.y ?? height / 2})`
    );

  node
    .append('circle')
    .attr('r', (d: NodeDatum) => (d.id === 'You' ? 22 : 18))
    .attr('fill', (d: NodeDatum) => {
      if (d.group === 1) return '#22c55e';
      if (d.group === 2) return '#60a5fa';
      return '#f59e0b';
    })
    .attr('stroke', '#0f172a')
    .attr('stroke-width', 3);

  node
    .append('text')
    .attr('text-anchor', 'middle')
    .attr('dy', 5)
    .attr('fill', '#0b1020')
    .attr(
      'font-family',
      'system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
    )
    .attr('font-size', 12)
    .attr('font-weight', 800)
    .text((d: NodeDatum) => d.id);

  const svgString = document.body.innerHTML;

  await sharp(Buffer.from(svgString)).png({ quality: 100 }).toFile(outPath);

  console.log(`Wrote ${outPath}`);
};

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
