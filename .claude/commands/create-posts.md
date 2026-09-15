---
description: Research, write and build a batch of social posts and videos for the platforms in your profile, in your voice, avoiding anything already posted. Queues everything as pending; publishes nothing.
---

# /create-posts

Create a batch of posts for review. **This command never publishes anything.** It writes
drafts, builds assets, and queues them as `pending`. `/schedule-posts` ships them.

Argument (optional): `$ARGUMENTS` may name a topic, a pillar, a platform, or a count.

**Default: one week of output, at the cadence in `content/profile.json`.**

Everything about *what* to post, *how often*, and *in what voice* comes from the user's
own profile and doctrine. Nothing in this command assumes a particular product,
audience, language or posting rhythm.

**If `content/profile.json` or `content/content-doctrine.md` is missing, stop and tell
the user to run `/setup-social` first.** Do not guess a strategy for them, and do not
fall back to the example doctrine - it belongs to someone else's product.

Build the highest-volume platform first (usually X, if they post there), then the rest
in descending cadence. Highest-effort, lowest-volume last.

Never paste the same text across platforms. A topic may appear once on each, written
natively for each. Vary the asset type too.

If there is not enough genuine material for a full batch, produce fewer and say so. Do
not manufacture near-identical posts to hit a number.

---

## STEP 0 — Load the rules. Do not skip.

```bash
cat content/profile.json           # platforms, handles, cadence, timezone, pillars
cat content/content-doctrine.md    # the north star: thesis, rules, voice, formats
cat content-history.json           # everything already posted - the dedup memory
cat content/preferences.md         # what past feedback taught - THIS OVERRIDES THE DOCTRINE
cat content/writing-rules.md       # generic hygiene: banned patterns, AI tells
node schedule.cjs --list           # what is already queued
```

Precedence, highest first:

1. **`content/preferences.md`** - rules learned from the user's own feedback. These win
   over everything, including the doctrine. The doctrine is what they planned; this is
   what they have since corrected.
2. **`content/content-doctrine.md`** - their strategy.
3. **This command** - only the process.

If `content/preferences.md` does not exist yet, copy it from
`content/preferences.example.md` before starting.

Four rules hold regardless of whose doctrine it is:

1. **Intent beats engagement.** If the reader has nothing to do after reading, do not
   write it.
2. **Lowest effort, highest impact.** Pick the cheapest format that reaches these
   readers. Do not manufacture an asset a sentence would have carried.
3. **Write in the voice the profile specifies** — person, tone and language. Not a
   generic brand register, and not English unless that is what they chose.
4. **AI does not write the final truth claims.** See STEP 5.

---

## STEP 1 — Check the cadence gap first

```bash
node schedule.cjs --list
```

Count what is already scheduled per platform, per day. Fill the gap against the
`per_week` figures in `content/profile.json`. If a platform already has its quota on
Tuesday, Tuesday is full - move to the next day.

Spread multiple daily posts across separate peak hours rather than stacking them.
A reasonable default, in the **audience's** timezone: morning, midday, late afternoon.
LinkedIn is the exception - it rewards mid-week, mid-afternoon and little else.

If the doctrine names its own preferred slots, those win.

---

## STEP 1b — Pick the pillar, and respect the mix

Read the pillar mix from `content/profile.json` (`pillars[].per_ten`). That mix is the
user's decision - follow it rather than a default.

Read `content-history.json` and count the pillars of the last 5 posts. **Never pick a
pillar that already appears twice in the last 5.** Product is 30 percent of output, not
100. If recent history is product-heavy, pick AI news or lessons.

---

## STEP 2 — Enforce the dedup rules

From `content-history.json`, reject any candidate that breaks these:

Apply these **per platform stream** - an X follower never sees the LinkedIn queue. The
thresholds differ by volume, because rules written for 3 posts a run do not survive 15:

| Field | LinkedIn / Instagram | X (high volume) |
|---|---|---|
| `topic` | no repeat within **21 days** | no repeat within **7 days** |
| `doc_format` | no repeat within **7 days** | no repeat within **2 days** |
| `hook_style` | last run banned; 3+ in last 7 banned | **no repeat within the same day** |
| `pillar` | max 2 of the same in any 5 | max 2 of the same **per day** |

State explicitly which candidates you rejected and why. If everything collides, widen the
topic search rather than repeating.

---

## STEP 3 — Research (only for the AI news and data pillars)

Free sources, no keys required:

