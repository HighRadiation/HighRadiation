#!/usr/bin/env node
// Generates the profile README cards (light + dark SVG) and the projects block in README.md.
//
//   Live cards   progress chart (last 56 days), "Total" and "Impact" stat cards (last 30 days)
//   Static cards Skills and one card per project, read from scripts/profile.config.json
//
//   GH_USER            GitHub login to chart (default: GITHUB_REPOSITORY_OWNER)
//   GH_TOKEN           token for the GraphQL API (default: GITHUB_TOKEN)
//   OUT_DIR            output folder (default: <repo>/assets)
//   README_PATH        README to update (default: <repo>/README.md)
//   PROGRESS_FIXTURE   optional JSON {"repo": {"YYYY-MM-DD": commits}} to render without the API
//
// Counts are commits per UTC day. A token that can see private repositories (a personal
// access token) also counts private commits.

import { readFile, writeFile, mkdir, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const user = process.env.GH_USER || process.env.GITHUB_REPOSITORY_OWNER || 'HighRadiation';
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const outDir = process.env.OUT_DIR || path.join(root, 'assets');
const readmePath = process.env.README_PATH || path.join(root, 'README.md');
const fixturePath = process.env.PROGRESS_FIXTURE;
const config = JSON.parse(await readFile(path.join(root, 'scripts', 'profile.config.json'), 'utf8'));

const DAYS = 56; // chart window
const STAT_DAYS = 30; // stat card window
const ROWS = 14;
const DOT = 11;
const PITCH = 16;
const WIDE = 1000; // progress + skills card width
const HALF = 660; // stat + project card width

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayKey = (d) => d.toISOString().slice(0, 10);
const label = (d) => `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const now = new Date();
const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
const days = Array.from({ length: DAYS }, (_, i) => new Date(today.getTime() - (DAYS - 1 - i) * 86400000));

// ---------------------------------------------------------------- data

// Returns { "owner/repo": { "YYYY-MM-DD": commitCount } }
async function fetchCommits() {
  if (fixturePath) return JSON.parse(await readFile(fixturePath, 'utf8'));
  if (!token) throw new Error('GH_TOKEN / GITHUB_TOKEN is not set');

  const query = `query($login:String!,$from:DateTime!){
    user(login:$login){
      contributionsCollection(from:$from){
        commitContributionsByRepository(maxRepositories:100){
          repository{ nameWithOwner }
          contributions(first:100){ nodes{ commitCount occurredAt } }
        }
      }
    }
  }`;
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'profile-cards' },
    body: JSON.stringify({ query, variables: { login: user, from: days[0].toISOString() } }),
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors) throw new Error(`GitHub API error: ${JSON.stringify(json.errors)}`);
  if (!json.data?.user) throw new Error(`User not found: ${user}`);

  const byRepo = {};
  for (const r of json.data.user.contributionsCollection.commitContributionsByRepository) {
    const perDay = (byRepo[r.repository.nameWithOwner] ||= {});
    for (const n of r.contributions.nodes) {
      const k = n.occurredAt.slice(0, 10);
      perDay[k] = (perDay[k] || 0) + n.commitCount;
    }
  }
  return byRepo;
}

// ---------------------------------------------------------------- shared pieces

const THEMES = {
  light: { bg: '#ffffff', border: '#e4e4e7', text: '#18181b', muted: '#71717a', empty: '#ececee', fill: '#2542f4', chip: '#e4e4e7', red: '#e5533d', green: '#1f8a4c' },
  dark: { bg: '#0d1117', border: '#30363d', text: '#e6edf3', muted: '#8b949e', empty: '#1c2128', fill: '#5b7cff', chip: '#30363d', red: '#ff7b66', green: '#3fb871' },
};

function frame(w, h, c, title, desc, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="t d">
<title id="t">${esc(title)}</title>
<desc id="d">${esc(desc)}</desc>
<style>
text{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif}
.t{fill:${c.text}}.m{fill:${c.muted}}.e{fill:${c.empty}}.f{fill:${c.fill}}
</style>
<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="20" fill="${c.bg}" stroke="${c.border}"/>
${body}
</svg>
`;
}

const CHIP_H = 36;
const chipWidth = (text, kind) => 32 + Math.round(text.length * 8.2) + (kind === 'menu' ? 18 : 20);

