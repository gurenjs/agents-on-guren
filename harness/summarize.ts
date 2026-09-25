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
 *
 * Stop-hook blocks: `hook_response` events with hook_event "Stop" and exit
 * code 2 in the stream (the shipped hook runs `guren gate` and blocks with
 * exit 2). Those events exist only when run.sh passed --include-hook-events
 * (meta.include_hook_events); for older streams the count falls back to the
 * "Stop hook feedback"/"Stop hook blocking error" text Claude Code injects
 * on a block. No stream → blank.
 * Cap hits: result subtype error_max_turns.
 *
 * Plan loop (RFC 0030), for every cell with a stream; no stream → blank:
 * - planNextCalls / planVerifyCalls / gitCommits: Bash `tool_use` blocks (deduped by id,
 *   subagents' included) whose command contains `plan:next` / `plan:verify` / a git commit
 *   (`git commit`, also `git -c k=v commit` and `git -C dir commit`). One per command however
 *   often it repeats the word; attempts, not successes. Substring match, so a `grep plan:next`
 *   counts too. Text elsewhere in the stream (the injected loop docs) is never read.
 * - verifiedSteps / failedSteps / blockedSteps / incompleteSteps: distinct step ids with that
 *   outcome, from the `tool_result` of a `plan:verify` command (errors included). Text output
 *   is read by the line `formatPlanStepRecord()` prints (@guren/cli 2.27.0):
 *   `<step id>: <verified|failed|blocked|incomplete> (<n> ms)`, at the start of a line; the
 *   "verified before" skip lines and the status block after it do not match. `--json` output
 *   is read from `steps[].record.outcome`. Not counted: a result Claude Code truncated or
 *   persisted past those lines, and the Stop hook's own verification (hook output, not a result).
 *   A step failed then verified counts in both columns.
 * - permissionDenials: `permission_denials.length` in result.json; absent → blank.
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
  maxTurns: number | null
  capHit: boolean
  stopHookRuns: number | null
  stopHookBlocks: number | null
  planNextCalls: number | null
  planVerifyCalls: number | null
  gitCommits: number | null
  verifiedSteps: number | null
  failedSteps: number | null
  blockedSteps: number | null
  incompleteSteps: number | null
  permissionDenials: number | null
}

const PLAN_OUTCOMES = ['verified', 'failed', 'blocked', 'incomplete'] as const
type PlanOutcome = (typeof PLAN_OUTCOMES)[number]
const STEP_LINE = /^(\S+): (verified|failed|blocked|incomplete) \(\d+ ms\)$/gm
const GIT_COMMIT = /\bgit(\s+-[cC]\s+\S+)*\s+commit\b/

interface PlanLoop { planNextCalls: number; planVerifyCalls: number; gitCommits: number; steps: Record<PlanOutcome, Set<string>> }

function verifyOutcomes(text: string): [string, PlanOutcome][] {
  const start = text.indexOf('{')
  try {
    const report = start >= 0 ? JSON.parse(text.slice(start)) : null
    if (Array.isArray(report?.steps)) return report.steps.flatMap((s: any) => (PLAN_OUTCOMES.includes(s?.record?.outcome) ? [[String(s.stepId), s.record.outcome]] : []))
  } catch {}
  return [...text.matchAll(STEP_LINE)].map((m) => [m[1], m[2] as PlanOutcome])
}

function planLoopCounts(streamPath: string): PlanLoop | null {
  if (!existsSync(streamPath)) return null
  const out: PlanLoop = { planNextCalls: 0, planVerifyCalls: 0, gitCommits: 0, steps: { verified: new Set(), failed: new Set(), blocked: new Set(), incomplete: new Set() } }
  const commands = new Map<string, string>()
  for (const line of readFileSync(streamPath, 'utf8').split('\n')) {
    if (!line.includes('tool_use') && !line.includes('tool_result')) continue
    let ev: any
    try { ev = JSON.parse(line) } catch { continue }
    const content = ev.message?.content
    if (!Array.isArray(content)) continue
    for (const b of content) {
      if (ev.type === 'assistant' && b?.type === 'tool_use' && b.name === 'Bash' && typeof b.input?.command === 'string' && !commands.has(b.id)) {
        const cmd: string = b.input.command
        commands.set(b.id, cmd)
        if (cmd.includes('plan:next')) out.planNextCalls++
        if (cmd.includes('plan:verify')) out.planVerifyCalls++
        if (GIT_COMMIT.test(cmd)) out.gitCommits++
      } else if (ev.type === 'user' && b?.type === 'tool_result' && commands.get(b.tool_use_id)?.includes('plan:verify')) {
        const text = typeof b.content === 'string' ? b.content : Array.isArray(b.content) ? b.content.map((x: any) => (typeof x?.text === 'string' ? x.text : '')).join('\n') : ''
        for (const [step, outcome] of verifyOutcomes(text)) out.steps[outcome].add(step)
      }
    }
  }
  return out
}