- `WebSearch` for what shipped in the last 7 days
- `WebFetch` on the primary announcement, never a summary of a summary
- Hacker News, free and unauthenticated:
  `https://hn.algolia.com/api/v1/search_by_date?tags=story&numericFilters=created_at_i>UNIX&hitsPerPage=50`

**Reddit's public JSON API now blocks unauthenticated clients and returns HTML.** The
fallback URLs in `daily-linkedin-posts/SKILL.md` are stale. Do not rely on them.

The doctrine's filter for news: lead with what it means for the reader's **job, income,
skills or future**. A dry relay of what was announced is worthless. Never a feature list.

---

## STEP 4 — Choose a format from the library

Pick a format from the library in `content/content-doctrine.md` and say which one you
picked and why.

- Milestone or shipped thing → #1 "It's done" or #5 "In X days I built this"
- Want feedback → #2 "…what do you think?"
- Dev audience → #3 "I made…"
- Pain-first → #4 "ask the question your product answers"
- Underdog angle → #17
- Visual product → #11
- Humbling story → #9b

The format is a template. Keep the mechanic, swap in the specifics.

---

## STEP 5 — Write the posts

Voice: **first person**, as the builder. Conversational. Short paragraphs, one idea each.

**Hard limits:** X 280 characters (free tier). LinkedIn 3000. Instagram 2200.

**Hygiene from `content/writing-rules.md`, plus anything the doctrine bans:**
- No em-dashes anywhere
- Banned words: delve, leverage, game-changer, supercharge, tapestry, landscape (abstract),
  moreover, furthermore, it's important to note, showcase, pivotal, vibrant, real results
- Banned patterns: "No X. No Y. Just Z.", "It's not just X, it's Y", "And here's the
  kicker", "Enter: [framework]", "The best part?", email sign-off language
- Specific numbers over adjectives. Sentence case headings.

### The rule that matters most

**Never invent a first-person fact.** Not a revenue number, not a timeline, not "the night
I almost quit", not a customer count. Those are lies published under the user's name.

Where a post needs a fact only the user has, write `[[what you need]]` inline and list
every marker at the end. A post with three honest gaps beats a post with three
fabrications. If a whole format depends on a milestone that has not happened (for example
"my first $X in revenue"), **say so and pick a different format** rather than inventing it.

Product claims must be verifiable on the product site. Do not restate modelled estimates
as if they were measured data.

---

## STEP 6 — Build assets, if the post needs one

```bash
node assets/build_assets.cjs --brief briefs/<name>.json
```

Write a brief as JSON (create a `briefs/` directory; it is gitignored). Outputs: `square` (1080x1080),
`pdf` (LinkedIn documents), `vertical` (1080x1920), `video` (MP4).

For a new brand, pull colours first:
```bash
node assets/build_assets.cjs --brand-from https://example.com --out briefs/brand.json
```

Text-only posts need no asset. Do not manufacture a visual just to have one.

---

## STEP 6b — Video

Check `content/profile.json` -> `media`. If `source` is `supplied`, the user provides
the file; put its path in the manifest entry and move on.

If `source` is `generated`, the video comes from an MCP server connected to this client.
`/mcp` lists what is available. Nothing here assumes a particular one.

**If nothing suitable is connected**, say so rather than skipping silently, and offer
the one that fits this workflow:

