# Spelling That Survives a Second Look

**How Wordbreak teaches — and what it teaches.**

A strong reader can still spell like a fourth-grader. Not because the kid is careless. Because English fails in three different ways, and the kid grabs the first plausible spelling without checking. This document is the whole system: **why** that happens, **how** the engine responds, and **what** gets taught, in order.

---

## How to read this

| Part | Job |
|---|---|
| **I — Methodology** | The diagnosis, the Moves, the error codes, the loop |
| **II — Curriculum** | The eight stages, the unit schema, the placement router |
| **III — Build phases** | What to ship first (named *phases*, never “stages”) |

Prefer one home for each rule. Exemplars may repeat a script for teaching. Checklist: Do / Don't at the end of Part I.

---

# Part I — Methodology

## The Big Idea

**Teach the rule or the relative first. Then force a real second look. On a miss, hand a Move or a rule — never flash the answer.**

Spelling failure for this profile is three problems on three kinds of words, plus one habit on top of all of them:

1. **Regular words** (*cat, stomp*) — mostly already owned. Sound maps cleanly to letters. A ground-up phonics program wastes months here.
2. **Rule-governed words** (*picnic, running, tension*) — a real knowledge gap. Conditional rules must be **taught**, not merely checked. You can write *picknic* only if you half-know the *ck* rule.
3. **Schwa words** (*definite, separate*) — no phonics answer. The unstressed vowel carries no sound information. Only morphology (find the stressed relative) or raw memory works.
4. **Verification gap** — across all three, the kid commits to hypothesis #1 without a second pass. Verification delivers knowledge. It cannot invent knowledge the kid was never given.

**Teach orthographic rules + morphology. Do not call it phonics.** Phonics points the designer back at sound-to-letter mapping — the one skill this profile already has.

**Done means functional, not perfect:** spellcheck's top suggestion is correct, and spelling no longer eats working memory during composition. Practice is typed.

---

## Why a strong reader spells this badly