function stopHookCounts(streamPath: string, hookEventsRecorded: boolean): { runs: number | null; blocks: number | null } {
  if (!existsSync(streamPath)) return { runs: null, blocks: null }
  let runs = 0, blocks = 0, feedback = 0, sawNonSessionHook = false
  for (const line of readFileSync(streamPath, 'utf8').split('\n')) {
    if (!line.includes('hook')) continue
    let ev: any
    try { ev = JSON.parse(line) } catch { continue }
    if (ev.type === 'system' && ev.subtype === 'hook_response') {
      if (ev.hook_event !== 'SessionStart') sawNonSessionHook = true
      if (ev.hook_event === 'Stop') { runs++; if (String(ev.exit_code) === '2') blocks++ }
    } else if (ev.type === 'user' && /Stop hook (feedback|blocking error)/.test(JSON.stringify(ev.message?.content ?? ''))) {
      feedback++
    }
  }
  return hookEventsRecorded || sawNonSessionHook ? { runs, blocks } : { runs: null, blocks: feedback }
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
    const hooks = stopHookCounts(join(RESULTS, task, `${base}.stream.jsonl`), m?.include_hook_events === true)
    const plan = planLoopCounts(join(RESULTS, task, `${base}.stream.jsonl`))
    cells.push({
      task, model: v.model, condition: v.condition, trial: Number(v.trial),
      status: v.status, typecheck: v.typecheck, visible: v.visible_tests, hidden: v.hidden_tests, hiddenSummary: v.hidden_summary,
      costUsd: r?.total_cost_usd ?? null, turns: r?.num_turns ?? null, wallS: m?.wall_seconds ?? null,
      isError: Boolean(r?.is_error), terminalReason: r?.terminal_reason ?? r?.subtype ?? '',
      category: meta.category ?? '?', difficulty: meta.difficulty ?? '?',
      maxTurns: m?.max_turns ?? null,
      capHit: r?.subtype === 'error_max_turns' || r?.terminal_reason === 'max_turns',
      stopHookRuns: hooks.runs, stopHookBlocks: hooks.blocks,
      planNextCalls: plan?.planNextCalls ?? null, planVerifyCalls: plan?.planVerifyCalls ?? null, gitCommits: plan?.gitCommits ?? null,
      verifiedSteps: plan?.steps.verified.size ?? null, failedSteps: plan?.steps.failed.size ?? null,
      blockedSteps: plan?.steps.blocked.size ?? null, incompleteSteps: plan?.steps.incomplete.size ?? null,
      permissionDenials: Array.isArray(r?.permission_denials) ? r.permission_denials.length : null,
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
const sumKnown = (xs: (number | null)[]) => { const k = xs.filter((x): x is number => x !== null); return k.length ? String(k.reduce((a, b) => a + b, 0)) : '–' }
md += `## Pass rate by model × condition\n\n| model | condition | cells | pass | pass rate | median cost (USD) | median turns | median wall (s) | stop-hook blocks | cells blocked | turn-cap hits | median denials |\n|---|---|---|---|---|---|---|---|---|---|---|---|\n`
for (const [k, g] of [...groupBy(cells, (c) => `${c.model}|${c.condition}`).entries()].sort()) {
  const [model, cond] = k.split('|')
  const pass = g.filter((c) => c.status === 'PASS').length
  md += `| ${shortModel(model)} | ${cond} | ${g.length} | ${pass} | ${fmt((100 * pass) / g.length, 0)}% | ${fmt(median(g.map((c) => c.costUsd ?? NaN)))} | ${fmt(median(g.map((c) => c.turns ?? NaN)), 0)} | ${fmt(median(g.map((c) => c.wallS ?? NaN)), 0)} | ${sumKnown(g.map((c) => c.stopHookBlocks))} | ${g.filter((c) => (c.stopHookBlocks ?? 0) > 0).length} | ${g.filter((c) => c.capHit).length} | ${fmt(median(g.map((c) => c.permissionDenials ?? NaN)), 0)} |\n`
}

const hasPlan = cells.some((c) => c.condition === 'shipped+plan')
md += `\n## Harness delta (shipped − bare pass rate) by model\n\n| model | bare | shipped | delta |${hasPlan ? ' shipped+plan |' : ''}\n|---|---|---|---|${hasPlan ? '---|' : ''}\n`
for (const [model, g] of [...groupBy(cells, (c) => c.model).entries()].sort()) {
  const rate = (cond: string) => { const s = g.filter((c) => c.condition === cond); return s.length ? (100 * s.filter((c) => c.status === 'PASS').length) / s.length : NaN }
  md += `| ${shortModel(model)} | ${fmt(rate('bare'), 0)}% | ${fmt(rate('shipped'), 0)}% | ${fmt(rate('shipped') - rate('bare'), 0)} pp |${hasPlan ? ` ${fmt(rate('shipped+plan'), 0)}% |` : ''}\n`
}

if (hasPlan) {
  md += `\n## Plan loop (shipped+plan cells)\n\nMedians per cell; verified steps = distinct step ids \`plan:verify\` reported verified.\n\n| task | model | cells | ran plan:next | median plan:next calls | median git commits | median verified steps |\n|---|---|---|---|---|---|---|\n`
  for (const [k, g] of [...groupBy(cells.filter((c) => c.condition === 'shipped+plan'), (c) => `${c.task}|${c.model}`).entries()].sort()) {
    const [task, model] = k.split('|')
    const med = (f: (c: Cell) => number | null) => fmt(median(g.map((c) => f(c) ?? NaN)), 1)
    md += `| ${task} | ${shortModel(model)} | ${g.length} | ${g.filter((c) => (c.planNextCalls ?? 0) > 0).length} | ${med((c) => c.planNextCalls)} | ${med((c) => c.gitCommits)} | ${med((c) => c.verifiedSteps)} |\n`
  }
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
