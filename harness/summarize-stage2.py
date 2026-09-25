#!/usr/bin/env python3
"""Stage 2 results (results/<task>/ for the nine Stage 2 tasks) as Markdown.

Reads verdict/result/meta/stream/patch files the harness wrote; never runs a
cell. Idiom counts follow api-utilization.ts (task markers, added lines only,
comment lines and tests/ excluded for Stage 2). Plan-loop adherence counts Bash
tool_use blocks, never the text of skill instructions echoed into the stream.

Usage: python3 harness/summarize-stage2.py [--out results/RESULTS-STAGE2.md]
"""
import glob, json, os, re, statistics, sys, collections

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
RESULTS = os.environ.get('AOG_RESULTS', os.path.join(ROOT, 'results'))
TASKS = ['post-tags', 'comments-moderation', 'post-revisions', 'scheduled-publish', 'json-api-tokens',
         'locale-switch', 'newsletter-module', 'posts-agent-tool', 'cover-attachment']
MODELS = [('claude-sonnet-5', 'Sonnet 5'), ('claude-opus-5-5', 'Opus 5.5'),
          ('claude-haiku-4-5-20251001', 'Haiku 4.5'), ('claude-fable-5-1', 'Fable 5.1')]
CONDS = ['bare', 'shipped', 'shipped+plan']

def med(xs, d=0):
    xs = [x for x in xs if x is not None]
    return '–' if not xs else (f"{statistics.median(xs):.{d}f}")

def added_lines(patch, skip_tests=True):
    out, skip = [], False
    for l in patch.split('\n'):
        if l.startswith('diff --git '):
            skip = skip_tests and l.startswith('diff --git a/tests/'); continue
        if not skip and l.startswith('+') and not l.startswith('+++'):
            out.append(l[1:])
    return [l for l in out if not re.match(r'^\s*//', l)]

def stream_counts(path):
    runs = blocks = plan_next = plan_verify = commits = 0
    seen = set()
    for l in open(path):
        if '"hook_response"' in l:
            e = json.loads(l)
            if e.get('subtype') == 'hook_response' and (e.get('hook_event') or e.get('hook_event_name')) == 'Stop':
                runs += 1; blocks += e.get('exit_code') == 2
        if '"tool_use"' in l and '"Bash"' in l:
            e = json.loads(l)
            for c in (e.get('message') or {}).get('content') or []:
                if isinstance(c, dict) and c.get('type') == 'tool_use' and c.get('name') == 'Bash' and c.get('id') not in seen:
                    seen.add(c.get('id')); cmd = (c.get('input') or {}).get('command', '')
                    plan_next += 'plan:next' in cmd; plan_verify += 'plan:verify' in cmd; commits += bool(re.search(r'\bgit\b.*\bcommit\b', cmd))
    return runs, blocks, plan_next, plan_verify, commits

cells = []
for task in TASKS:
    meta_task = json.load(open(os.path.join(ROOT, 'tasks', task, 'task.json')))
    api_res = [re.compile(p) for p in meta_task.get('api_markers', [])]
    hand_res = [re.compile(p) for p in meta_task.get('handwritten_markers', [])]
    for v in sorted(glob.glob(os.path.join(RESULTS, task, '*.verdict.json'))):
        base = v[:-len('.verdict.json')]
        verdict = json.load(open(v)); result = json.load(open(base + '.result.json'))
        meta = json.load(open(base + '.meta.json')) if os.path.exists(base + '.meta.json') else {}
        runs, blocks, pn, pv, commits = stream_counts(base + '.stream.jsonl') if os.path.exists(base + '.stream.jsonl') else (None,) * 5
        lines = added_lines(open(base + '.patch').read()) if os.path.exists(base + '.patch') else []
        api = sum(1 for l in lines for p in api_res if p.search(l)); hand = sum(1 for l in lines for p in hand_res if p.search(l))
        cells.append(dict(task=task, model=verdict['model'], cond=verdict['condition'], trial=verdict['trial'],
                          passed=verdict['status'] == 'PASS', turns=result.get('num_turns'), cost=result.get('total_cost_usd'),
                          wall=meta.get('wall_seconds'), cap=meta.get('max_turns'), cap_hit=result.get('num_turns') is not None and meta.get('max_turns') is not None and result['num_turns'] >= meta['max_turns'],
                          stop_runs=runs, stop_blocks=blocks, plan_next=pn, plan_verify=pv, commits=commits,
                          denials=len(result.get('permission_denials') or []), api=api, hand=hand,
                          klass=('framework-api' if api and not hand else 'handwritten' if hand and not api else 'mixed' if api else 'unclassified')))

