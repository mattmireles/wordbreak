---
name: build-vs-buy
description: Decide whether to adopt an open-source library or build in-house before committing to a design. Use when scoping a feature, writing a plan, evaluating architecture, or when the user suggests implementing infrastructure, parsing, UI primitives, SDK wrappers, or other reusable capabilities from scratch. Runs a short OSS scan (WebSearch), shortlists candidates, and records a dependency cost note. Prefer zero-dependency, browser-safe choices that keep Wordbreak a single HTML file when possible.
---

# Build vs Buy

## Purpose

Quick "does this already exist?" pass before inventing a custom implementation.

Default bias:

- Prefer a well-supported library when it clearly fits **and** earns its weight.
- Prefer building in-house when fit is weak, heavy, abandoned, unsafe, or more
  complex than it removes.
- In **Wordbreak**, prefer **no new dependency** and keep the product a
  **single static HTML file** unless a library clearly beats that constraint.

## Use When

- Scoping a feature or writing a plan.
- Proposing reusable capability architecture.
- The work smells like something OSS already solved.

## Do Not Use When

- Obviously app-specific product logic.
- The repo already has an established approach.
- User wants scratch implementation regardless.
- A five-minute search would cost more than the code.

## Procedure

1. Define the capability in one sentence.
2. List non-negotiables (runtime, license, size, features).
3. Short WebSearch for established options.
4. Shortlist at most **3** candidates.
5. Reject weak fits quickly.
6. Recommend: **Use library** / **Wrap library** / **Build from scratch**.
7. Include a one-paragraph **dependency cost note**.

Keep it to **5–15 minutes**.

## Wordbreak filters (apply early)

- Works in a plain browser with no build step when possible
- No Node-only / native binary assumptions
- Tiny API surface; easy to delete later
- Does not force a bundler, framework, or account/server
- Beats a small local implementation on total maintenance cost

## Recommendation Format

```md
Capability: <one sentence>

Candidates:
- <library 1> - promising / rejected because …
- <library 2> - …
- <library 3> - …

Decision:
- Use library / Wrap library / Build from scratch

Why:
- <2-4 concrete reasons>

Dependency cost note:
- <bundle/runtime impact, transitive deps, lock-in>

Next step:
- <what to plan or implement next>
```

## Handoff

- During planning: record the decision + cost note in the plan.
- During implementation: adopt the choice or note why custom won.