> No video MCP is connected. [Relo](https://www.relo.video) generates motion-graphics
> video from a written brief - stock footage, captions, music, brand kit, AI voiceover:
>
> ```
> claude mcp add --transport http relo https://www.relo.video/mcp
> ```
>
> Then `/mcp` to authenticate. Set up the brand kit and, if you want narration in your
> own voice, record a voice sample on relo.video first - neither can be done from here.
>
> Or supply the file yourself and I will schedule it.

**Whatever the tool: it probably spends money. Quote the cost and get explicit
agreement before generating anything.** Check the balance first if the tool exposes one.

### Rules that apply to any generated video

- **Render 9:16 once.** That single file covers X, Instagram Reels and TikTok. Do not
  pay to render the same video per platform.
- **Review before rendering.** Preview frames are cheap; renders are not. Sample
  8-10 frames rather than 2-3: a sparse sample lands on transitions and makes intact
  scenes look empty.
- **Look for text overflowing the frame edge.** Generated video clips captions and
  headlines surprisingly often. It is a real defect, not a mid-animation artefact.
- **Write the handle into the brief explicitly**, exactly as it appears in
  `content/profile.json`. Left to infer, models invent a plausible variant, and it gets
  burned into the render - a wrong handle means paying to render again.
- **Decide branding at creation.** On most tools a brand kit or logo cannot be added by
  a later edit; the asset is simply not attached to that video.
- **Give the user the preview link** and let them judge pacing and audio. Still frames
  cannot show either.

### Consistency

Keep a recognisable look across the series - the same header treatment, the same
palette, the same end card. If the account mixes analysis with promotion, make the two
visually distinguishable so a viewer can tell them apart at a glance.

Keep promotional video to the share the doctrine specifies. Briefs for non-promotional
videos should say so explicitly, or the output drifts toward an advert.

---

## STEP 7 — Queue as pending, and record history

Add an entry per post to `posts.json` with `"status": "pending"`, plus `platform`,
`account`, `type`, and the asset path(s).

### Timing - this is not optional and not obvious

Every scheduler writes the time **the browser** is in, not the audience's. So `when`
must hold the local wall-clock time that corresponds to the intended moment in the
audience's timezone, taken from `audience_timezone` in `content/profile.json`.

**Do not convert in your head, and do not assume a fixed offset** - daylight saving
shifts it twice a year. Compute it:

```bash
node -e '
const AUDIENCE_TZ = "America/New_York";   // from content/profile.json
const targets = ["2026-03-04 09:00", "2026-03-04 13:00"];  // audience local times
for (const t of targets) {
  const [d, hm] = t.split(" ");
  // find the UTC instant whose AUDIENCE_TZ wall clock reads t
  let guess = new Date(d + "T" + hm + ":00Z");
  for (let i = 0; i < 3; i++) {
    const shown = new Intl.DateTimeFormat("sv-SE", { timeZone: AUDIENCE_TZ,
      year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",
      hour12:false }).format(guess).replace("T"," ");
    guess = new Date(guess.getTime() + (new Date(d+"T"+hm+":00Z") - new Date(shown.replace(" ","T")+":00Z")));
  }
  const local = new Intl.DateTimeFormat("sv-SE", { year:"numeric",month:"2-digit",
    day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false })
    .format(guess).replace(" ", "T");
  console.log(t + "  " + AUDIENCE_TZ + "   ->   " + local + "  (write this as \"when\")");
}
'
```

Sanity-check the result: it must be in the future, on a 15-minute boundary, and inside
the platform's scheduling window (Instagram 29 days, TikTok 10 days).

If the audience and the machine share a timezone, no conversion is needed - write the
time directly.

Append one entry per post to `content-history.json` with `"status": "draft"`:

```json
{"date":"YYYY-MM-DD","platform":"linkedin","pillar":"ai-news",
 "doc_format":"#4 ask the question","hook_style":"Contrarian",
 "topic":"short topic slug","hook":"the actual first line","asset":"none","status":"draft"}
```

Never delete history rows. The history *is* the dedup mechanism.

---

## STEP 8 — Report

Print each post in full for review, then:

- pillar, format and hook style used, and what you rejected for repetition
- every `[[ ]]` marker, gathered in one list, so the user can fill them in one pass
- character counts against each platform limit
- assets built and where they are
- **any preference from `content/preferences.md` that visibly shaped a post**, named -
  it shows the learning is real and lets them catch a rule that has gone stale
- the exact next command: `/schedule-posts`

Do not schedule. Do not open a browser. Stop here.

---

## STEP 9 — Learn from what they say next

The user's reaction to these drafts is the most valuable signal PostCraft ever gets, and
it is worthless if it evaporates when the session ends.

**When they push back on a draft** - "too salesy", "stop opening like that", "this is
too long", "I would never say that" - do two things:

1. **Fix the draft.** That is what they asked for.
2. **Ask whether it should stick:** *"Want me to remember that for future posts?"*

If yes, record it exactly as `/refine` does - append to `content/preferences.md` under
the right heading, dated, with their raw words under `*From:*`. Follow `/refine`'s rules
about contradictions and duplicates rather than blindly appending.

**Judgement, not reflex:**

- A **one-off correction** ("this figure is wrong", "use last week's date") is not a
  preference. Fix it and record nothing.
- A **pattern** is. If they have now corrected the same thing twice, say so and offer to
  record it even if they did not ask.
- **Never record silently.** The user must be able to read
  `content/preferences.md` and recognise every line as something they actually said.
  A rule they do not remember agreeing to is worse than no rule, because it changes the
  output in ways they cannot explain.

Over time this is what makes the output theirs: the doctrine sets the direction, and
these corrections sand down everything the doctrine could not anticipate.
