# WORDBREAK
### a spelling game for a strong reader who spells like the codebase is broken — because, in a way, it is

**Live:** https://matt.pagesumo.com/wordbreak
**Built for:** Luca, 14
**Format:** one HTML file, no install, no account, no server. Progress saves to the browser it's opened in.

---

## 1. The one-sentence pitch

English spelling isn't phonetic — it's **legacy code**: three systems (sound, meaning, history) bolted together over 1,400 years, and when they conflict, meaning and history usually win. Wordbreak doesn't teach "sound it out." It teaches you to **read the source** — find the part of the word that still remembers why it's spelled that way, and pull that thread.

## 2. The frame, and why it isn't "detective"

Early design passes used a noir/detective skin — "witnesses," "confessions." It tested fine in the abstract but didn't fit *this* kid. Luca lives in Minecraft, AI, and hacking. So the skin changed, but the mechanic underneath — flag the thing you don't trust, then interrogate it — stayed identical. That mechanic was never the detective's; it's just what verification looks like.

So: English is **legacy code**. A misspelling is a **compile fault**. A word you're unsure of has a **byte you don't trust**. Finding the rule that explains a letter is **pulling the source**. Words with no rule at all — pure borrowings, pure irregulars — are **legacy files**, filed honestly as unpatchable, not dressed up as something they're not.

This matters for reasons beyond theming. **Honesty about which words are NOT rule-governed is what makes the rules you DO teach trustworthy.** A kid who catches the app pretending "yacht" follows a pattern will stop trusting it about the patterns that are real.

## 3. The core loop — four beats, always in this order

Every single word in every single module runs the same four beats. This consistency is deliberate: the *content* changes every word, the *procedure* never does, so the procedure has a chance to become automatic.

**① TYPE** — a prompt appears (a word-sum like `sub + port`, a spoken clue, or a transform like `box → plural`). Type the build from scratch. No multiple choice, anywhere in the app — recognition isn't the skill that's broken; production is.

**② FLAG** — the typed word explodes into individual letter-cells. Before anything is checked, **you must click the one cell you trust least.** This is the whole game's core verb — everything else is scaffolding around this one moment. It's a bet: "if this word is wrong, I think it's wrong *here*."

**③ EXECUTE** — the compiler runs. Two things are scored independently:
   - Is the spelling **clean** (correct)?
   - Was the flag **aimed** at a byte that was actually live — a real point of uncertainty in that specific word (a schwa, a doubling boundary, a seam)?

   Good aim is rewarded regardless of whether the spelling was right. **That's the point.** A kid who's wrong but knows exactly where his doubt belongs is doing something more valuable than a kid who's right by luck. Bad aim on a wrong word gets the answer *handed flat* — no interrogation, no reward, just the fact. The lesson: doubt has to go somewhere specific, or it doesn't earn you anything.

**④ FORK or PATCH** — good aim opens one of three investigation types (below). Bad aim (or a lazy flag) skips straight to typing the correct word once, from a flat answer. Either path ends the same way it should: **his fingers, not his eyes, close it out.** Nothing is ever "shown" as a final step — it's always re-typed.

## 4. The three fork types — different diseases, different cures

This is the part that makes the app more than a drill. A miss is diagnosed, and the diagnosis decides what happens next.

### The Interrogation (rule words — doubling, prefixes, roots, assimilation)
A short chain of yes/no or multiple-choice questions that **is** the rule, walked step by step — "one syllable? one final consonant? one vowel before it? then double." Answer wrong and it explains why before letting you continue; it never just marks you wrong and moves on. Ends in a verdict line stating the rule as applied to that exact word.

### Pull the Source (schwa words — the Anchor move)
For words where the vowel sound gives you *zero* information (definite, grammar, president — the "uh" could be any letter), you're shown a lineup of related words and have to pick which one **wakes the dead vowel up** by putting stress on it.

- `definite` → pull `definition`: **def·i·NI·tion** — stress lands right on the sleeping vowel. It speaks: *i*.
- Distractor #1 is a **silent relative** — genuinely in the family, but the vowel stays asleep in it too (`definitely` doesn't help; it's still "def-uh-nit-ly"). This one exists specifically so aiming at *any* relative isn't the win — the witness has to actually testify.
- Distractor #2 is an **impostor** — looks related, isn't (`defend` shares four letters with `definite` and nothing else).

Four such lineups exist right now (definite, grammar, president, medicine), each hand-checked against real stress patterns — a wrong witness would teach a wrong letter with total confidence, which is worse than teaching nothing.

### The Legacy File (true irregulars — outlaw words)
For words with no rule to find — Wednesday, colonel, yacht, restaurant — the app doesn't pretend. It shows the word with the untrustworthy letters visibly marked, says plainly *"no source exists for this one — this is memory,"* and asks for a straight re-type after a cover. No manufactured mnemonic where none is honest.

