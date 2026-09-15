---
description: First-run setup. Interview the user about what they post, where, how often and in what voice, then write their content profile, doctrine and project context so the other commands work.
---

# /setup-social

First-run setup for **PostCraft**. Run this once, before `/create-posts`. It asks what it needs, then writes three files:

| File | What it holds |
|---|---|
| `content/profile.json` | The structured answers: platforms, handles, cadence, timezone |
| `content/content-doctrine.md` | The written strategy: thesis, pillars, voice, banned words |
| `CLAUDE.md` | Project context, so every future session starts knowing this |
| `content/preferences.md` | Empty to start - fills up as you correct things |

If those already exist, **do not start over.** Read them, show the user a summary, and
ask what they want to change. Only rewrite the parts they name.

---

## How to run the interview

Ask in the order below. **Ask a few questions at a time, not all at once**, and let the
answers shape what you ask next — if they say they are a solo developer, do not then ask
which team member approves posts.

Keep it conversational. This is the only time the user has to explain themselves, so it
should feel like a good intake call, not a form. Reflect answers back in your own words
so they can correct you.

**Do not invent answers.** If the user is vague, ask one follow-up. If they stay vague,
write down what they actually said and mark the gap rather than filling it in.

### 1. What is this account for?

- What do you make or do?
- What is the single thing you want a reader to do after reading a post — follow, sign
  up, reply, hire you, nothing?
- Is this a personal account or a brand/company account?

### 2. Who is the audience?

- Who are you writing for, specifically? ("developers" is too broad — which ones, at
  what stage, with what problem?)
- What do they already know, so you do not explain it to them?
- Where do they actually spend time?

### 3. Which platforms, and what are the handles?

Offer the four supported: **LinkedIn, X, Instagram, TikTok.**

For each one they pick, get the **exact handle**, spelled precisely. This matters more
than it sounds: handles get burned into rendered video and into CTAs, and a wrong one
costs a re-render.

Note which are personal versus brand accounts — the voice differs.

### 4. How often, and when?

- How many posts per week per platform, realistically? Push back gently on anything
  they will not sustain — a missed cadence is worse than a smaller one.
- **What timezone is the audience in?** The scheduler writes local browser time, so
  this determines every conversion later. Ask where their readers are, not where they
  are.
- Any days or times that are off-limits?

### 5. Voice and language

- What language do you write in? (Anything, not just English.)
- First person as the maker ("I built"), or brand voice ("we")?
- Pick a tone from how they talk, and read it back: dry and technical · warm and
  conversational · contrarian and blunt · plain and factual · playful.
- Any words, phrases or tics you never want to see? Collect these literally — they
  become hard bans.
- Show them two or three sentences in the voice you think they mean, and adjust until
  they say yes. **Do not skip this** — it is the difference between posts they ship and
  posts they rewrite.

### 6. What do you post about?

Get 3–6 recurring themes. Then set a mix — how many of every ten posts is each theme.

Push on one thing: **what fraction is directly promotional?** If they say more than
three in ten, tell them plainly that constant promotion burns an audience, and that the
non-selling posts are what earn the right to the selling ones. Then record whatever they
decide; it is their account.

### 7. What is off-limits?

- Topics you will never post about
- Claims you cannot make (regulated industry, employer restrictions, legal review)
- Anything requiring approval before it ships

### 8. Media

- Can you supply images and video yourself, or do you want them generated?
- If generated: that is done by this AI client, or by an MCP server they connect
  (`/mcp` lists what is available). PostCraft itself holds no API keys. If nothing is
  connected, say plainly that the scheduler works fine with media they supply.
- Do you have brand colours and a logo? Capture the hex values and put them in the
  doctrine, so generated visuals and HTML assets stay on-brand.

---

## Then write the files

### `content/profile.json`

```json
{
  "account_type": "personal | brand",
  "what_i_do": "one sentence, in their words",
  "audience": "specific description",
  "audience_timezone": "IANA name, e.g. America/New_York",
  "language": "the language they write in",
  "voice": "first-person | brand",
  "tone": "the agreed tone, in a few words",
  "platforms": {
    "x": { "handle": "@…", "per_week": 0, "account": "personal | brand" },
    "linkedin": { "handle": "…", "per_week": 0, "account": "personal | brand" },
    "instagram": { "handle": "@…", "per_week": 0, "account": "brand" },
    "tiktok": { "handle": "@…", "per_week": 0, "account": "brand" }
  },
  "pillars": [{ "name": "…", "per_ten": 3, "intent": "follow | signup | reply" }],
  "banned_words": [],
  "banned_topics": [],
  "media": { "source": "supplied | generated", "mcp": "name or null" }
}
```

Include only the platforms they chose.

### `content/content-doctrine.md`

Write it **from their answers**, in their language. Use
`content/content-doctrine.example.md` for the *shape* of a good one — the rules, the
pillar mix, the format library — but none of its content. Sections:

1. **Thesis** — who this is for and what it is trying to achieve
2. **Rules** — the non-negotiables, including anything from step 7
3. **Voice** — tone, person, language, with the sample sentences they approved
4. **Pillars** — the themes and the mix per ten posts
5. **Banned words and patterns** — verbatim from step 5
6. **Formats** — a starting library for their platforms. Keep the mechanics from the
   example that apply and drop the rest.

### `CLAUDE.md` at the repo root

Short. Just what a future session must not get wrong:

```markdown
# <their account name>

Handles: <exact spellings, per platform>
Audience timezone: <tz> — the scheduler writes LOCAL browser time, so convert.
Voice: <one line>
Never: <banned words / topics, one line>

Content strategy lives in content/content-doctrine.md. Read it before writing posts.
Queue and history: posts.json, content-history.json.
```

### `content-history.json`

Create it empty if absent: `{"posts": []}`. It is the dedup memory — `/create-posts`
reads it to avoid repeating a topic, format or hook.

### `content/preferences.md`

Copy `content/preferences.example.md` to `content/preferences.md` if it does not exist.
It starts empty and fills as the user corrects things. Explain it in one line: **every
time they push back on a draft, PostCraft can record why, and future batches obey it.**

If anything in the interview was phrased as a dislike rather than a plan — "I hate posts
that open with a question", "never use emoji" — seed those as the first entries, dated
today, with their words under `*From:*`. That is exactly what the file is for, and it
means the very first batch already reflects it.

---

## Finish by telling them what happens next

Show the cadence you recorded, the pillar mix, and their handles — one last chance to
correct something.

Then, concretely:

1. Log into the platforms they chose (README step 3), one Chrome window each
2. `/create-posts` to draft their first batch
3. `/schedule-posts` to ship it

Mention that `/create-posts` will leave `[[markers]]` wherever a post needs a real
number or fact only they have, and that nothing publishes until `/schedule-posts` runs.
