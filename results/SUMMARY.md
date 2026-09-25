# Agents on Guren — results (585 cells)

## Pass rate by model × condition

| model | condition | cells | pass | pass rate | median cost (USD) | median turns | median wall (s) | stop-hook blocks | cells blocked | turn-cap hits | median denials |
|---|---|---|---|---|---|---|---|---|---|---|---|
| fable-5-1 | bare | 27 | 27 | 100% | 4.01 | 77 | 358 | 0 | 0 | 0 | 1 |
| fable-5-1 | shipped | 27 | 27 | 100% | 3.51 | 59 | 279 | 0 | 0 | 0 | 0 |
| haiku-4-5 | bare | 87 | 62 | 71% | 0.47 | 56 | 220 | 0 | 0 | 0 | 0 |
| haiku-4-5 | shipped | 87 | 69 | 79% | 0.46 | 41 | 190 | 0 | 0 | 0 | 0 |
| opus-5-5 | bare | 27 | 27 | 100% | 1.58 | 65 | 230 | 0 | 0 | 0 | 1 |
| opus-5-5 | shipped | 27 | 27 | 100% | 1.31 | 43 | 170 | 0 | 0 | 0 | 1 |
| opus-5 | bare | 60 | 60 | 100% | 1.82 | 46 | 196 | 0 | 0 | 0 | 1 |
| opus-5 | shipped | 60 | 60 | 100% | 1.94 | 37 | 170 | 0 | 0 | 0 | 1 |
| sonnet-5 | bare | 87 | 83 | 95% | 1.24 | 45 | 170 | 0 | 0 | 2 | 2 |
| sonnet-5 | shipped+plan | 9 | 9 | 100% | 0.68 | 33 | 111 | 2 | 1 | 0 | 2 |
| sonnet-5 | shipped | 87 | 86 | 99% | 0.90 | 31 | 112 | 3 | 3 | 0 | 1 |

## Harness delta (shipped − bare pass rate) by model

| model | bare | shipped | delta | shipped+plan |
|---|---|---|---|---|
| fable-5-1 | 100% | 100% | 0 pp | –% |
| haiku-4-5 | 71% | 79% | 8 pp | –% |
| opus-5 | 100% | 100% | 0 pp | –% |
| opus-5-5 | 100% | 100% | 0 pp | –% |
| sonnet-5 | 95% | 99% | 3 pp | 100% |

## Plan loop (shipped+plan cells)

Medians per cell; verified steps = distinct step ids `plan:verify` reported verified.

| task | model | cells | ran plan:next | median plan:next calls | median git commits | median verified steps |
|---|---|---|---|---|---|---|
| comments-moderation | sonnet-5 | 3 | 3 | 1.0 | 0.0 | 0.0 |
| post-tags | sonnet-5 | 3 | 3 | 1.0 | 0.0 | 0.0 |
| scheduled-publish | sonnet-5 | 3 | 3 | 2.0 | 2.0 | 0.0 |

## Per task (pass / cells)