## 5. The Patch phase — where the fingers do the final work

Whichever fork you were in, the game ends in **Patch**: retype the whole word correctly, with the source (rule verdict, witness's stressed syllable, or the dark bytes) still visible for reference. Get it wrong three times and the answer is shown once, briefly, then taken away again — you still have to type it after seeing it. The screen never "moves on" from a wrong word until it's been typed right.

## 6. The map — 8 stages, 48 modules

| Stage | Focus | For Luca |
|---|---|---|
| 1 | Anglo-Saxon foundation (short vowels, digraphs, silent-e, true irregulars) | **Skip** — he's already surpassed this; forcing it wastes time and reads as babying him |
| 2 | The morpheme frame (doubling, drop-e, y-to-i, past-tense -ed) | Worth a fast pass — the doubling/drop-e machinery underpins everything later |
| 3 | Prefixes (seams, position words, meaning) | Quick, easy wins |
| 4 | Latin roots (port, struct, spect, dict, scrib/script, mit/miss, cede/ceed…) | **Start here.** Warm-up with real payoff — one root unlocks a dozen words |
| 5 | The double-letter decoder — assimilated prefixes | **The crown jewel.** Converts "how many letters??" into arithmetic he can re-derive. `accommodate` = ad+com+modate, computed, not memorized |
| 6 | The schwa frontier — the Anchor & the Restore | **His real work.** This is where his actual errors cluster |
| 7 | Greek combining forms (photo, tele, -logy, -meter) | Independent — slot in anytime, good vocabulary payoff |
| 8 | Synthesis — monster-word decomposition, outlaws, homophones | Capstone, needs 4+5+6 first |

Every module: 4 teaching panels (with a small interactive check at the end — you can't open the run without typing the panel's example word first) → then 4 words run through the full loop above.

**The home screen states the recommended route out loud** — skip 1–3, warm up in 4, live in 5 and 6 — rather than making him guess or forcing him through a strict ladder.

## 7. What's deliberately *not* in here

- **No timer, anywhere.** A timer rewards speed, and his actual bug is speed — grabbing the first plausible spelling without a second look. Rewarding speed would train the exact failure mode this app exists to fix.
- **No points, badges, streaks-as-currency, or leaderboard.** Extrinsic reward loops measurably undermine intrinsic motivation on tasks like this, and worse for teenagers. Progress is just: which modules say CLEARED.
- **No multiple-choice spelling, ever.** Recognition and production are different skills; his deficit is in production, so that's the only thing tested.
- **No mascots, no cartoon feedback, no baby-talk.** A stigma-sensitive 14-year-old abandons tools that feel like they're diagnosing him. It reads as a terminal, not a workbook.

## 8. The session log & the observer notes

Every run logs each word with three columns: first build (clean/faulted), aim (live/cold), and solve type (earned / handed / booked). This isn't for grading him — it's for **you**, to see whether the flag moment is doing its job over time (aim improving = the verification habit is migrating into his head, which is the actual goal of the whole app).

The debrief screen also carries five standing questions for whoever's watching him play — does he pause before flagging or tap on reflex, does the "handed flat" outcome register as a real loss, does he re-run the checklist himself on a patch without being told. None of this is shown to Luca; it's the parent/observer's screen.

## 9. Technical notes

- Single HTML file, vanilla JS, no build step, no dependencies, no network calls after load.
- Progress (`docs read`, `cleared` modules, full word-level log) persists via `localStorage` under key `wb2` — tied to the browser/device it's opened in, not an account. Clearing browser data resets it.
- Hosted at a stable Pagesumo URL, so localStorage now has a permanent home to persist against (previously true only of the local prototype file).
- All 48 modules were structurally validated before publish — every word's answer contains at least one genuinely "hot" (uncertain) byte, every rule-fork has a valid verdict, every schwa lineup has exactly one witness plus one silent relative plus one impostor, every legacy word has its dark bytes marked.

## 10. Roadmap (not built yet)

- **Personal word deck**: seed the app with Luca's actual misspellings, auto-classified into the error types this system already knows about, spaced on a Leitner/SM-2 schedule.
- **AI-generated word variety** on top of the fixed curriculum — but only ever generating *more examples of a verified pattern*, never inventing new witness pairs or etymologies unsupervised. A wrong witness is worse than no witness.
- Everything above is explicitly future work — v0.2 is the full 48-module curriculum, hand-built and checked, and that's what's live now.

---

*"Never flash the answer. Hand the move." That's the whole design in one line — everything above is just what it takes to keep that promise for 48 modules instead of 2.*