md = [f"# Agents on Guren, Stage 2 results ({len(cells)} cells)\n"]
md.append("## Pass rate, turns, cost by model × condition (medians)\n")
md.append("| model | condition | cells | pass | rate | med turns | med cost (USD) | med wall (s) | stop-hook blocks | cap hits | med denials |")
md.append("|---|---|---|---|---|---|---|---|---|---|---|")
for mid, mname in MODELS:
    for cond in CONDS:
        g = [c for c in cells if c['model'] == mid and c['cond'] == cond]
        if not g: continue
        p = sum(c['passed'] for c in g)
        md.append(f"| {mname} | {cond} | {len(g)} | {p} | {100*p/len(g):.0f}% | {med([c['turns'] for c in g])} | {med([c['cost'] for c in g], 2)} | {med([c['wall'] for c in g])} | {sum(c['stop_blocks'] or 0 for c in g)} | {sum(c['cap_hit'] for c in g)} | {med([c['denials'] for c in g])} |")

md.append("\n## Harness delta by model (shipped − bare)\n")
md.append("| model | pass bare | pass shipped | Δ pass | Δ med turns | Δ med cost |")
md.append("|---|---|---|---|---|---|")
for mid, mname in MODELS:
    b = [c for c in cells if c['model'] == mid and c['cond'] == 'bare']; s = [c for c in cells if c['model'] == mid and c['cond'] == 'shipped']
    if not b or not s: continue
    pb, ps = 100*sum(c['passed'] for c in b)/len(b), 100*sum(c['passed'] for c in s)/len(s)
    tb, ts = statistics.median([c['turns'] for c in b]), statistics.median([c['turns'] for c in s])
    cb, cs = statistics.median([c['cost'] for c in b]), statistics.median([c['cost'] for c in s])
    md.append(f"| {mname} | {pb:.0f}% | {ps:.0f}% | {ps-pb:+.0f} pp | {100*(ts-tb)/tb:+.0f}% | {100*(cs-cb)/cb:+.0f}% |")

md.append("\n## Pass count per task (passed / cells)\n")
cols = [(mid, cond) for mid, _ in MODELS for cond in CONDS if any(c['model'] == mid and c['cond'] == cond for c in cells)]
md.append("| task | " + " | ".join(f"{dict(MODELS)[m]} {c}" for m, c in cols) + " |")
md.append("|---|" + "---|" * len(cols))
for task in TASKS:
    row = []
    for m, c in cols:
        g = [x for x in cells if x['task'] == task and x['model'] == m and x['cond'] == c]
        row.append(f"{sum(x['passed'] for x in g)}/{len(g)}" if g else "–")
    md.append(f"| {task} | " + " | ".join(row) + " |")

md.append("\n## Idiom (passing cells only; task markers, tests/ excluded)\n")
md.append("| model | condition | passing | framework-api | mixed | handwritten | unclassified | med api hits | med hand hits |")
md.append("|---|---|---|---|---|---|---|---|---|")
for mid, mname in MODELS:
    for cond in CONDS:
        g = [c for c in cells if c['model'] == mid and c['cond'] == cond and c['passed']]
        if not g: continue
        k = collections.Counter(c['klass'] for c in g)
        md.append(f"| {mname} | {cond} | {len(g)} | {k['framework-api']} | {k['mixed']} | {k['handwritten']} | {k['unclassified']} | {med([c['api'] for c in g])} | {med([c['hand'] for c in g])} |")

plan = [c for c in cells if c['cond'] == 'shipped+plan']
if plan:
    md.append("\n## Plan-loop adherence (shipped+plan cells)\n")
    md.append("| task | cells | pass | ran plan:next | med plan:next | med plan:verify | med git commits | med turns | med cost |")
    md.append("|---|---|---|---|---|---|---|---|---|")
    for task in TASKS:
        g = [c for c in plan if c['task'] == task]
        if not g: continue
        md.append(f"| {task} | {len(g)} | {sum(c['passed'] for c in g)} | {sum(1 for c in g if (c['plan_next'] or 0) > 0)} | {med([c['plan_next'] for c in g])} | {med([c['plan_verify'] for c in g])} | {med([c['commits'] for c in g])} | {med([c['turns'] for c in g])} | {med([c['cost'] for c in g], 2)} |")
    s = [c for c in cells if c['model'] == 'claude-sonnet-5' and c['cond'] == 'shipped' and c['task'] in {c2['task'] for c2 in plan}]
    md.append(f"\nSame three tasks, Sonnet shipped without a plan: pass {sum(c['passed'] for c in s)}/{len(s)}, med turns {med([c['turns'] for c in s])}, med cost {med([c['cost'] for c in s], 2)}.")

md.append("\n## Totals\n")
md.append(f"- Cells: {len(cells)}; passing {sum(c['passed'] for c in cells)}; API-equivalent cost ${sum(c['cost'] or 0 for c in cells):.2f}; wall {sum(c['wall'] or 0 for c in cells)/3600:.1f} h of cell time.")
text = "\n".join(md) + "\n"
out = None
if '--out' in sys.argv: out = sys.argv[sys.argv.index('--out') + 1]
if out:
    open(out, 'w').write(text); print(f"wrote {out}")
else:
    print(text)