// kind "swatch": coloured square + text, kind "menu": text + chevron
function chip(x, y, w, text, kind, swatch, c) {
  let s = `<rect x="${x + 0.5}" y="${y + 0.5}" width="${w - 1}" height="${CHIP_H - 1}" rx="18" fill="none" stroke="${c.chip}"/>`;
  if (kind === 'swatch') {
    s += `<rect x="${x + 16}" y="${y + 12}" width="12" height="12" rx="3" fill="${swatch}"/>`;
    s += `<text x="${x + 36}" y="${y + 23}" class="t" font-size="15">${esc(text)}</text>`;
  } else {
    s += `<text x="${x + 16}" y="${y + 23}" class="t" font-size="15">${esc(text)}</text>`;
    const cx = x + w - 26;
    s += `<path d="M${cx} ${y + 16} l4 4 l4 -4" fill="none" stroke="${c.text}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  return s;
}

// ---------------------------------------------------------------- progress chart

function renderProgress(theme, series, scale, cap, capped) {
  const c = THEMES[theme];
  const total = series.reduce((s, d) => s + d.count, 0);
  const plotX = 72;
  const plotTop = 96;
  const H = plotTop + (ROWS - 1) * PITCH + DOT + 52;
  const rowY = (r) => plotTop + (ROWS - 1 - r) * PITCH;
  const colX = (i) => plotX + i * PITCH;

  let dots = '';
  series.forEach((d, i) => {
    const filled = Math.min(ROWS - 1, Math.ceil(d.count / scale));
    for (let r = 0; r < ROWS; r++) {
      dots += `<rect class="${r <= filled ? 'f' : 'e'}" x="${colX(i)}" y="${rowY(r)}" width="${DOT}" height="${DOT}" rx="3"/>`;
    }
  });

  let yAxis = '';
  for (const r of [0, 4, 8, 12]) {
    yAxis += `<text x="${plotX - 14}" y="${rowY(r) + DOT / 2 + 5}" text-anchor="end" class="m" font-size="14">${r * scale}</text>`;
  }

  let xAxis = '';
  const idx = new Set([0]);
  for (let i = DAYS - 1; i > 0; i -= 7) idx.add(i);
  for (const i of [...idx].sort((a, b) => a - b)) {
    const last = i === DAYS - 1;
    const tx = last ? colX(i) + DOT : colX(i);
    xAxis += `<text x="${tx}" y="${rowY(0) + DOT + 28}" text-anchor="${last ? 'end' : 'start'}" class="m" font-size="14">${label(series[i].date)}</text>`;
  }

  const body = `<text x="32" y="44" class="t" font-size="24" font-weight="600">Progress</text>
<text x="32" y="68" class="m" font-size="13">${total} commits · last ${DAYS} days · @${esc(user)}${capped ? ` · ${capped} busier day${capped > 1 ? 's' : ''} capped at ${cap}` : ''}</text>
${yAxis}
${dots}
${xAxis}`;
  return frame(WIDE, H, c, 'Commit progress', `${total} commits by ${user} in the last ${DAYS} days, one column per day.`, body);
}

// ---------------------------------------------------------------- stat cards (Total / Impact)

const ICONS = {
  // git-commit: a ring with a line through it
  commit: (c) => `<g transform="translate(32 32)" fill="none" stroke="${c.red}" stroke-width="2.5" stroke-linecap="round"><circle cx="14" cy="14" r="6"/><path d="M1 14h7M20 14h7"/></g>`,
  // half-filled circle
  half: (c) => `<g transform="translate(32 32)"><circle cx="14" cy="14" r="12" fill="none" stroke="${c.green}" stroke-width="2.5"/><path d="M2 14a12 12 0 0 0 24 0z" fill="${c.green}"/></g>`,
};

function renderStat(theme, { title, icon, value, before, bold }) {
  const c = THEMES[theme];
  const h = 290;
  const text = value.toLocaleString('en-US');
  const body = `<path d="M0.5 88.5H${HALF - 0.5}" stroke="${c.border}"/>
${ICONS[icon](c)}
<text x="76" y="56" class="t" font-size="30" font-weight="500">${esc(title)}</text>
<text x="32" y="192" class="t" font-size="104" font-weight="500" letter-spacing="-3">${text}</text>
<text x="32" y="244" class="m" font-size="26">${esc(before)} <tspan class="t" font-weight="700">${esc(bold)}</tspan></text>`;
  return frame(HALF, h, c, `${title}: ${text}`, `${text} — ${before} ${bold}`, body);
}

// ---------------------------------------------------------------- skills card

function renderSkills(theme, skills) {
  const c = THEMES[theme];
  const left = 32;
  const maxX = WIDE - 32;
  let x = left;
  let y = 88;
  let chips = '';
  for (const s of skills) {
    const w = chipWidth(s.name, 'swatch');
    if (x + w > maxX) {
      x = left;
      y += CHIP_H + 12;
    }
    const color = theme === 'dark' && s.colorDark ? s.colorDark : s.color;
    chips += chip(x, y, w, s.name, 'swatch', color, c);
    x += w + 12;
  }
  const h = y + CHIP_H + 32;
  const body = `<text x="32" y="44" class="t" font-size="24" font-weight="600">Skills</text>
<text x="32" y="68" class="m" font-size="13">Tech stack · ${skills.length} tools</text>
${chips}`;
  return frame(WIDE, h, c, 'Skills', `Tech stack: ${skills.map((s) => s.name).join(', ')}`, body);
}

// ---------------------------------------------------------------- project cards

function renderProject(theme, project) {
  const c = THEMES[theme];
  const host = new URL(project.url).host.replace(/^www\./, '');
  const size = Math.max(30, Math.min(56, Math.floor((HALF - 64) / (host.length * 0.56))));
  const globe = `<g transform="translate(32 32)" fill="none" stroke="${c.fill}" stroke-width="2.5" stroke-linecap="round"><circle cx="14" cy="14" r="12"/><ellipse cx="14" cy="14" rx="5" ry="12"/><path d="M2 14h24"/></g>`;
  const body = `<path d="M0.5 88.5H${HALF - 0.5}" stroke="${c.border}"/>
${globe}
<text x="76" y="56" class="t" font-size="30" font-weight="500">${esc(project.name)}</text>
<text x="32" y="186" class="t" font-size="${size}" font-weight="500" letter-spacing="-1">${esc(host)}</text>
<text x="32" y="244" class="m" font-size="26">Live project · <tspan class="t" font-weight="700">open site</tspan></text>`;
  return frame(HALF, 290, c, project.name, `${project.name} — ${host}`, body);
}

function projectsBlock(projects) {
  const items = projects.map((p) => {
    const s = slug(p.name);
    return `<a href="${esc(p.url)}"><picture><source media="(prefers-color-scheme: dark)" srcset="assets/project-${s}-dark.svg"><img alt="${esc(p.name)}" src="assets/project-${s}-light.svg" width="49%"></picture></a>`;
  });
  return `<!-- PROJECTS:START -->\n${items.join('\n')}\n<!-- PROJECTS:END -->`;
}

// ---------------------------------------------------------------- build

const byRepo = await fetchCommits();

const counts = {};
for (const perDay of Object.values(byRepo)) for (const [d, n] of Object.entries(perDay)) counts[d] = (counts[d] || 0) + n;
const series = days.map((date) => ({ date, count: counts[dayKey(date)] || 0 }));
const max = Math.max(...series.map((d) => d.count));
// Scale to typical days, not the single busiest one: a lone spike would otherwise shrink every
// other day to a dot or two. Days above the cap are drawn full height and flagged in the subtitle.
const nonZero = series.map((d) => d.count).filter((n) => n > 0).sort((a, b) => a - b);
const median = nonZero.length ? nonZero[Math.floor(nonZero.length / 2)] : 0;
const scale = Math.max(1, Math.ceil(Math.min(max, Math.max(ROWS - 1, 3 * median)) / (ROWS - 1)));
const cap = scale * (ROWS - 1);
const capped = series.filter((d) => d.count > cap).length;

const statKeys = new Set(days.slice(-STAT_DAYS).map(dayKey));
const statCommits = series.slice(-STAT_DAYS).reduce((s, d) => s + d.count, 0);
const statRepos = Object.values(byRepo).filter((perDay) => Object.entries(perDay).some(([d, n]) => n > 0 && statKeys.has(d))).length;

const files = {};
for (const theme of Object.keys(THEMES)) {
  files[`progress-${theme}.svg`] = renderProgress(theme, series, scale, cap, capped);
  files[`stat-commits-${theme}.svg`] = renderStat(theme, { title: 'Total', icon: 'commit', value: statCommits, before: 'Commits in the', bold: `last ${STAT_DAYS} days` });
  files[`stat-repos-${theme}.svg`] = renderStat(theme, { title: 'Impact', icon: 'half', value: statRepos, before: 'Repositories pushed to in the', bold: `last ${STAT_DAYS} days` });
  files[`skills-${theme}.svg`] = renderSkills(theme, config.skills);
  for (const p of config.projects) files[`project-${slug(p.name)}-${theme}.svg`] = renderProject(theme, p);
}

await mkdir(outDir, { recursive: true });
for (const [name, content] of Object.entries(files)) await writeFile(path.join(outDir, name), content);
for (const name of await readdir(outDir)) {
  if (name.startsWith('project-') && name.endsWith('.svg') && !(name in files)) await unlink(path.join(outDir, name));
}

let readmeNote = 'README markers not found, projects block not updated';
try {
  const readme = await readFile(readmePath, 'utf8');
  const re = /<!-- PROJECTS:START -->[\s\S]*?<!-- PROJECTS:END -->/;
  if (re.test(readme)) {
    const next = readme.replace(re, () => projectsBlock(config.projects));
    if (next !== readme) await writeFile(readmePath, next);
    readmeNote = 'projects block up to date';
  }
} catch (err) {
  readmeNote = `README skipped (${err.code || err.message})`;
}

console.log(`Wrote ${Object.keys(files).length} SVGs to ${outDir} — ${series.reduce((s, d) => s + d.count, 0)} commits/${DAYS}d, ${statCommits} commits and ${statRepos} repos/${STAT_DAYS}d; ${readmeNote}`);
