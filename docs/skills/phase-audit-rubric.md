# Phase-audit rubric

## Standard `phase-audit` / `execute-plan`

A phase is commit-ready when:

- Plan checklist items for the phase are done or explicitly deferred with reason
- Findings from `phase-audit` are addressed or explicitly accepted
- Manual smoke covers the changed Wordbreak loop when UI/curriculum behavior changed
- No silent curriculum ↔ `wordbreak_v2.html` drift introduced by the phase

Letter grades are **not** required for a standard phase pass. Report
severity-ordered findings and an explicit **complete / not-complete** call.

## `execute-plan-hardcore` / `audit-fix-loop`

These explicit workflows additionally require:

- Architecture grade: **A**
- Correctness risk grade: **A**
- Complexity debt grade: **A**

Use the `audit` skill charters for those graded gates. Favor single-file HTML
clarity and honest curriculum contracts.
