import * as d3 from 'd3';
import { execFileSync } from 'node:child_process';
import { JSDOM } from 'jsdom';
import sharp from 'sharp';

type DayDatum = {
  date: Date;
  count: number;
  inYear: boolean;
};

const usage = (): string => {
  return [
    'Usage:',
    '  npm start -- <repoPath> <year> [outputPng]',
    '',
    'Example:',
    '  npm start -- /path/to/repo 2024 contributions-2024.png',
  ].join('\n');
};

const isValidYear = (year: number): boolean => {
  return Number.isInteger(year) && year >= 1970 && year <= 2100;
};

const parseGitContributionCounts = (
  repoPath: string,
  year: number
): Map<string, number> => {
  const since = `${year}-01-01`;
  const until = `${year}-12-31`;

  const output = execFileSync(
    'git',
    [
      '-C',
      repoPath,
      'log',
      '--no-merges',
      '--date=short',
      '--pretty=%ad',
      '--since',
      since,
      '--until',
      until,
    ],
    {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  const counts = new Map<string, number>();

  for (const line of output.split(/\r?\n/)) {
    const date = line.trim();
    if (!date) continue;
    counts.set(date, (counts.get(date) ?? 0) + 1);
  }

  return counts;
};

const main = async (): Promise<void> => {
  const repoPath = process.argv[2];
  const yearStr = process.argv[3];
  const outPath = process.argv[4] ?? 'graph.png';

  if (!repoPath || !yearStr) {
    console.error(usage());
    process.exitCode = 1;
    return;
  }

  const year = Number(yearStr);
  if (!isValidYear(year)) {
    console.error(`Invalid year: ${yearStr}`);
    console.error(usage());
    process.exitCode = 1;
    return;
  }

  const cellSize = 12;
  const cellGap = 3;
  const step = cellSize + cellGap;

  const margin = {
    top: 60,
    right: 24,
    bottom: 24,
    left: 52,
  };

  const countsByDate = parseGitContributionCounts(repoPath, year);

  const yearStart = d3.timeDay.floor(new Date(year, 0, 1));
  const yearEnd = d3.timeDay.floor(new Date(year + 1, 0, 1));

  const start = d3.timeSunday.floor(yearStart);
  const end = d3.timeSunday.ceil(yearEnd);

  const days: DayDatum[] = d3.timeDay.range(start, end).map((date: Date) => {
    const inYear = date >= yearStart && date < yearEnd;
    const key = d3.timeFormat('%Y-%m-%d')(date);
    const count = inYear ? (countsByDate.get(key) ?? 0) : 0;
    return { date, count, inYear };
  });

  const weeks = d3.timeSunday.range(start, end);

  const width = margin.left + weeks.length * step + margin.right;
  const height = margin.top + 7 * step + margin.bottom;

  const color = d3
    .scaleThreshold<number, string>()
    .domain([1, 4, 7, 11, 16])
    .range(['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39', '#134a22']);

  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  const document = dom.window.document;

  const svg = d3
    .select(document.body)
    .append('svg')
    .attr('xmlns', 'http://www.w3.org/2000/svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('background', '#ffffff');

  svg
    .append('rect')
    .attr('x', 0)
    .attr('y', 0)
    .attr('width', width)
    .attr('height', height)
    .attr('fill', '#ffffff');

  svg
    .append('text')
    .attr('x', margin.left)
    .attr('y', 34)
    .attr('fill', '#0f172a')
    .attr(
      'font-family',
      'system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
    )
    .attr('font-size', 18)
    .attr('font-weight', 700)
    .text('GitHub-style Contributions');

  svg
    .append('text')
    .attr('x', margin.left)
    .attr('y', 54)
    .attr('fill', '#475569')
    .attr(
      'font-family',
      'system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
    )
    .attr('font-size', 12)
    .attr('font-weight', 500)
    .text(String(year));

  const grid = svg
    .append('g')
    .attr('transform', `translate(${margin.left}, ${margin.top})`);

  const weekdayLabels = [
    { label: 'Mon', day: 1 },
    { label: 'Wed', day: 3 },
    { label: 'Fri', day: 5 },
  ];

  grid
    .append('g')
    .selectAll('text')
    .data(weekdayLabels)
    .join('text')
    .attr('x', -10)
    .attr('y', d => d.day * step + cellSize - 2)
    .attr('text-anchor', 'end')
    .attr('fill', '#64748b')
    .attr(
      'font-family',
      'system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
    )
    .attr('font-size', 10)
    .text(d => d.label);

  const monthStarts = d3.timeMonth
    .range(d3.timeMonth.floor(start), end)
    .filter(d => d >= yearStart && d < yearEnd);

  grid
    .append('g')
    .selectAll('text')
    .data(monthStarts)
    .join('text')
    .attr('x', d => d3.timeSunday.count(start, d3.timeSunday.floor(d)) * step)
    .attr('y', -10)
    .attr('fill', '#64748b')
    .attr(
      'font-family',
      'system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
    )
    .attr('font-size', 10)
    .text(d => d3.timeFormat('%b')(d));

  grid
    .append('g')
    .selectAll('rect')
    .data(days)
    .join('rect')
    .attr('width', cellSize)
    .attr('height', cellSize)
    .attr('rx', 2)
    .attr('ry', 2)
    .attr('x', (d: DayDatum) => d3.timeSunday.count(start, d.date) * step)
    .attr('y', (d: DayDatum) => d.date.getDay() * step)
    .attr('fill', (d: DayDatum) => (d.inYear ? color(d.count) : '#ffffff'))
    .attr('stroke', (d: DayDatum) => (d.inYear ? '#e2e8f0' : 'none'))
    .attr('stroke-width', (d: DayDatum) => (d.inYear ? 1 : 0));

  const legend = svg
    .append('g')
    .attr(
      'transform',
      `translate(${margin.left}, ${margin.top + 7 * step + 14})`
    );

  legend
    .append('text')
    .attr('x', 0)
    .attr('y', 10)
    .attr('fill', '#64748b')
    .attr(
      'font-family',
      'system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
    )
    .attr('font-size', 10)
    .text('Less');

  const legendColors = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'];

  legend
    .append('g')
    .attr('transform', 'translate(28, 0)')
    .selectAll('rect')
    .data(legendColors)
    .join('rect')
    .attr('x', (_d, i) => i * step)
    .attr('y', 0)
    .attr('width', cellSize)
    .attr('height', cellSize)
    .attr('rx', 2)
    .attr('ry', 2)
    .attr('fill', d => d)
    .attr('stroke', '#e2e8f0')
    .attr('stroke-width', 1);

  legend
    .append('text')
    .attr('x', 28 + legendColors.length * step + 6)
    .attr('y', 10)
    .attr('fill', '#64748b')
    .attr(
      'font-family',
      'system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
    )
    .attr('font-size', 10)
    .text('More');

  const svgString = document.body.innerHTML;

  await sharp(Buffer.from(svgString))
    .flatten({ background: '#ffffff' })
    .png({ quality: 100 })
    .toFile(outPath);

  console.log(`Wrote ${outPath}`);
};

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
