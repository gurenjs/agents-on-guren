# Agents on Guren, Stage 2 results (225 cells)

## Pass rate, turns, cost by model × condition (medians)

| model | condition | cells | pass | rate | med turns | med cost (USD) | mean cost (USD) | med wall (s) | stop-hook blocks | cap hits | med denials |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Sonnet 5 | bare | 27 | 25 | 93% | 37 | 0.57 | 0.60 | 105 | 0 | 0 | 2 |
| Sonnet 5 | shipped | 27 | 26 | 96% | 29 | 0.63 | 0.66 | 97 | 3 | 0 | 2 |
| Sonnet 5 | shipped+plan | 9 | 9 | 100% | 33 | 0.68 | 0.78 | 111 | 2 | 0 | 2 |
| Opus 5.5 | bare | 27 | 27 | 100% | 65 | 1.58 | 1.55 | 230 | 0 | 0 | 1 |
| Opus 5.5 | shipped | 27 | 27 | 100% | 43 | 1.31 | 1.39 | 170 | 0 | 0 | 1 |
| Haiku 4.5 | bare | 27 | 11 | 41% | 96 | 1.00 | 1.01 | 362 | 0 | 0 | 0 |
| Haiku 4.5 | shipped | 27 | 15 | 56% | 81 | 0.90 | 0.94 | 302 | 0 | 0 | 0 |
| Fable 5.1 | bare | 27 | 27 | 100% | 77 | 4.01 | 4.39 | 358 | 0 | 0 | 1 |
| Fable 5.1 | shipped | 27 | 27 | 100% | 59 | 3.51 | 3.71 | 279 | 0 | 0 | 0 |

## Harness delta by model (shipped − bare)

| model | pass bare | pass shipped | Δ pass | Δ med turns | Δ med cost | Δ mean cost |
|---|---|---|---|---|---|---|
| Sonnet 5 | 93% | 96% | +4 pp | -22% | +11% | +10% |
| Opus 5.5 | 100% | 100% | +0 pp | -34% | -17% | -10% |
| Haiku 4.5 | 41% | 56% | +15 pp | -16% | -10% | -7% |
| Fable 5.1 | 100% | 100% | +0 pp | -23% | -12% | -15% |

## Pass count per task (passed / cells)

| task | Sonnet 5 bare | Sonnet 5 shipped | Sonnet 5 shipped+plan | Opus 5.5 bare | Opus 5.5 shipped | Haiku 4.5 bare | Haiku 4.5 shipped | Fable 5.1 bare | Fable 5.1 shipped |
|---|---|---|---|---|---|---|---|---|---|
| post-tags | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/3 | 2/3 | 3/3 | 3/3 |
| comments-moderation | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 2/3 | 3/3 | 3/3 | 3/3 |
| post-revisions | 3/3 | 3/3 | – | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| scheduled-publish | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 2/3 | 3/3 | 3/3 |
| json-api-tokens | 3/3 | 3/3 | – | 3/3 | 3/3 | 2/3 | 3/3 | 3/3 | 3/3 |
| locale-switch | 3/3 | 3/3 | – | 3/3 | 3/3 | 0/3 | 0/3 | 3/3 | 3/3 |
| newsletter-module | 1/3 | 3/3 | – | 3/3 | 3/3 | 0/3 | 1/3 | 3/3 | 3/3 |
| posts-agent-tool | 3/3 | 2/3 | – | 3/3 | 3/3 | 0/3 | 1/3 | 3/3 | 3/3 |
| cover-attachment | 3/3 | 3/3 | – | 3/3 | 3/3 | 0/3 | 0/3 | 3/3 | 3/3 |

## Idiom (passing cells only; task markers, tests/ excluded)

| model | condition | passing | framework-api | mixed | handwritten | unclassified | med api hits | med hand hits |
|---|---|---|---|---|---|---|---|---|
| Sonnet 5 | bare | 25 | 12 | 8 | 5 | 0 | 7 | 1 |
| Sonnet 5 | shipped | 26 | 14 | 10 | 2 | 0 | 6 | 0 |
| Sonnet 5 | shipped+plan | 9 | 5 | 4 | 0 | 0 | 8 | 0 |
| Opus 5.5 | bare | 27 | 24 | 3 | 0 | 0 | 11 | 0 |
| Opus 5.5 | shipped | 27 | 17 | 10 | 0 | 0 | 13 | 0 |
| Haiku 4.5 | bare | 11 | 4 | 7 | 0 | 0 | 6 | 2 |
| Haiku 4.5 | shipped | 15 | 7 | 8 | 0 | 0 | 9 | 1 |
| Fable 5.1 | bare | 27 | 26 | 1 | 0 | 0 | 13 | 0 |
| Fable 5.1 | shipped | 27 | 21 | 6 | 0 | 0 | 14 | 0 |

## Plan-loop adherence (shipped+plan cells)

| task | cells | pass | ran plan:next | med plan:next | med plan:verify | med git commits | med turns | med cost |
|---|---|---|---|---|---|---|---|---|
| post-tags | 3 | 3 | 3 | 1 | 0 | 0 | 27 | 0.66 |
| comments-moderation | 3 | 3 | 3 | 1 | 0 | 0 | 34 | 0.68 |
| scheduled-publish | 3 | 3 | 3 | 2 | 2 | 2 | 33 | 0.87 |

Same three tasks, Sonnet shipped without a plan: pass 9/9, med turns 29, med cost 0.64.

## Totals

- Cells: 225; passing 194; API-equivalent cost $391.66; wall 15.2 h of cell time.
