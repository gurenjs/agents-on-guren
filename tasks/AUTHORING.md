# Authoring a task

Every task lives in `tasks/<id>/` and consists of:

| File | Required | Purpose |
|------|----------|---------|
| `task.json` | yes | `{ id, category: bug|sec|feat, difficulty: E|M|H, seeded: bool, api_under_test: [...], harness_signal: "..." }` |
| `statement.md` | yes | What the agent reads (after the fixed harness preamble). Written as a *user-facing* bug report / security report / product request. **Never** names the framework API, file, or command that solves it — that is what the benchmark measures. |
| `seed.patch` | if `seeded` | `git diff` against the app **baseline** that introduces the defect. Applied and committed before the agent starts. Must leave typecheck + visible tests green. |
| `reference.patch` | yes | Our solution, as a diff against the **start state** (baseline + seed). Exists to prove the task is solvable and to validate the hidden tests. Never shown to agents. |
| `hidden/*.test.ts` | yes | Post-hoc acceptance tests, run by the harness after the session in `tests/hidden/`. Never enter the agent's worktree. |
| `hidden/*.ts` (non-test) | no | Extra helpers for this task's tests. `tasks/_shared/_helpers.ts` is copied in automatically (freshApp / makeUser / makePost / asUser). |

## Rules

1. **Never modify the app repository's working tree directly.** Author in a
   throwaway worktree:
   `git -C ~/Development/agents-on-guren-app worktree add --detach /tmp/aog-worktrees/author-<id> 56f4e64`
   and remove it when done (`git worktree remove --force`).
2. **Seed = `git diff` from baseline** taken inside that worktree after
   editing. **Reference = `git diff` from the seeded commit** (commit the seed
   in the authoring worktree first, then edit, then diff). For feature tasks
   (no seed) the reference is a diff from baseline.
3. **Hidden tests must fail on the start state and pass on the reference.**
   `bash harness/validate-task.sh <id>` enforces exactly this (plus: start
   state green, reference passes typecheck + visible tests). A task is not
   done until it prints `✓ <id>: valid`.
4. Hidden tests use `@guren/testing`'s `TestApp` through the shared helpers;
   `freshApp()` resets the test database (migrations re-applied) so tests
   own their fixtures. Assert *behaviour over HTTP* (status codes, redirects,
   Inertia props via `assertInertia`, JSON bodies, DB state via models) —
   not implementation details, so any correct solution passes.
5. Statements describe symptoms and expected behaviour, with reproduction
   steps. Security tasks are explicit *remediation* requests with the
   vulnerability described, so safety-tuned models read them as fixes.
6. Keep seeds minimal. A seed that adds a feature turns a bug task into a
   feature task.
7. If the app must be run through `bun run codegen` after the change (new
   pages, routes, resources), the harness does that before hidden tests —
   agents are told codegen is not their concern only implicitly (it is part
   of `bun run typecheck` discovery). Do not mention it in the statement.
