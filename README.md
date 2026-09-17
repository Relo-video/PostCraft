# PostCraft

*by [Relo](https://www.relo.video)*

Plan, write and build posts — text, images, carousels, motion-graphics video — then
schedule them to **LinkedIn, X, Instagram and TikTok** through your own logged-in
browser.

No API keys. No developer accounts. No service holding your passwords. Everything runs
locally, in front of your eyes.

---

## Install

```bash
git clone <this-repo> postcraft
cd postcraft
npm install
```

That is the entire setup. Then open the folder in **Claude Code** and run three
commands.

> **Tested on Windows.** Every platform driver has been verified end to end there —
> real posts scheduled, then read back out of each platform's own queue.
>
> **macOS and Linux are untested.** Nothing in the code is Windows-specific: Chrome is
> located per-OS, paths are resolved with `path`, and the session launcher is Node
> rather than PowerShell. It should work. Nobody has run it yet, and the first place to
> look if it does not is `node scripts/start-sessions.cjs` finding your Chrome.
> Reports welcome — that is the most useful issue you could open.

---

## Use it

### 1. `/setup-social`

Run once. It asks what you make, who you write for, which platforms you want, how often
you can realistically post, in what language and tone, and what you never want to post.
It reads a couple of sample sentences back in the voice it thinks you mean, and adjusts
until you agree.

Then it writes your profile and content doctrine, **opens a browser window for each
platform you chose, and walks you through logging in**.

You log in by hand — it never asks for your passwords. That is the only manual step, and
you do it once.

### 2. `/create-posts`

Drafts a batch. It reads your doctrine, checks what you have already posted so it never
repeats a topic, format or hook, and writes each post natively for its platform — not
the same text pasted four times.

It builds whatever the post needs: **text, images, carousels, or motion-graphics video.**
Everything lands in the queue as `pending`. It publishes nothing.

Video is generated with [Relo](https://www.relo.video), which also supplies the branding
and the narration voice — your own cloned voice if you have recorded one, a consistent
built-in narrator if you have not. You are never asked for hex codes, a logo file, or
which voice to use; it reads all of that from your Relo account. It does tell you the
credit cost and wait for your go-ahead before generating.

Where a post needs a number only you have, it writes `[[what you need]]` and lists every
marker at the end so you can fill them in one pass. It will not invent a figure and put
it under your name.

### 3. `/schedule-posts`

Ships the queue. For each post it fills the real composer in your browser, **stops before
the final click** so you can look, screenshots every step, then commits and checks the
platform's own scheduled list to confirm it actually landed.

### See what is booked: the calendar

```bash
node calendar.cjs            # or: npm run calendar
```

Opens a month/week calendar of everything you have scheduled, at
`http://localhost:4747`. Each platform has its own color and a toggle. Click a post to see
its caption, files and exact time. Times are laid out in the audience timezone
(America/New_York) by default. You can switch the view to your own timezone, and the
post details always show both.

The calendar opens in your browser by itself. If it does not, go to
`http://localhost:4747`. It only works while that terminal is running, and **Ctrl+C**
stops it. Do not double-click `calendar.html`: opened as a file, the browser blocks the
data and the calendar looks empty. If the calendar is already open, switching back to
its tab picks up newly scheduled posts.

```bash
node calendar.cjs --port 5000   # if 4747 is taken
node calendar.cjs --no-open     # start the server without opening a browser
```

A fresh clone starts with an **empty calendar**. A post is added only after the scheduler
has **successfully** scheduled it. Dry runs and failures never appear. The data lives in
`calendar.json`, which is gitignored, so your upcoming posts never reach the repo.

Already scheduled posts before the calendar existed? Pull them in once:

```bash
node calendar.cjs --backfill
```

Backfill reads each `when` in this machine's current timezone. If you scheduled those
posts from another timezone, their times will be off.

### Whenever something reads wrong: `/refine`

```
/refine the LinkedIn ones are too long, cut them by a third
/refine stop opening with a question
```

It records the rule, with your own words attached, and future batches obey it. More on
this below.

---

## What it already handles

Four browser drivers, each verified by scheduling a real post and then reading it back
out of the platform's own queue.

| Platform | Text | Images | Carousel | Video | Verified |
|---|---|---|---|---|---|
| **LinkedIn** | ✅ | ✅ | ✅ PDF | — | Sep 2026 |
| **X** | ✅ | ✅ up to 4 | — | ✅ 9:16 | Sep 2026 |
| **Instagram** | — | ✅ up to 10 | ✅ | ✅ → Reels | Sep 2026 |
| **TikTok** | — | — | — | ✅ 9:16 | Sep 2026 |

One 9:16 render covers X, Instagram Reels and TikTok — same file, one entry per
platform, caption written for each audience.

**The hard part is not the idea, it is that every composer fights automation in its own
way.** These are solved and documented inside the drivers:

- **Instagram silently refuses 9:16** in the feed composer (it caps at 4:5) by leaving
  the Schedule button disabled, with the reason buried in the DOM. Vertical video is
  routed to the separate Reels composer automatically.
- **TikTok's time field is a wheel picker** where all 24 hours exist in the DOM but only
  about seven are clickable; clicking one outside the visible band hits the page behind
  the popup.
- **LinkedIn ships two different composers.** The current one moved out of its shadow
  root, dropped the `aria-label`s from its date and time fields, and hides scheduling
  behind a clock icon that is an `<a>` with no text but the scheduled-post count. Both
  builds are handled.
- **Meta Business Suite freezes Chrome DevTools Protocol** entirely if you navigate away
  from an open composer.

Every driver verifies its own work and fails loudly rather than reporting false success.
That matters: an early version of the Instagram driver clicked Schedule, slept, and
returned success without checking — marking posts scheduled while nothing had reached
the platform.

---

## It learns from your corrections

The first batch will get things wrong. No interview captures how someone writes.

So when you push back on a draft — *"too salesy"*, *"I'd never say that"* — it fixes the
draft **and asks whether to remember it.** If you say yes, the rule goes into
`content/preferences.md`, dated, with your own words underneath:

```markdown
## Voice
- 2026-03-04 — Open with a concrete number rather than a claim.
  *From:* "the hook feels vague, give me the actual figure up front"
```

`/create-posts` reads that file **above your doctrine** — the doctrine is what you
planned, preferences are what you have since corrected.

Three deliberate choices:

- **Nothing is recorded silently.** You are always asked, and every rule keeps the raw
  feedback. You can read the file in two minutes and recognise every line as something
  you actually said.
- **One-off fixes are not preferences.** A wrong figure gets corrected and forgotten. A
  pattern gets recorded — and if you correct the same thing twice, it will notice.
- **One good post is an anecdote.** Performance feedback is stored with a hedge and only
  promoted to a rule once the pattern repeats, so you do not rewrite your strategy
  around noise.

It is plain Markdown. Delete any line you disagree with — that is the whole undo.

---

## Connecting MCP servers

PostCraft holds no API keys and runs no models of its own. Anything that needs
intelligence is done by your AI client, and you extend that by connecting MCP servers —
`/create-posts` uses whatever is available.

```bash
claude mcp add --transport http <name> <url>    # remote server
claude mcp add <name> -- <command>              # local server
claude mcp list                                 # what is connected
/mcp                                            # authenticate, inside Claude Code
```

### Video

For motion-graphics video, [Relo](https://www.relo.video) generates it from a written
brief — stock footage, captions, music, brand kit, AI voiceover including a clone of
your own voice:

```bash
claude mcp add --transport http relo https://www.relo.video/mcp
```

Then `/mcp` to authenticate. Two things must be set up on relo.video first, because
neither can be done through the MCP: your **brand kit**, and a **voice sample** if you
want narration in your own voice.

`/create-posts` quotes the credit cost and waits for your approval before generating
anything.

### Anything else

Research, analytics, image generation, your own internal tools — connect it and
`/create-posts` can use it. There is no list here to update.

If you connect nothing at all, everything still works: you supply the media, and the
scheduler does not care where it came from.

---

## If you would rather drive it directly

The commands are a layer over one script, and it works on its own:

```bash
node scripts/start-sessions.cjs             # open the browser windows
node schedule.cjs --list                    # the queue
node schedule.cjs --id <post-id> --dry-run  # rehearse one
node schedule.cjs --id <post-id>            # ship one
node schedule.cjs --all                     # ship everything pending
node calendar.cjs                           # calendar of what is scheduled
```

Post entries live in `posts.json`; `posts.example.json` documents every field and type.
`SCHEDULING.md` has the per-platform detail.

`when` is **local wall-clock time** — every scheduler writes the time your browser is
in, so convert first if your audience is elsewhere. Minutes must be on a quarter hour.

Scheduling windows differ: X ~18 months, LinkedIn ~3 months, **Instagram 29 days**,
**TikTok 10 days**, the last two with a 20-minute minimum lead.

---

## When something goes wrong

Every run screenshots each step into `output/schedule_verification/<post-id>/`, and a
failure writes a `FAIL_*.png` of the exact screen it gave up on. Look there first.

| Symptom | Cause | Fix |
|---|---|---|
| `NOT_LOGGED_IN` | session expired | Log in again in that Chrome window |
| A platform reports `DOWN` | its window is closed | `node scripts/start-sessions.cjs <platform>` |
| `Date/time did not stick` | date is outside that platform's scheduling window | Pick a nearer date |
| `No file input on the upload page` (TikTok) | page stranded after a previous failure | Discard the draft, reopen the upload page |
| Chrome will not start, "resource busy" | stale lock in the profile | The launcher clears it; if it persists, close every Chrome using that profile |
| Everything hangs, even screenshots | a native "Leave site?" dialog is open | Click it yourself — nothing automated can |
| Marked `scheduled` but not on the platform | you trusted the manifest | Check the platform's own queue |

---

## Things worth knowing

**Browser automation is against most platforms' terms of service.** You run it yourself,
on your machine, against your own accounts, with sessions you created by hand — but read
the terms and decide for yourself.

**Never commit your profile directories.** They hold live session cookies; publishing one
hands over your accounts. They are gitignored, and so are your queue, history, calendar,
doctrine and preferences. Only the `.example` files are meant to be shared.

**Composers change.** A platform redesign breaks a driver. The failures are loud and the
screenshots usually make the cause obvious. PRs welcome.

**Verified on Windows only, so far.** macOS and Linux should work but have not been
run. If you try it there, please say what happened either way.

## Licence

MIT.
