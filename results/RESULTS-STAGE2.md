# Agents on Guren, Stage 2 results (225 cells)

## Pass rate, turns, cost by model × condition (medians)

| model | condition | cells | pass | rate | med turns | med cost (USD) | mean cost (USD) | med wall (s) | stop-hook blocks | cap hits | med denials |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Sonnet 5.5 | bare | 27 | 26 | 96% | 37 | 0.57 | 0.63 | 99 | 0 | 0 | 2 |
| Sonnet 5.5 | shipped | 27 | 27 | 100% | 29 | 0.61 | 0.64 | 94 | 3 | 0 | 2 |
| Sonnet 5.5 | shipped+plan | 9 | 9 | 100% | 37 | 0.70 | 0.69 | 103 | 0 | 0 | 2 |
| Opus 5.5 | bare | 27 | 27 | 100% | 59 | 1.51 | 1.53 | 209 | 0 | 0 | 1 |
| Opus 5.5 | shipped | 27 | 27 | 100% | 43 | 1.29 | 1.36 | 152 | 0 | 0 | 0 |
| Haiku 4.5 | bare | 27 | 8 | 30% | 90 | 0.79 | 0.84 | 299 | 0 | 0 | 0 |
| Haiku 4.5 | shipped | 27 | 12 | 44% | 80 | 0.89 | 0.92 | 294 | 1 | 0 | 0 |
| Fable 5.1 | bare | 27 | 27 | 100% | 99 | 6.27 | 6.27 | 502 | 0 | 0 | 2 |
| Fable 5.1 | shipped | 27 | 27 | 100% | 78 | 5.42 | 5.29 | 422 | 0 | 0 | 1 |

## Harness delta by model (shipped − bare)

| model | pass bare | pass shipped | Δ pass | Δ med turns | Δ med cost | Δ mean cost |
|---|---|---|---|---|---|---|
| Sonnet 5.5 | 96% | 100% | +4 pp | -22% | +7% | +1% |
| Opus 5.5 | 100% | 100% | +0 pp | -27% | -14% | -11% |
| Haiku 4.5 | 30% | 44% | +15 pp | -11% | +13% | +10% |
| Fable 5.1 | 100% | 100% | +0 pp | -21% | -13% | -16% |

## Pass count per task (passed / cells)

| task | Sonnet 5.5 bare | Sonnet 5.5 shipped | Sonnet 5.5 shipped+plan | Opus 5.5 bare | Opus 5.5 shipped | Haiku 4.5 bare | Haiku 4.5 shipped | Fable 5.1 bare | Fable 5.1 shipped |
|---|---|---|---|---|---|---|---|---|---|
| post-tags | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 0/3 | 2/3 | 3/3 | 3/3 |
| comments-moderation | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 1/3 | 3/3 | 3/3 | 3/3 |
| post-revisions | 3/3 | 3/3 | – | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| scheduled-publish | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 2/3 | 1/3 | 3/3 | 3/3 |
| json-api-tokens | 3/3 | 3/3 | – | 3/3 | 3/3 | 2/3 | 3/3 | 3/3 | 3/3 |
| locale-switch | 3/3 | 3/3 | – | 3/3 | 3/3 | 0/3 | 0/3 | 3/3 | 3/3 |
| newsletter-module | 2/3 | 3/3 | – | 3/3 | 3/3 | 0/3 | 0/3 | 3/3 | 3/3 |
| posts-agent-tool | 3/3 | 3/3 | – | 3/3 | 3/3 | 0/3 | 0/3 | 3/3 | 3/3 |
| cover-attachment | 3/3 | 3/3 | – | 3/3 | 3/3 | 0/3 | 0/3 | 3/3 | 3/3 |

## Idiom (passing cells only; task markers, tests/ excluded)

| model | condition | passing | framework-api | mixed | handwritten | unclassified | med api hits | med hand hits |
|---|---|---|---|---|---|---|---|---|
| Sonnet 5.5 | bare | 26 | 13 | 10 | 3 | 0 | 7 | 0 |
| Sonnet 5.5 | shipped | 27 | 15 | 9 | 3 | 0 | 6 | 0 |
| Sonnet 5.5 | shipped+plan | 9 | 5 | 4 | 0 | 0 | 11 | 0 |
| Opus 5.5 | bare | 27 | 22 | 5 | 0 | 0 | 12 | 0 |
| Opus 5.5 | shipped | 27 | 20 | 7 | 0 | 0 | 12 | 0 |
| Haiku 4.5 | bare | 8 | 4 | 4 | 0 | 0 | 8 | 0 |
| Haiku 4.5 | shipped | 12 | 4 | 8 | 0 | 0 | 9 | 1 |
| Fable 5.1 | bare | 27 | 19 | 8 | 0 | 0 | 14 | 0 |
| Fable 5.1 | shipped | 27 | 21 | 6 | 0 | 0 | 15 | 0 |

## Plan-loop adherence (shipped+plan cells)

| task | cells | pass | ran plan:next | med plan:next | med plan:verify | med git commits | med turns | med cost |
|---|---|---|---|---|---|---|---|---|
| post-tags | 3 | 3 | 3 | 1 | 0 | 0 | 40 | 0.83 |
| comments-moderation | 3 | 3 | 2 | 1 | 0 | 0 | 31 | 0.57 |
| scheduled-publish | 3 | 3 | 1 | 0 | 0 | 0 | 28 | 0.70 |

Same three tasks, Sonnet shipped without a plan: pass 9/9, med turns 27, med cost 0.55.

## Totals

- Cells: 225; passing 190; API-equivalent cost $477.84; wall 16.3 h of cell time.
