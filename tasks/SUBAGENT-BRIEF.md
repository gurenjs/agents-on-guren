# Brief for task-authoring subagents

You are authoring ONE benchmark task for "Agents on Guren" (an AI-agent
benchmark on a Guren web app). Your task id is given in your prompt.

## Read first (in this order)
1. `<repo>/tasks/AUTHORING.md` — the file layout and the rules. Follow them exactly.
2. `<repo>/CORPUS.md` — find your task's row and its "Per-task notes" section; that is the design you implement.
3. `<repo>/tasks/missing-authorize-destroy/` — the exemplar (task.json, statement.md, seed.patch, reference.patch, hidden/*.test.ts). Match its style.
4. `<repo>/tasks/_shared/_helpers.ts` — fixture helpers your hidden tests import from `./_helpers.js`.
5. The application: create your authoring worktree (below) and read the code you need there. Framework API reference: `bunx guren context` inside the worktree prints the API digest; `node_modules/@guren/*/dist/index.d.ts` has the types.

## Hard constraints
- App repo: `$APP_REPO` (default `~/Development/agents-on-guren-app`), baseline commit `56f4e64`. **Never edit its working tree.** Author only inside
  `git -C $APP_REPO worktree add --detach /tmp/aog-worktrees/author-<id> 56f4e64`
  and set it up with `bun install && cp .env.example .env && bunx guren key:generate --write && bun run codegen && bun run db:migrate`.
- Do NOT modify anything under `harness/` or `tasks/_shared/`. If you need a helper, put it in `tasks/<id>/hidden/<name>.ts` (non-test `.ts` files there are copied in too).
- Do NOT commit in the benchmark repo (`<repo>`); the orchestrator commits. Committing inside your *authoring worktree* is fine (needed to diff the reference against the seed).
- The task is done ONLY when `bash <repo>/harness/validate-task.sh <id>` prints `✓ <id>: valid`. Iterate until it does. Read `/tmp/aog-worktrees/validate-<id>.log*` on failure.
- Hidden tests must be behaviour-level (HTTP status, redirects, JSON, Inertia props via `assertInertia`, DB state via models) so *any* correct implementation passes — not tied to your reference's file names or internals. Where the statement leaves a choice open (e.g. 302 vs 303), accept both.
- The statement must never name the framework API/file/command that solves it.
- Remove your authoring worktree when done: `git -C $APP_REPO worktree remove --force /tmp/aog-worktrees/author-<id>`.
- Other subagents are authoring other tasks concurrently on the same machine: use only your own worktree paths, never `git worktree prune` others' worktrees, and don't kill processes you didn't start.

## Deliver
Files under `<repo>/tasks/<id>/` per AUTHORING.md, validated. Then reply with: the final validate output line, the hidden test count, a 3-line summary of seed / reference / what the hidden tests assert, and any deviation from CORPUS.md's design (with reason). Keep the reply short.
