#!/usr/bin/env node
// Generates the dotted "Progress" commit chart (light + dark SVG) from live GitHub data.
//
//   GH_USER            GitHub login to chart (default: GITHUB_REPOSITORY_OWNER)
//   GH_TOKEN           token for the GraphQL API (default: GITHUB_TOKEN)
//   OUT_DIR            output folder (default: assets)
//   PROGRESS_FIXTURE   optional JSON file {"YYYY-MM-DD": commits} to render without the API
//
// Counts are commits per UTC day over the last 56 days. A token that can see private
// repositories (a personal access token) also counts private commits.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const DAYS = 56;
const ROWS = 14;
const DOT = 11;
const PITCH = 16;
const W = 1000;

const user = process.env.GH_USER || process.env.GITHUB_REPOSITORY_OWNER || 'HighRadiation';
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const outDir = process.env.OUT_DIR || 'assets';
const fixturePath = process.env.PROGRESS_FIXTURE;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayKey = (d) => d.toISOString().slice(0, 10);
const label = (d) => `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));

const now = new Date();
const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
const days = Array.from({ length: DAYS }, (_, i) => new Date(today.getTime() - (DAYS - 1 - i) * 86400000));

async function fetchCounts() {
  if (fixturePath) return JSON.parse(await readFile(fixturePath, 'utf8'));
  if (!token) throw new Error('GH_TOKEN / GITHUB_TOKEN is not set');

  const query = `query($login:String!,$from:DateTime!){
    user(login:$login){
      contributionsCollection(from:$from){
        commitContributionsByRepository(maxRepositories:100){
          contributions(first:100){ nodes{ commitCount occurredAt } }
        }
      }
    }
  }`;
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'progress-chart' },
    body: JSON.stringify({ query, variables: { login: user, from: days[0].toISOString() } }),
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors) throw new Error(`GitHub API error: ${JSON.stringify(json.errors)}`);
  if (!json.data?.user) throw new Error(`User not found: ${user}`);

  const counts = {};
  for (const repo of json.data.user.contributionsCollection.commitContributionsByRepository) {
    for (const n of repo.contributions.nodes) {
      const k = n.occurredAt.slice(0, 10);
      counts[k] = (counts[k] || 0) + n.commitCount;
    }
  }
  return counts;
}

const THEMES = {
  light: { bg: '#ffffff', border: '#e4e4e7', text: '#18181b', muted: '#71717a', empty: '#ececee', fill: '#2542f4', chip: '#e4e4e7' },
  dark: { bg: '#0d1117', border: '#30363d', text: '#e6edf3', muted: '#8b949e', empty: '#1c2128', fill: '#5b7cff', chip: '#30363d' },
};

function render(theme, series, scale) {
  const c = THEMES[theme];
  const total = series.reduce((s, d) => s + d.count, 0);
  const plotX = 72;
  const plotTop = 96;
  const H = plotTop + (ROWS - 1) * PITCH + DOT + 52;
  const rowY = (r) => plotTop + (ROWS - 1 - r) * PITCH;
  const colX = (i) => plotX + i * PITCH;

  // header chips, laid out right to left
  const chipH = 36;
  const chipY = 18;
  const defs = [
    { text: 'Commits', kind: 'swatch', color: c.fill, gap: 12 },
    { text: 'Capacity', kind: 'swatch', color: c.empty, gap: 24 },
    { text: 'Total', kind: 'menu', gap: 12 },
    { text: 'Daily', kind: 'menu', gap: 0 },
  ].map((d) => ({ ...d, w: 32 + Math.round(d.text.length * 8.2) + (d.kind === 'swatch' ? 20 : 18) }));
  let x = W - 32 - defs.reduce((s, d) => s + d.w + d.gap, 0);
  let chips = '';
  for (const d of defs) {
    chips += `<rect x="${x + 0.5}" y="${chipY + 0.5}" width="${d.w - 1}" height="${chipH - 1}" rx="18" fill="none" stroke="${c.chip}"/>`;
    if (d.kind === 'swatch') {
      chips += `<rect x="${x + 16}" y="${chipY + 12}" width="12" height="12" rx="3" fill="${d.color}"/>`;
      chips += `<text x="${x + 36}" y="${chipY + 23}" class="t" font-size="15">${d.text}</text>`;
    } else {
      chips += `<text x="${x + 16}" y="${chipY + 23}" class="t" font-size="15">${d.text}</text>`;
      const cx = x + d.w - 26;
      chips += `<path d="M${cx} ${chipY + 16} l4 4 l4 -4" fill="none" stroke="${c.text}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    x += d.w + d.gap;
  }

  // dots
  let dots = '';
  series.forEach((d, i) => {
    const filled = Math.min(ROWS - 1, Math.ceil(d.count / scale));
    for (let r = 0; r < ROWS; r++) {
      dots += `<rect class="${r <= filled ? 'f' : 'e'}" x="${colX(i)}" y="${rowY(r)}" width="${DOT}" height="${DOT}" rx="3"/>`;
    }
  });

  // y axis ticks
  let yAxis = '';
  for (const r of [0, 4, 8, 12]) {
    yAxis += `<text x="${plotX - 14}" y="${rowY(r) + DOT / 2 + 5}" text-anchor="end" class="m" font-size="14">${r * scale}</text>`;
  }

  // x axis labels: last day, then every 7 days back, plus the first day
  let xAxis = '';
  const idx = new Set([0]);
  for (let i = DAYS - 1; i > 0; i -= 7) idx.add(i);
  for (const i of [...idx].sort((a, b) => a - b)) {
    const last = i === DAYS - 1;
    const tx = last ? colX(i) + DOT : colX(i);
    xAxis += `<text x="${tx}" y="${rowY(0) + DOT + 28}" text-anchor="${last ? 'end' : 'start'}" class="m" font-size="14">${label(series[i].date)}</text>`;
  }

  const desc = `${total} commits by ${user} in the last ${DAYS} days, one column per day.`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="t d">
<title id="t">Commit progress</title>
<desc id="d">${esc(desc)}</desc>
<style>
text{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif}
.t{fill:${c.text}}.m{fill:${c.muted}}.e{fill:${c.empty}}.f{fill:${c.fill}}
</style>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="20" fill="${c.bg}" stroke="${c.border}"/>
<text x="32" y="44" class="t" font-size="24" font-weight="600">Progress</text>
<text x="32" y="68" class="m" font-size="13">${total} commits · last ${DAYS} days · @${esc(user)}</text>
${chips}
${yAxis}
${dots}
${xAxis}
</svg>
`;
}

const counts = await fetchCounts();
const series = days.map((date) => ({ date, count: counts[dayKey(date)] || 0 }));
const max = Math.max(...series.map((d) => d.count));
const scale = Math.max(1, Math.ceil(max / (ROWS - 1)));

await mkdir(outDir, { recursive: true });
for (const theme of Object.keys(THEMES)) {
  await writeFile(path.join(outDir, `progress-${theme}.svg`), render(theme, series, scale));
}
console.log(`Wrote ${outDir}/progress-{light,dark}.svg — ${series.reduce((s, d) => s + d.count, 0)} commits, max ${max}/day, 1 dot = ${scale}`);
