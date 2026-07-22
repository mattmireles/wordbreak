# COORD.md — session coordination ledger

Append-only, newest at the bottom, one line per substantive prompt when its work
lands: `- [YYYY-MM-DD HH:MMZ] [session-or-lane] <what was asked> -> <what landed> | evidence: <exit code / commit / path / status>`.
Honest entries only: in-progress is "in progress", untested is "untested". Compact
to COORD-ARCHIVE.md at ~40 ledger lines. In a fable-director arrangement, lane
blackboards live beside this file as COORD-<LANE>.md; this file is the ship/main ledger.

## LEDGER
- [2026-07-22 18:55Z] [hook] COORD.md scaffolded by oracle-suite SessionStart
- [2026-07-22 19:00Z] [main] plan-003 migration check: what happens to an existing save (lessons already read/cleared)? -> verified no data loss + read-but-uncleared modules skip re-teaching and go straight to practice | evidence: seeded pre-003 wb2 blob (7 docs, 2 cleared, 3 sched, 2 codes) in browser; docs/cleared/sched/codes/log all preserved, cfg/session/sessions init alongside; compiled blocks = 3 rev + mod 1.3(pc=0, 6min) + 1.4/1.5/1.6(pc=4, 10min); enterBlock(1.3)->screen "run" (no lesson), enterBlock(1.4)->screen "docs"; map shows CLEARED + 3 docs links, no LEARNED chip
- [2026-07-22 19:28Z] [main] git-commit -> committed COORD.md ledger as c267685 (COORD-AGENTS.md deliberately excluded: hook-generated, absolute local paths) | evidence: git show --stat HEAD = 1 file changed, 11 insertions; branch ahead of origin by 1
