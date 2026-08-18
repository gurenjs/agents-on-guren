/**
 * Aggregates results/<task>/<model>-<condition>-<trial>.{result,verdict,meta}.json
 * into Markdown tables + a flat CSV.
 *
 * Usage: bun harness/summarize.ts [--csv out.csv] [--json out.json]
 *
 * Reported per (model, condition): pass rate, median API-equivalent cost,
 * median turns, median wall seconds; then per task the pass counts per cell.
 * Cost is `total_cost_usd` from the Claude Code result event — the same
 * API-equivalent figure the earlier agent-eval rounds (gurenjs/framework-comparison) reported.
 */
import { readdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dir, '..')
const RESULTS = process.env.AOG_RESULTS ? process.env.AOG_RESULTS : join(ROOT, 'results')

interface Cell {
  task: string
  model: string
  condition: string
  trial: number
  status: string
  typecheck: string
  visible: string
  hidden: string
  hiddenSummary: string
  costUsd: number | null
  turns: number | null
  wallS: number | null
  isError: boolean
  terminalReason: string
  category: string
  difficulty: string
}

function readJson<T>(p: string): T | null {
  if (!existsSync(p)) return null
  try { return JSON.parse(readFileSync(p, 'utf8')) as T } catch { return null }
}

const cells: Cell[] = []
for (const task of readdirSync(RESULTS, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)) {
  const meta = readJson<{ category?: string; difficulty?: string }>(join(ROOT, 'tasks', task, 'task.json')) ?? {}
  for (const f of readdirSync(join(RESULTS, task)).filter((n) => n.endsWith('.verdict.json'))) {
    const base = f.replace(/\.verdict\.json$/, '')
    const v = readJson<any>(join(RESULTS, task, f))
    const r = readJson<any>(join(RESULTS, task, `${base}.result.json`))
    const m = readJson<any>(join(RESULTS, task, `${base}.meta.json`))
    if (!v) continue
    cells.push({
      task, model: v.model, condition: v.condition, trial: Number(v.trial),
      status: v.status, typecheck: v.typecheck, visible: v.visible_tests, hidden: v.hidden_tests, hiddenSummary: v.hidden_summary,
      costUsd: r?.total_cost_usd ?? null, turns: r?.num_turns ?? null, wallS: m?.wall_seconds ?? null,
      isError: Boolean(r?.is_error), terminalReason: r?.terminal_reason ?? r?.subtype ?? '',
      category: meta.category ?? '?', difficulty: meta.difficulty ?? '?',
    })
  }
}

const median = (xs: number[]) => {
  const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b)
  if (!s.length) return NaN
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}
const fmt = (n: number, d = 2) => (Number.isFinite(n) ? n.toFixed(d) : '–')
const shortModel = (m: string) => m.replace(/^claude-/, '').replace(/-\d{8}$/, '')

const groupBy = <T,>(xs: T[], key: (x: T) => string) => {
  const out = new Map<string, T[]>()
  for (const x of xs) out.set(key(x), [...(out.get(key(x)) ?? []), x])
  return out
}

let md = `# Agents on Guren — results (${cells.length} cells)\n\n`
md += `## Pass rate by model × condition\n\n| model | condition | cells | pass | pass rate | median cost (USD) | median turns | median wall (s) |\n|---|---|---|---|---|---|---|---|\n`
for (const [k, g] of [...groupBy(cells, (c) => `${c.model}|${c.condition}`).entries()].sort()) {
  const [model, cond] = k.split('|')
  const pass = g.filter((c) => c.status === 'PASS').length
  md += `| ${shortModel(model)} | ${cond} | ${g.length} | ${pass} | ${fmt((100 * pass) / g.length, 0)}% | ${fmt(median(g.map((c) => c.costUsd ?? NaN)))} | ${fmt(median(g.map((c) => c.turns ?? NaN)), 0)} | ${fmt(median(g.map((c) => c.wallS ?? NaN)), 0)} |\n`
}

md += `\n## Harness delta (shipped − bare pass rate) by model\n\n| model | bare | shipped | delta |\n|---|---|---|---|\n`
for (const [model, g] of [...groupBy(cells, (c) => c.model).entries()].sort()) {
  const rate = (cond: string) => { const s = g.filter((c) => c.condition === cond); return s.length ? (100 * s.filter((c) => c.status === 'PASS').length) / s.length : NaN }
  md += `| ${shortModel(model)} | ${fmt(rate('bare'), 0)}% | ${fmt(rate('shipped'), 0)}% | ${fmt(rate('shipped') - rate('bare'), 0)} pp |\n`
}

md += `\n## Per task (pass / cells)\n\n`
const combos = [...new Set(cells.map((c) => `${c.model}|${c.condition}`))].sort()
md += `| task | cat | diff | ${combos.map((k) => { const [m, c] = k.split('|'); return `${shortModel(m)} ${c}` }).join(' | ')} |\n|---|---|---|${combos.map(() => '---').join('|')}|\n`
for (const [task, g] of [...groupBy(cells, (c) => c.task).entries()].sort()) {
  const row = combos.map((k) => { const s = g.filter((c) => `${c.model}|${c.condition}` === k); return s.length ? `${s.filter((c) => c.status === 'PASS').length}/${s.length}` : '–' })
  md += `| ${task} | ${g[0].category} | ${g[0].difficulty} | ${row.join(' | ')} |\n`
}

const errs = cells.filter((c) => c.isError || (c.status !== 'PASS' && c.status !== 'FAIL'))
if (errs.length) {
  md += `\n## Non-standard outcomes\n\n| cell | status | terminal reason |\n|---|---|---|\n`
  for (const c of errs) md += `| ${c.task}/${shortModel(c.model)}-${c.condition}-${c.trial} | ${c.status} | ${c.terminalReason} |\n`
}

console.log(md)

const args = process.argv.slice(2)
const csvIdx = args.indexOf('--csv'); const jsonIdx = args.indexOf('--json')
if (csvIdx >= 0) {
  const header = Object.keys(cells[0] ?? {}).join(',')
  const rows = cells.map((c) => Object.values(c).map((v) => (typeof v === 'string' && v.includes(',') ? JSON.stringify(v) : String(v ?? ''))).join(','))
  writeFileSync(args[csvIdx + 1], [header, ...rows].join('\n') + '\n')
}
if (jsonIdx >= 0) writeFileSync(args[jsonIdx + 1], JSON.stringify(cells, null, 2))
