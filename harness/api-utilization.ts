/**
 * Framework-API utilization: for every PASSING cell, scan the agent's patch
 * (added lines only) and classify the solution as `framework-api`,
 * `handwritten`, or `mixed`, mirroring the Rails report's "used the API vs
 * reimplemented it by hand" finding.
 *
 * Per task, `task.json` may declare:
 *   "api_markers":         [regex, ...]  — evidence the framework API was used
 *   "handwritten_markers": [regex, ...]  — evidence of a hand-rolled substitute
 * Tasks without markers fall back to GENERIC_API below (weaker signal, flagged).
 *
 * Usage: bun harness/api-utilization.ts   → Markdown table + per-cell JSON lines
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dir, '..')
const RESULTS = process.env.AOG_RESULTS ? process.env.AOG_RESULTS : join(ROOT, 'results')

const GENERIC_API = [
  'findOrFail\\(', 'findWithOrFail\\(', 'validateBody\\(', 'validateQuery\\(', 'validateParams\\(',
  'this\\.authorize\\(', 'this\\.redirect\\(', 'this\\.inertia\\(', 'JsonResource', 'PostResource',
  'paginate\\(', '\\.with\\(', 'defineMiddleware', 'rateLimit', 'Policy', 'bind:', 'this\\.model\\(',
  'RouteContractOptions', 'defineSeeder', 'Mailable', 'dispatch\\(', 'Job\\b', 'healthCheck', 'translations',
]
const GENERIC_HAND = [
  'new Response\\(', 'status: 40[0-9]', 'JSON\\.parse\\(', 'request\\.json\\(\\)', 'new Map<', 'setInterval\\(',
  'sql`', 'db\\.select\\(', 'db\\.insert\\(', 'db\\.update\\(', 'db\\.delete\\(', 'throw new Error\\(',
]

function addedLines(patch: string): string[] {
  return patch.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).map((l) => l.slice(1))
}
const count = (lines: string[], res: string[]) => res.reduce((n, re) => n + lines.filter((l) => new RegExp(re).test(l)).length, 0)

interface Row { task: string; cell: string; api: number; hand: number; klass: string; generic: boolean }
const rows: Row[] = []
for (const task of readdirSync(RESULTS, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)) {
  const meta = existsSync(join(ROOT, 'tasks', task, 'task.json')) ? JSON.parse(readFileSync(join(ROOT, 'tasks', task, 'task.json'), 'utf8')) : {}
  const apiRes: string[] = meta.api_markers ?? GENERIC_API
  const handRes: string[] = meta.handwritten_markers ?? GENERIC_HAND
  const generic = !meta.api_markers
  for (const f of readdirSync(join(RESULTS, task)).filter((n) => n.endsWith('.verdict.json'))) {
    const v = JSON.parse(readFileSync(join(RESULTS, task, f), 'utf8'))
    if (v.status !== 'PASS') continue
    const base = f.replace(/\.verdict\.json$/, '')
    const patch = readFileSync(join(RESULTS, task, `${base}.patch`), 'utf8')
    const lines = addedLines(patch).filter((l) => !/^\s*\/\//.test(l))
    const api = count(lines, apiRes), hand = count(lines, handRes)
    const klass = api > 0 && hand === 0 ? 'framework-api' : api === 0 && hand > 0 ? 'handwritten' : api > 0 ? 'mixed' : 'unclassified'
    rows.push({ task, cell: base, api, hand, klass, generic })
  }
}

let md = `# Framework-API utilization (passing cells only, ${rows.length})\n\n| task | cell | api hits | hand hits | class | markers |\n|---|---|---|---|---|---|\n`
for (const r of rows) md += `| ${r.task} | ${r.cell} | ${r.api} | ${r.hand} | ${r.klass} | ${r.generic ? 'generic' : 'task'} |\n`
const byCond = new Map<string, Row[]>()
for (const r of rows) { const cond = r.cell.includes('-shipped-') ? 'shipped' : 'bare'; byCond.set(cond, [...(byCond.get(cond) ?? []), r]) }
md += `\n## By condition\n\n| condition | passing | framework-api | mixed | handwritten | unclassified |\n|---|---|---|---|---|---|\n`
for (const [cond, g] of byCond) md += `| ${cond} | ${g.length} | ${g.filter((r) => r.klass === 'framework-api').length} | ${g.filter((r) => r.klass === 'mixed').length} | ${g.filter((r) => r.klass === 'handwritten').length} | ${g.filter((r) => r.klass === 'unclassified').length} |\n`
console.log(md)
