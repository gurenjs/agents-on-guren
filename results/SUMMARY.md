# Agents on Guren — results (360 cells)

## Pass rate by model × condition

| model | condition | cells | pass | pass rate | median cost (USD) | median turns | median wall (s) |
|---|---|---|---|---|---|---|---|
| haiku-4-5 | bare | 60 | 51 | 85% | 0.33 | 40 | 156 |
| haiku-4-5 | shipped | 60 | 54 | 90% | 0.35 | 34 | 151 |
| opus-5 | bare | 60 | 60 | 100% | 1.82 | 46 | 196 |
| opus-5 | shipped | 60 | 60 | 100% | 1.94 | 37 | 170 |
| sonnet-5 | bare | 60 | 58 | 97% | 1.84 | 54 | 216 |
| sonnet-5 | shipped | 60 | 60 | 100% | 1.33 | 38 | 143 |

## Harness delta (shipped − bare pass rate) by model

| model | bare | shipped | delta |
|---|---|---|---|
| haiku-4-5 | 85% | 90% | 5 pp |
| opus-5 | 100% | 100% | 0 pp |
| sonnet-5 | 97% | 100% | 3 pp |

## Per task (pass / cells)

| task | cat | diff | haiku-4-5 bare | haiku-4-5 shipped | opus-5 bare | opus-5 shipped | sonnet-5 bare | sonnet-5 shipped |
|---|---|---|---|---|---|---|---|---|
| api-posts-contract | feat | M | 0/3 | 0/3 | 3/3 | 3/3 | 1/3 | 3/3 |
| auto-excerpt | feat | E | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| dashboard-stats | feat | E | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| health-db-probe | feat | E | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| i18n-ja-catalog | feat | M | 2/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| mass-assignment-author | sec | M | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| missing-authorize-destroy | sec | E | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| open-redirect-login | sec | M | 3/3 | 2/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| pagination-skips-page | bug | E | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| post-slug-binding | feat | H | 2/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| published-flag | feat | M | 1/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| put-redirect-302 | bug | M | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| rate-limit-login | feat | E | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| raw-body-no-validation | sec | E | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| resource-drops-excerpt | bug | E | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| route-wildcard-404 | bug | M | 3/3 | 2/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| search-orwhere-leak | bug | M | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| typed-form-register | feat | M | 2/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| unmounted-routes-file | bug | M | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| welcome-mail-job | feat | H | 2/3 | 2/3 | 3/3 | 3/3 | 3/3 | 3/3 |

## Non-standard outcomes

| cell | status | terminal reason |
|---|---|---|
| welcome-mail-job/sonnet-5-bare-3 | PASS | max_turns |
| post-slug-binding/sonnet-5-bare-1 | PASS | max_turns |

