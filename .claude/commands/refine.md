---
description: Teach PostCraft from feedback. Give it a correction, a dislike, or a note about how a post performed, and it records a durable rule so the same mistake is not repeated.
---

# /refine

Turn a piece of feedback into a rule that changes future output.

`$ARGUMENTS` is the feedback, in the user's own words. If empty, ask what they want to
change — about a specific draft, a published post, or the writing in general.

This command **does not rewrite anything**. It records what was learned. Use
`/create-posts` to produce new drafts that obey it.

---

## STEP 1 — Understand what is actually being asked

Read `content/preferences.md` (create it from `content/preferences.example.md` if
absent) and `content/content-doctrine.md` first, so you know what is already believed.

Then work out which of these the feedback is:

| Kind | Example | What to do |
|---|---|---|
| **A durable preference** | "stop opening with questions" | Record a rule |
| **A one-off fix** | "this number is wrong" | Fix it, record nothing |
| **A doctrine change** | "I want to stop posting about hiring entirely" | Update the doctrine, not this file |
| **A performance signal** | "the carousel got 4x the usual reach" | Record it, but as evidence, not law |

**Do not record one-off corrections as permanent rules.** A typo is not a preference.
If it is genuinely ambiguous, ask: *"Is that a one-off, or should I always do that?"*

---

## STEP 2 — Distil it into one instruction

A good rule is:

- **Actionable.** "Be more engaging" is not a rule. "Open with a concrete number rather
  than a claim" is.
- **Narrow.** If it only applies to LinkedIn, say so. A rule applied too broadly does
  more damage than no rule.
- **Falsifiable.** You should be able to look at a draft and say whether it complies.

If the user's feedback is vague, ask **one** clarifying question. Do not interrogate. If
it stays vague, record their exact words under the closest heading and mark it
`(needs sharpening)` rather than inventing a precise rule they did not ask for.

---

## STEP 3 — Check it against what is already there

Before appending, look for:

**A contradiction.** If a new rule conflicts with an existing one, do not silently keep
both. Show the user both and ask which wins. Move the loser to *Retired rules* with a
dated note.

**A duplicate.** If the rule already exists in different words, do not add a second copy
— strengthen the existing entry and add the new feedback line beneath it as further
evidence.

**Over-fitting.** If three rules already constrain openings, say so. A rule set that
contradicts itself produces worse writing than none, and the user should hear that
before it gets there.

---

## STEP 4 — Write it

Append under the right heading in `content/preferences.md`:

```markdown
## Voice
- 2026-03-04 — Open with a concrete number rather than a claim.
  *From:* "the hook feels vague, give me the actual figure up front"
```

Rules:

- **Date every entry.** It is how you tell a current preference from a stale one.
- **Keep the user's raw words** under *From:*. Never paraphrase into the quote.
- Replace the `*Nothing learned yet.*` placeholder when a section gets its first rule.
- If the feedback was about a **specific post**, add its id: `(re: loom-loop-x)`.

---

## STEP 5 — Consolidate, occasionally

When a section passes **roughly ten rules**, offer to consolidate — do not do it
unasked. Merge overlapping rules into fewer, clearer ones, keeping every *From:* line so
the evidence survives.

Rules that have not been reinforced in six months are worth questioning too: show them
and ask whether they still hold.

The goal is a file the user can read in two minutes, not a changelog of every reaction
they ever had.

---

## STEP 6 — Confirm

Tell them, briefly:

- the rule you recorded, in the words you wrote it
- anything it contradicts or replaces
- what will visibly change in the next batch

Then stop. Do not rewrite existing drafts unless they ask — `/create-posts` picks this
up on its next run.

---

## Recording performance, not just opinions

If the feedback is about how a post *did* rather than how it reads, record it under the
relevant section but phrase it as evidence:

```markdown
## Structure and format
- 2026-03-04 — Carousels outperform single images on LinkedIn, so far.
  *From:* "the carousel got 4x the reach of the infographic" (re: relo-carousel-li)
  *Evidence:* 1 comparison. Treat as a hint, not a rule, until it repeats.
```

**One result is an anecdote.** Say so in the entry. When the same pattern shows up a
third time, drop the hedge and promote it to a real rule. Writing a strategy off a
single good post is how accounts end up chasing noise.
