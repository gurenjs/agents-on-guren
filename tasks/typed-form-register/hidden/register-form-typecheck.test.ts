import { describe, expect, it } from 'bun:test'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

// Compile-time gate. The requirement is that the registration form's field
// names and its target route are checked by `tsc` against the server's
// contract, so we do to the front-end exactly what a careless edit would do
// and expect the compiler to object:
//
//   mutant A — every `passwordConfirmation` token in the front-end tree
//              (resources/js/**) becomes `passwordConfirmatoin`.
//   mutant B — every `register.store` route name in the front-end tree
//              becomes `register.stor`.
//
// The rename is applied to the WHOLE front-end tree, not just the page, so a
// hand-copied type in a sibling file is renamed along with the page and stays
// self-consistent: only a form anchored to something *outside* the front-end
// (the server's route contract) breaks. The server side (`app/`, `routes/`,
// the generated `.guren/`) is never touched. Files are restored from memory
// afterwards — never via git, because the agent's work is uncommitted.
//
// Nothing here depends on the identifiers the solution chose: the mutation is
// a textual rename of the field name and of the route name, both of which the
// statement fixes.

const APP_ROOT = resolve(import.meta.dir, '..', '..')
const FRONTEND_ROOT = join(APP_ROOT, 'resources', 'js')
const TSC_TIMEOUT_MS = 240_000

function listSourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      out.push(...listSourceFiles(full))
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

// The app's own TypeScript, exactly what `bun run typecheck` runs; bunx only as a fallback.
const LOCAL_TSC = join(APP_ROOT, 'node_modules', '.bin', 'tsc')
const TSC_COMMAND = existsSync(LOCAL_TSC) ? [LOCAL_TSC] : ['bunx', 'tsc']

function runTsc(): { exitCode: number; output: string } {
  const proc = Bun.spawnSync([...TSC_COMMAND, '--noEmit', '-p', 'tsconfig.json'], {
    cwd: APP_ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, FORCE_COLOR: '0' },
  })
  return {
    exitCode: proc.exitCode ?? 1,
    output: `${proc.stdout.toString()}\n${proc.stderr.toString()}`.trim(),
  }
}

/** Replace every occurrence of `token` in every front-end source file, run tsc, then restore. */
function typecheckWithMutation(token: string, replacement: string): { exitCode: number; output: string; touched: string[] } {
  const originals = new Map<string, string>()
  const touched: string[] = []
  try {
    for (const file of listSourceFiles(FRONTEND_ROOT)) {
      const source = readFileSync(file, 'utf8')
      if (!source.includes(token)) continue
      originals.set(file, source)
      touched.push(file)
      writeFileSync(file, source.split(token).join(replacement))
    }
    const result = runTsc()
    return { ...result, touched }
  } finally {
    for (const [file, source] of originals) writeFileSync(file, source)
  }
}

describe('registration form is checked by the compiler against the server contract', () => {
  it('control: the untouched project passes typecheck', () => {
    const { exitCode, output } = runTsc()
    expect(output.split('\n').filter((line) => line.includes('error TS')).slice(0, 10).join('\n')).toBe('')
    expect(exitCode).toBe(0)
  }, TSC_TIMEOUT_MS)

  it('a misspelled field name in the front-end (passwordConfirmation → passwordConfirmatoin) fails typecheck', () => {
    const { exitCode, touched } = typecheckWithMutation('passwordConfirmation', 'passwordConfirmatoin')
    // The token must exist somewhere in the front-end, or the mutation was a no-op.
    expect(touched.length).toBeGreaterThan(0)
    expect(exitCode).not.toBe(0)
  }, TSC_TIMEOUT_MS)

  it('a wrong route name in the front-end (register.store → register.stor) fails typecheck', () => {
    const { exitCode, touched } = typecheckWithMutation('register.store', 'register.stor')
    // The page must target the route by name; a raw path is not checked by anything.
    expect(touched.length).toBeGreaterThan(0)
    expect(exitCode).not.toBe(0)
  }, TSC_TIMEOUT_MS)

  it('restores the front-end sources after mutating them', () => {
    // Belt and braces: after both mutations, the tree must typecheck again.
    const { exitCode } = runTsc()
    expect(exitCode).toBe(0)
  }, TSC_TIMEOUT_MS)
})