Reading and spelling can dissociate. A learner can decode *into* a word and still fail to retrieve the exact letter string *out* of memory — stored orthographic representations are weak and underspecified (Wimmer et al.; Ehri's orthographic mapping). Reading is convergent; spelling is divergent and harder.

Rapid naming and sequential memory are often weak in this profile. Naming speed is not reliably trainable into the normal range — **compensate** (targeted automaticity, keyboard, spellcheck), don't try to "fix" it.

Errors cluster where phonics cannot reach: conditional conventions (Slice 2) and schwa (Slice 3). The right frame is explicit rule + morphology instruction, delivered so the kid actually verifies against it.

---

## The core loop

Every practice item runs this sequence. No shortcuts.

1. **Brief** — short worked example of the rule (Slice 2), the meaning-relative (Slice 3), or an honest memory anchor (E11 / outlaw)
2. **Produce** — type from memory, in a sentence (never multiple choice; never isolated flashcards as the main task)
3. **Look again** — mandatory, cognitively real second check (⓪ below). Require an action: name the unsure letter, check a named relative, or read letter-by-letter. A 300 ms tap is theater.
4. **On a miss — hand the Move or the rule first** — never open with the finished spelling
5. **Self-correct + tag the E-code** — keep E1 and E2 separate; never a vague "schwa?" bucket
6. **If still wrong → reveal, compare, spotlight the bad grapheme → re-type from memory** — feedback becomes another retrieval rep

> **Go/no-go:** if Look-Again feels like a nagging chore, the product has failed. Prototype that moment before adding features.

---

## The Three Moves (+ the universal beat)

The game does not teach word lists. It teaches **three transferable second-checks** — and one universal habit. These are specific, teachable *verifications*.

| Move | When | How |
|---|---|---|
| **① Anchor** | Wrong letter for /ə/ (E1) | Find the relative where the vowel is **stressed**. *definate?* → *definITion* → **definite**. *grammer?* → *grammatical* → **grammar**. |
| **② Restore** | Swallowed syllable (E2) | Say the careful pronunciation, count syllables, spell the one speech drops. *famly?* → *fa‑mi‑ly* → **family**. |
| **③ Arithmetic** | Doubles at prefix/root seams (E5, E7) | Double letters are **prefix + root math**. *acommodate?* → *ad + com + modate* → **accommodate**. *mispell?* → *mis + spell* → **misspell**. |
| **⓪ Look-Again** | Everything | **Predict → commit → check.** Read it back letter by letter. Ask: does each part come from a part I know? |

**Honesty about coverage:** not every miss is a Move. **E3/E4** need the doubling checklist (Stage 2) — random over-doubling is *not* prefix arithmetic. E6 needs suffix-boundary rules. E8 needs root-family pairing. E9 needs Greek signals. E10 needs meaning. E11 needs spaced memory. Correction scripts hand a **Move or a rule**.

---

## The error taxonomy

Error *quality* is the diagnosis — not miss count. A kid at 8/10 with every miss E1 has a different problem than a kid at 8/10 with scattered codes. The engine serves more of whatever is breaking.

| Code | Name | Looks like | Fix |
|---|---|---|---|
| **E1** | Schwa-substitution | *definate, seperate, grammer* | ① Anchor |
| **E2** | Swallowed syllable | *famly, vegtable, diffrent* | ② Restore |
| **E3** | Over-doubling | *picknic, beggining* | Doubling checklist (Stage 2); *picknic* → unit **1.3** or **2.0** if Stage 1 skipped — not Move ③ |
| **E4** | Under-doubling | *runing, stoping* | Doubling checklist (1-1-1), incl. stressed last syllable (*begin → beginning*) |
| **E5** | Assimilation-blind | *acommodate, agressive, ilegal* | ③ Arithmetic |
| **E6** | Suffix-rule overapplied | *truely, nineth* | Suffix-boundary rules |
| **E7** | Morpheme-boundary error | *mispell, disapear, roomate* | ③ Arithmetic (keep both) |
| **E8** | Variant-root confusion | *permition, recieve* | Root-family + coat pairing (coat = variant spelling of one root) |
| **E9** | Origin-marker miss | *foto, rithm, sikology* | Greek signals |
| **E10** | Homophone / meaning miss | *their/there, principal/principle* | Meaning → spelling |
| **E11** | True irregular | *said, friend, Wednesday, yacht* | Spaced retrieval (outlaw path) |

**Keep E1 and E2 separate in data and in the tag UI.** Both feel like "schwa" to a naive designer. Conflating them leaves half the misses untreated: E1 is a wrong *letter*; E2 is a missing *syllable*.

**Self-analysis tags must use E-codes** (or clear E1/E2/E5… labels) — not a single bucket labeled "schwa."

---

## Slices map onto curriculum stages

| Content slice | Where the curriculum attacks it |
|---|---|
| Slice 1 — regular | Curriculum Stage 1 (skippable if decoding is above grade level) |
| Slice 2 — rule-governed | Stages 2–5 (inflection, prefixes, roots, assimilation) |
| Slice 3 — schwa | Stage 6 (main line); morphology fuel from Stage 4 |
| Outlaw / E11 | Spaced path from intake (via 1.7 if Stage 1 is live; else outlaw queue); Stage 8.2 adds harder borrowings |
| Greek markers / E9 | Stage 7 (floats; slot by diagnostic need) |

---

## What the research actually requires (once)

- **Worked examples before testing** (Sweller) — without this spine, the app is an assessment in an instruction costume.
- **Production retrieval** — type from memory; multiple-choice "spelling" trains the wrong process (Roediger & Karpicke).
- **Self-correction after each word** — Horn (1947); still the strongest single spelling tactic.
- **Spacing + interleaving** — SM-2/Leitner on error words; introduce a pattern in a short block, then interleave competitors (Cepeda; Rohrer & Taylor).
- **Morphology for schwa** — transfers to untrained spellings; converts memory into reasoning for a strong verbal kid (Bowers et al.).
- **Borrow OG's explicitness; skip sand-tracing as the "active ingredient"** — the multisensory claim lacks unique empirical support. Full OG sequences built for non-decoders waste months on Slice 1.
- **Autonomy over points** — expected tangible rewards crowd out intrinsic motivation (Deci et al.). Mature tool aesthetics; no mascots, no leaderboards, no speed prizes. Speed rewards train the verification bug.

---

## Do / Don't

| Do | Don't |
|---|---|
| Brief before testing; then the core loop above | Review errors without teaching the pattern |
| Dictation in a sentence, typed | Multiple choice or isolated recognition |
| Accuracy + correct error-behavior = mastery | Speed rewards or timed practice **before** mastery (optional self-charted fluency only after — Phase 4) |
| Mature, tool-like UI; kid owns words and settings | Mascots, baby talk, points, badges, leaderboards |
| Open outlaw path for *yacht, colonel, of* (E11) | Promise every word "confesses under questioning" |
| Compensate for weak automaticity | Try to "fix" naming speed; grit-shame the kid |

---

# Part II — Curriculum

*Not a word list. A teaching system. Every unit is a game level; every field below is data the game reads.*

## Why English looks insane (and isn't)

English spelling is **morphophonemic** — sound, meaning, and history at once. When they conflict, meaning and history usually win. The silent *g* in *sign* looks broken until *signal, signature, designate*. *Two* keeps a dead *w* because of *twin, twice, twelve*. A kid who thinks spelling = "guess letters for sounds" loses forever at the schwa. A kid who learns words are **built from meaning-parts** generates thousands of correct spellings from a few hundred parts.

A workbook can hold the right roots and still fail on delivery: no feedback loop, no adaptivity, nothing to *do*. The curriculum encodes teaching in three places — **correction scripts**, **verification beats**, and **error-type targeting**. Those are the product.

---

## Unit schema (every level carries these nine fields)

When a unit ships in the game, it carries all nine fields below. Stage tables are **indexes** — unit ID, rule installed, target E-codes — plus exemplars that show script/beat shape. Fill every field; do not ship hollow levels that only know the rule name.

1. **Morpheme(s)** — meaning-part(s), with meaning + layer (Anglo-Saxon / Latin / Greek)
2. **Rule installed** — the explicit principle (for true irregulars: "memory anchor," said honestly)
3. **Etymology hook** — the story a bright kid shows up for
4. **Word set (tiered)** — Tier 1 transparent → Tier 2 schwa-loaded → Tier 3 assimilated/complex. **Seeds** (a few per tier); the game generates more at the kid's level
5. **Target error(s)** — E-codes this unit attacks (or "foundational / no E-code")
6. **Correction script** — the line spoken on a miss. Never the answer first; the Move or rule
7. **Verification beat** — predict → commit → check for this unit
8. **Mastery** — accuracy **and** correct error-behavior. Never speed
9. **Dictation frame** — every production item is a **sentence**, not an isolated word (matches the core loop)

### Fully filled exemplar — Unit 6.2 (① Anchor)

Use this as the template when expanding any index row into game data.

1. **Morpheme(s):** — (technique unit; any Latin/Anglo root that has a stressed relative)
2. **Rule installed:** Can't hear the vowel → find the relative where it's stressed. The stressed form tells you the letter.
3. **Etymology hook:** The buried vowel isn't gone — it's asleep. Wake it in the cousin where it's shouting.
4. **Word set:** T1 *definite→definition, compete→competition* · T2 *grammar→grammatical, medicine→medicinal* · T3 *president→presidential, category→categorical*
5. **Target error(s):** E1
6. **Correction script:** "You wrote *definate*. Say *definITion* — hear the *i*? That's your vowel: **definite**." (Hand the anchor. Do not open with the spelling.)
7. **Verification beat:** On any /ə/ vowel, search for a stressed relative before committing.
8. **Mastery:** Finds a usable anchor and corrects 8/10 (honest bar — this is hard).
9. **Dictation frame:** e.g. "She was *definite* about the answer." — always a sentence.

---

## Placement diagnostic (the router)

Short typed dictation in sentences (~15–20 words). Words are **tripwires** — each chosen to expose a specific error type. Route by **where errors cluster**, not raw count.

| Stage tested | Clean tripwire | Loaded tripwire | Exposes |
|---|---|---|---|
| 1 — Anglo-Saxon base | *catch, brush* | *friend, would* | digraphs / E11 |
| 2 — Inflection | *hopping, played* | *carried, running* | E3 / E4 / E6 |
| 3 — Prefixes | *unhappy, preview* | *misspell, disappear* | E7 seams |
| 4 — Latin roots | *inspect, transport* | *permission, reception* | E8 variants |
| 5 — Assimilation | *illegal, support* | *accommodate, aggressive* | E5 |
| 6 — Schwa | *doctor, teacher* | *definite, separate, family* | E1 + E2 |
| 7 — Greek | *photo, telephone* | *rhythm, psychology* | E9 |
| 8 — Meaning / residue | *their* (in sentence) | *principal/principle, stationery* | E10; E11 if *yacht*-class |

**Routing** — two layers. (1) **Entry stage** from the first hard cluster. (2) **Side queues** that can run alongside the main line.

**Entry (convention: clean through *N−1*, breaks on Stage *N*'s tripwire → enter Stage *N*):**

- Breaks on digraphs / vowel teams → enter **Stage 1**
- Clean through 1, breaks on doubling / drop-e → enter **Stage 2**
- Clean through 2, breaks on seams (E7) → enter **Stage 3** (advance to 4 when seams are solid)
- Clean through 3, breaks on variant roots (E8) → enter **Stage 4**
- Clean through 4, breaks on assimilation (E5) → enter **Stage 5**
- Clean through 5, breaks only on schwa (E1/E2) → enter **Stage 6** directly
- Greek (E9) never blocks the Latin chain; slot Stage 7 anytime after Stage 3

**Side queues / parallel tracks (start when the code appears — do not wait for Stage 8):**

- **Schwa (E1/E2):** open **Stage 6** as soon as Stage 4 is underway (Anchor needs roots). Do **not** wait to "finish" Stage 5. If schwa is the dominant cluster, Stage 6 is the **main line**; Stages 4–5 continue in parallel for fuel.
- **E11 irregulars:** if Stage 1 is entered, teach via **1.7**; if Stage 1 is skipped, seed the **outlaw spaced path** immediately. Stage **8.2** adds harder borrowings later — same path, harder words.
- **E10 homophones:** open **8.3** as a side queue from intake (meaning → spelling). Does not require finishing 4+5+6 first.
- **Stage 8.1** (monster decomposition) alone requires 4+5+6. That is the only hard gate on Stage 8.

**Also at intake — Slice 1 spot-check:** 6–8 single-syllable regulars (*cat, stomp, blend, print, jump, brush*). If more than ~20% miss, enter Stage 1 before any skip. If clean, Stage 1 is skippable.

**Common landing for this profile:** Stage 1 skippable → test through Stage 2 (fast pass if clean; never skip the machinery) → fast pass Stage 3 if seams are clean → enter Stages 4–5 → **open Stage 6 in parallel as the real work** → E10/E11 side queues from day one.

---

## Curriculum Stage 1 — Anglo-Saxon foundation

*Skippable when decoding is above grade level. Spelling-pattern work, not phonics-from-scratch.*

| Unit | Installs | Targets |
|---|---|---|
| 1.1 Words are built of parts | Base/root as a unit | Foundation |
| 1.2 Closed syllables + FLSZ | Short vowel; double final *f/l/s/z* (*off, ball, pass*) | E3 early |
| 1.3 Digraphs + *ck*/*k* | Final /k/ **immediately after** a short vowel in a one-syllable word → *ck* (*back, sick*). Not after another consonant (*bank, milk, task*). Never insert *ck* into *-ic* words (*picnic*, not *picknic*) | E3 |
| 1.4 Silent-*e* | *e* makes the vowel long (*hop/hope*) | Sets up drop-e |
| 1.5 Vowel teams | Positional (*ay* end / *ai* middle) | Foundational / no E-code |
| 1.6 R-controlled | *er/ir/ur* sound alike — schwa preview | E1 preview |
| 1.7 High-frequency irregulars | Honest memory anchors (*said, would, friend*) | E11 |

**Exemplar script (1.3):** "One syllable, short vowel, and /k/ right after that vowel with nothing between? Then *ck* (*back*). *Bank* and *milk* keep *k* — another consonant sits between. *-ic* word like *picnic*? Never insert *ck*. (Mid-word *ck* in *ticket* is a different pattern — not this unit.)"

---

## Curriculum Stage 2 — Morpheme frame & inflection

***Mandatory for everyone.*** Doubling and drop-e underpin later suffixation. E3/E4/E6 hide here even in strong spellers. **If Stage 1 was skipped**, install unit 2.0 so the *picknic* error has a home.

| Unit | Installs | Targets |
|---|---|---|
| 2.0 *ck* vs *-ic* (if Stage 1 skipped) | Same as 1.3: final /k/ immediately after a short vowel in one syllable → *ck*; not after another consonant (*bank, milk*); never insert *ck* into *-ic* (*picnic*). Mid-word *ck* (*ticket, pocket*) — leave alone here. | E3 |
| 2.1 Base + affixes | Spelling = assemble known parts | Foundation for E3–E8 |
| 2.2 Plural *-s/-es* | *-es* after hissing sounds | E6 |
| 2.3a Doubling (1-1-1) | One syllable (or stress on last), **one short vowel**, one final consonant → double before vowel-suffix (*hop → hopping*; *begin → beginning*). Vowel teams / long vowels do not double (*rain → raining*). | E3, E4 |
| 2.3b Drop-*e* | Drop *e* before vowel-suffix; keep before consonant-suffix; keep *e* after soft *c/g* (*courageous, noticeable*) | E6 |
| 2.3c Y-to-*i* | *carry → carried*; keep *y* before *-ing* | E6 |
| 2.4 Past *-ed* | One spelling, three sounds (/t/, /d/, /əd/) — meaning beats sound | Foundational / no E-code |

**Exemplar beat (2.3a):** Run the 1-1-1 checklist out loud before doubling. Mastery requires both directions — doubles correctly *and* refrains correctly.

---

## Curriculum Stage 3 — Prefixes

Transparent glue-on prefixes. Fast wins. Sets up assimilation. E7 lives here.

| Unit | Installs | Targets |
|---|---|---|
| 3.1 *re-, un-, pre-, dis-, mis-* | Prefix does **not** change the base. *mis + spell = misspell* (both *s*) | E7 |
| 3.2 *sub-, inter-, trans-, super-, non-, over-, under-* | Same glue-on rule; plant *support* (*sub→sup*) as preview | E7 |
| 3.3 *de-, ex-, pro-, com-/con-, in-/im-* | Meaning does work; plant assimilation stars | E7 → E5 |

**Exemplar script (3.1):** "Prefix + base. Keep every letter of both — don't merge, don't drop. *mis* + *spell* = both *s*'s stay."

---

## Curriculum Stage 4 — Latin roots

*The generative engine. Learn one root, unlock a family. Variant "two coats" (E8) is the recurring skill.*

Routine shape for every root unit: meaning → constant spelling → family → keep the root consistent.

| Unit | Root / focus | Targets |
|---|---|---|
| 4.1 *-port-* (carry) | *import, export, support* (*sub→sup* preview) | E7; preview E5 |
| 4.2 *-struct-* (build) | *construct, instruct, infrastructure* | E7 |
| 4.3 *-spect-* (look) | *inspect, respect, retrospect* | E7 |
| 4.4 *-dict-* (say) | *predict, contradict, verdict* | E7 |
| 4.5 *-rupt-* (break) | *erupt, interrupt, corrupt* (*com→cor*) | E7; preview E5 |
| 4.6 *-tract-* (pull) | *subtract, extract, attract* (*ad→at*) | E7; preview E5 |
| 4.7 *-ject-* (throw) | *eject, reject, interject* | E7 |
| 4.8 | *-scrib-/-script-* (first variant pair) | E8 |
| 4.9 | *-duc-/-duct-* | E8 |
| 4.10 | *-mit-/-miss-* (*permition → permission*) | E8 |
| 4.11 | *-vert-/-vers-* | E8 |
| 4.12 | *-cede-/-ceed-/-cess-* (only three *-ceed*: proceed, exceed, succeed; one *-sede*: supersede) | E8, E6 |
| 4.13 | *-ceive-/-cept-* + *i* before *e* except after *c* | E8, E7 |

**Exemplar script (4.8):** "This root has two coats: *scrib* and *script*. Same family — write. Which coat fits the ending here?"

---

## Curriculum Stage 5 — Assimilated prefixes

*Double letters become arithmetic. Move ③ is the content of this stage.*

| Unit | Installs | Targets |
|---|---|---|
| 5.1 Concept | Prefix changes last letter to match the root → most doubles | E5, E7 |
| 5.2 *ad-* | *ad+gress → aggress*; *ad+commodate → accommodate* | E5 |
| 5.3 *in-* | *in+legal → illegal*; *in+possible → impossible* | E5 |
| 5.4 *com-/con-* | *com+lect → collect*; *co-* before vowels | E5 |
| 5.5 *sub-, ex-, ob-* | *sub+port → support*; *ob+pose → oppose* | E5 |
| 5.6 Boss words | *accommodate, unnecessary, embarrass* — decompose; label each double as prefix-match (E5) or seam (E7) | E5, E7 |

**Exemplar script (5.1):** "That double isn't random. *ad + tract* → *at* + *tract* → *attract*. Do the math."

---

## Curriculum Stage 6 — Schwa frontier

*For a schwa-dominant kid, the main line — often parallel with Stages 4–5, not only after them. Moves ① and ② are named skills here.*

| Unit | Installs | Targets |
|---|---|---|
| 6.1 Schwa concept | All five vowels spell /ə/; split E1 (wrong letter) from E2 (missing syllable) | E1, E2 |
| 6.2 ① Anchor | *definite → definition*; *compete → competition*; *president → presidential* | E1 |
| 6.3 ② Restore | *family = fa-mi-ly*; *vegetable = veg-e-table* | E2 |
| 6.4 *-ent/-ant, -ence/-ance, -able/-ible* | **Tendency**, not a hard rule: lean *-able* after a complete word, *-ible* after a bound root; many exceptions → family/memory. *-ence/-ance* mostly family or anchor | E1, E6 |
| 6.5 *-er/-or/-ar, -ary/-ery/-ory* | Latin lean *-or*; native lean *-er*; *-ary/-ery/-ory* often **family cue** (*document / documentary*), not a reliable stressed-vowel Anchor | E1 |

*(Full 6.2 script lives in the unit-schema exemplar above — do not duplicate here.)*

---

## Curriculum Stage 7 — Greek combining forms

*Independent of the Latin chain. The weird spelling is a passport stamp, not a trap. E9 lives here.*

| Unit | Installs | Targets |
|---|---|---|
| 7.1 Greek signals | *ph=/f/, ch=/k/, y, rh, ps, mn, pn* | E9 |
| 7.2 Front forms | *photo-, bio-, geo-, tele-, auto-, micro-, thermo-, hydro-* | E9 |
| 7.3 End forms | *-graph, -logy, -meter, -scope, -phone, -phobia, -pathy* | E9 |
| 7.4 Connecting *-o-* | *therm-o-meter* — don't drop the glue | E2, E9 |
| 7.5 Classical plurals | *crisis→crises, criterion→criteria* (bonus) | Form confusion |

**Exemplar script (7.1):** "That /f/ in a science word? Greek spells it *ph*. *foto* → **photo**. The strange spelling is the clue."

---

## Curriculum Stage 8 — Synthesis & hard cases

*8.1 (monsters) requires Stages 4 + 5 + 6. 8.2 and 8.3 may run earlier as side queues — see placement.*

| Unit | Installs | Targets |
|---|---|---|
| 8.1 Monster words | *incomprehensible = in + com + prehens + ible* — **gated on 4+5+6** | Integrative |
| 8.2 Genuine irregulars & borrowings | *yacht, colonel, restaurant* — memory path, no fake rules (**side queue OK early**) | E11 |
| 8.3 Homophones | Meaning picks spelling (*principal* = your **pal**) (**side queue OK early**) | E10 |

---

## Unlock order (no diagram — placement above is canonical)

- **Stage 1** — skippable if decoding is above grade level
- **Stage 2** — mandatory (fast pass OK if clean); add unit **2.0** if Stage 1 was skipped
- **Stage 3** — unlocks Stage 7 (Greek may start anytime after 3)
- **Stage 4** — unlocks Stage 6 in parallel (schwa main line if dominant; do not wait for Stage 5)
- **Stage 5** — needs Stage 4 (assimilation = prefix meets root)
- **Stage 8.1** — only unit gated on **4 + 5 + 6** complete
- **Side queues from intake:** E11 outlaw / 8.2 · E10 / 8.3

---

# Part III — Build phases

*Product sequence. Named phases so they never collide with Curriculum Stages 1–8.*

| Phase | Ship | Prove |
|---|---|---|
| **0 — Intake** | Placement dictation + Slice 1 spot-check; seed error words into E-codes + outlaw | Routing matches cluster logic in Part II |
| **1 — Core loop** | Full loop on ~10 real error words from the placement entry point | Look-Again feels satisfying, not nagging |
| **2 — Teaching layer** | Worked-example briefings for the **curriculum stages the kid entered** (usually 4–6); outlaw path labeled | Patterns taught before tested |
| **3 — Scheduler** | SM-2/Leitner across those stages; block then interleave; fading Look-Again | Error words resurface on schedule |
| **4 — Fluency + autonomy** | Optional timed runs only after mastery; kid controls sources, difficulty, length | Mature UI; personal bests, no leaderboard |

Curriculum Stages 1–8 are *what* to teach. Build Phases 0–4 are *in what order to ship the product.* Placement decides which curriculum stages are live; Phase 2 fills briefings for those stages.

**If accuracy stalls after 4–6 weeks of short daily sessions:** check teaching briefings first (taught vs only tested), then whether Look-Again is real. Never introduce speed work before mastery on a word.

---

## Limits

- Knowledge gap and verification gap hit **different words**. Same loop teaches and verifies; briefing comes first.
- Morphology and spelling effect sizes are usually small-to-moderate. Expect steady gains, not transformation.
- Horn (1947) is old and repeatedly reaffirmed — treat the *direction* as solid.
- Game-based-learning meta-analyses are thin for this exact population. Trust the learning-science mechanisms more than "educational games" as a category.
- Tangible, expected, controlling rewards on an already-interesting task are the risky kind — the points/badges pattern to avoid.