| task | cat | diff | fable-5-1 bare | fable-5-1 shipped | haiku-4-5 bare | haiku-4-5 shipped | opus-5-5 bare | opus-5-5 shipped | opus-5 bare | opus-5 shipped | sonnet-5 bare | sonnet-5 shipped | sonnet-5 shipped+plan |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| api-posts-contract | feat | M | – | – | 0/3 | 0/3 | – | – | 3/3 | 3/3 | 1/3 | 3/3 | – |
| auto-excerpt | feat | E | – | – | 3/3 | 3/3 | – | – | 3/3 | 3/3 | 3/3 | 3/3 | – |
| comments-moderation | feat | H | 3/3 | 3/3 | 2/3 | 3/3 | 3/3 | 3/3 | – | – | 3/3 | 3/3 | 3/3 |
| cover-attachment | feat | H | 3/3 | 3/3 | 0/3 | 0/3 | 3/3 | 3/3 | – | – | 3/3 | 3/3 | – |
| dashboard-stats | feat | E | – | – | 3/3 | 3/3 | – | – | 3/3 | 3/3 | 3/3 | 3/3 | – |
| health-db-probe | feat | E | – | – | 3/3 | 3/3 | – | – | 3/3 | 3/3 | 3/3 | 3/3 | – |
| i18n-ja-catalog | feat | M | – | – | 2/3 | 3/3 | – | – | 3/3 | 3/3 | 3/3 | 3/3 | – |
| json-api-tokens | feat | H | 3/3 | 3/3 | 2/3 | 3/3 | 3/3 | 3/3 | – | – | 3/3 | 3/3 | – |
| locale-switch | feat | H | 3/3 | 3/3 | 0/3 | 0/3 | 3/3 | 3/3 | – | – | 3/3 | 3/3 | – |
| mass-assignment-author | sec | M | – | – | 3/3 | 3/3 | – | – | 3/3 | 3/3 | 3/3 | 3/3 | – |
| missing-authorize-destroy | sec | E | – | – | 3/3 | 3/3 | – | – | 3/3 | 3/3 | 3/3 | 3/3 | – |
| newsletter-module | feat | H | 3/3 | 3/3 | 0/3 | 1/3 | 3/3 | 3/3 | – | – | 1/3 | 3/3 | – |
| open-redirect-login | sec | M | – | – | 3/3 | 2/3 | – | – | 3/3 | 3/3 | 3/3 | 3/3 | – |
| pagination-skips-page | bug | E | – | – | 3/3 | 3/3 | – | – | 3/3 | 3/3 | 3/3 | 3/3 | – |
| post-revisions | feat | H | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | – | – | 3/3 | 3/3 | – |
| post-slug-binding | feat | H | – | – | 2/3 | 3/3 | – | – | 3/3 | 3/3 | 3/3 | 3/3 | – |
| post-tags | feat | H | 3/3 | 3/3 | 1/3 | 2/3 | 3/3 | 3/3 | – | – | 3/3 | 3/3 | 3/3 |
| posts-agent-tool | feat | H | 3/3 | 3/3 | 0/3 | 1/3 | 3/3 | 3/3 | – | – | 3/3 | 2/3 | – |
| published-flag | feat | M | – | – | 1/3 | 3/3 | – | – | 3/3 | 3/3 | 3/3 | 3/3 | – |
| put-redirect-302 | bug | M | – | – | 3/3 | 3/3 | – | – | 3/3 | 3/3 | 3/3 | 3/3 | – |
| rate-limit-login | feat | E | – | – | 3/3 | 3/3 | – | – | 3/3 | 3/3 | 3/3 | 3/3 | – |
| raw-body-no-validation | sec | E | – | – | 3/3 | 3/3 | – | – | 3/3 | 3/3 | 3/3 | 3/3 | – |
| resource-drops-excerpt | bug | E | – | – | 3/3 | 3/3 | – | – | 3/3 | 3/3 | 3/3 | 3/3 | – |
| route-wildcard-404 | bug | M | – | – | 3/3 | 2/3 | – | – | 3/3 | 3/3 | 3/3 | 3/3 | – |
| scheduled-publish | feat | H | 3/3 | 3/3 | 3/3 | 2/3 | 3/3 | 3/3 | – | – | 3/3 | 3/3 | 3/3 |
| search-orwhere-leak | bug | M | – | – | 3/3 | 3/3 | – | – | 3/3 | 3/3 | 3/3 | 3/3 | – |
| typed-form-register | feat | M | – | – | 2/3 | 3/3 | – | – | 3/3 | 3/3 | 3/3 | 3/3 | – |
| unmounted-routes-file | bug | M | – | – | 3/3 | 3/3 | – | – | 3/3 | 3/3 | 3/3 | 3/3 | – |
| welcome-mail-job | feat | H | – | – | 2/3 | 2/3 | – | – | 3/3 | 3/3 | 3/3 | 3/3 | – |

## Non-standard outcomes

| cell | status | terminal reason |
|---|---|---|
| welcome-mail-job/sonnet-5-bare-3 | PASS | max_turns |
| post-slug-binding/sonnet-5-bare-1 | PASS | max_turns |

