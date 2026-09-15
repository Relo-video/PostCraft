# PostCraft

*by [Relo](https://www.relo.video)*

Queue a post once, and have it scheduled on **LinkedIn, X, Instagram and TikTok** —
including 9:16 video — by driving Chrome windows you have logged into yourself.

Connect an MCP server such as [Relo](https://www.relo.video/mcp) and Claude Code can
generate the video too, so a post goes from brief to scheduled without leaving the
terminal.

There is no API key to apply for, no developer account to get approved, and no service
in the middle holding your passwords. Your sessions stay on your machine.

---

## Platform status

Every row below was verified by scheduling a real post and then reading it back out of
the platform's own queue.

| Platform | Text | Images | Video | Scheduling | Verified |
|---|---|---|---|---|---|
| **LinkedIn** | ✅ | ✅ | — | ✅ | Sep 2026 |
| **X** | ✅ | ✅ | ✅ 9:16 | ✅ | Sep 2026 |
| **Instagram** | — | ✅ | ✅ → Reels | ✅ | Sep 2026 |
| **TikTok** | — | — | ✅ 9:16 | ✅ | Sep 2026 |

LinkedIn ships two different composers depending on the account. The driver handles
both: the older one keeps everything in a shadow root with `aria-label`led date and time
fields; the current one uses the light DOM, drops those labels, and hides scheduling
behind a clock icon that is an `<a>` with no text but the scheduled-post count. Fields
are located by the shape of their value, so neither build needs special configuration.

---

## What this actually is

A single command-line runner, `schedule.cjs`, plus one driver per platform. You describe
posts in a JSON file, the runner opens the platform's real web composer in your
logged-in Chrome, fills it in, sets the schedule, and clicks the button.

Optionally, if you use Claude Code, two commands sit on top of it — one that plans and
writes a batch of posts, one that ships them.

**It is not a hosted product.** Nothing runs unless you run it. There is no daemon, no
account, no cloud.

---

## What to expect

Read this part before installing. It will save you an evening.

**Setup takes about 20 minutes**, most of it logging into four websites by hand. After
that, scheduling a batch is a couple of minutes per post.

**Video is slow.** A 10 MB clip takes 2–4 minutes per platform — upload plus the
platform's own transcoding. Three videos across three platforms is roughly half an hour
of wall-clock time. The runner waits properly rather than guessing, so let it sit.

**Debug ports are fixed** at 9222–9225, one per platform. If one is already in use on
your machine, change the `PORT` constant at the top of that driver in `lib/`. Making
them configurable is an open task.

**Chrome windows must stay open and logged in** while it works. Minimising is fine;
closing is not. If a session expires, the run stops and tells you — only you can get
through a login or 2FA prompt.

**Things break when platforms redesign.** These are web composers, not APIs. A layout
change can break a driver overnight. Two mitigations are built in: every driver verifies
its own work and throws loudly rather than reporting false success, and every step is
screenshotted so you can see exactly where it stopped.

**It will not invent facts.** The content commands write `[[your number here]]` where a
post needs something only you know, and the scheduler refuses to ship a post still
containing one.

**What it will not do:** post immediately (it schedules), run unattended on a server
(it needs your desktop Chrome), or work on a platform you are not logged into.

---

## Install

### Requirements

| | |
|---|---|
| **Node.js 18+** | the runner and drivers |
| **Google Chrome** | the browser being driven |
| **Accounts** | Instagram needs a **Business or Creator** account connected to Meta Business Suite. Others just need a normal login. |

> You only need to log into the platforms you actually use. Three working platforms is a
> perfectly good setup.

### 1. Get the code

```bash
git clone <this-repo> postcraft
cd postcraft
npm install
```

### 2. Make your own copies of the example files

```bash
cp posts.example.json posts.json
```

That is the whole configuration. **PostCraft needs no API keys and no environment
variables** — there is nothing to sign up for and nothing to paste in. Everything that
needs intelligence is done by your AI client; everything else is your own browser.

### 3. Open and log into the four browsers

**Windows:**
```powershell
powershell -ExecutionPolicy Bypass -File scripts/start_sessions.ps1
```

**macOS:**
```bash
for p in "9222 chrome-linkedin-profile https://www.linkedin.com/feed/" \
         "9223 chrome-x-profile https://x.com/home" \
         "9224 chrome-ig-profile https://business.facebook.com/latest/home" \
         "9225 chrome-tiktok-profile https://www.tiktok.com/tiktokstudio/upload"; do
  set -- $p
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    --remote-debugging-port=$1 --user-data-dir="$PWD/$2" \
    --no-first-run --no-default-browser-check "$3" &
done
```

**Linux:** same as macOS, with `google-chrome` in place of the app path.

Four windows open, one per platform:

| Platform | Port | Profile directory |
|---|---|---|
| LinkedIn | 9222 | `chrome-linkedin-profile/` |
| X | 9223 | `chrome-x-profile/` |
| Instagram → Meta Business Suite | 9224 | `chrome-ig-profile/` |
| TikTok → TikTok Studio | 9225 | `chrome-tiktok-profile/` |

**Log into each one by hand.** Each has its own profile directory, so they never collide
with your everyday browsing and never see each other's cookies. Sessions persist — you
do this once, and again only when a platform logs you out.

### 4. Check it can see them

```bash
node -e '
const http=require("http");
const check=p=>new Promise(r=>{
  const q=http.get({host:"127.0.0.1",port:p,path:"/json/version",timeout:4000},res=>{
    let d="";res.on("data",c=>d+=c);res.on("end",()=>r(p+": "+(JSON.parse(d).Browser||"?")));
  });
  q.on("error",()=>r(p+": DOWN"));q.on("timeout",()=>{q.destroy();r(p+": TIMEOUT")});
});
(async()=>{for(const p of [9222,9223,9224,9225])console.log(await check(p));})();
'
```

Four lines reporting a Chrome version means you are ready.

> Do not use `curl` for this check. In some sandboxed shells it cannot reach localhost
> and will report every port as down while everything is fine.

---

## Your first post

Open `posts.json` — the queue starts empty on purpose. Add one entry to `posts`
(`_examples` in that file has a worked sample of every type):

```json
{
  "id": "hello-x",
  "platform": "x",
  "type": "text",
  "when": "PUT A DATE 2-3 DAYS FROM NOW HERE, e.g. 2026-03-04T09:00",
  "status": "pending",
  "caption": "Testing a scheduler I just installed."
}
```

Use a time **a few days out** — every platform limits how far ahead you can schedule,
and X's year dropdown simply does not contain a date years away.

| Platform | How far ahead you can schedule | Minimum lead |
|---|---|---|
| X | ~18 months | a few minutes |
| LinkedIn | ~3 months | a few minutes |
| Instagram (Business Suite) | **29 days** | **20 minutes** |
| TikTok | **10 days** | **20 minutes** |

Rehearse it. This fills the composer completely and **stops before the final click**,
leaving it open so you can look:

```bash
node schedule.cjs --id hello-x --dry-run
```

Check the screenshots in `output/schedule_verification/hello-x/`, then commit:

```bash
node schedule.cjs --id hello-x
```

Then go and look at X's own scheduled list. Do not skip this the first time — seeing it
land is how you learn to trust the tool.

---

## Daily use

```bash
node schedule.cjs --list                    # the queue and its state
node schedule.cjs --id <post-id> --dry-run  # rehearse one
node schedule.cjs --id <post-id>            # ship one
node schedule.cjs --all --dry-run           # rehearse everything pending
node schedule.cjs --all                     # ship everything pending
```

On success the entry flips to `scheduled`, so a later run cannot double-post it. Use
`--force` only if you genuinely mean to re-run one.

### Writing entries

| Field | Notes |
|---|---|
| `platform` | `linkedin` · `x` · `instagram` · `tiktok` |
| `type` | `text` · `image` · `images` · `document` (LinkedIn PDF) · `video` |
| `file` / `files` | path to the asset(s); `files` for multi-image |
| `when` | **local** wall-clock time, `YYYY-MM-DDTHH:MM`, minutes on a quarter hour |
| `caption` | X 280 · Instagram 2200 · LinkedIn 3000 · TikTok 4000 |

See `posts.example.json` for a worked example of every type.

**Two things people get wrong:**

*Timezones.* `when` is the time your **browser** thinks it is, because that is what every
scheduler reads. If your audience is in another timezone, convert before you write the
entry — nothing converts it for you.

*Cross-posting.* One 9:16 video goes to X, Instagram and TikTok from a single file, but
it needs **one entry per platform**. Same `file`, different `id`, caption written for
each audience.

---

## When something goes wrong

Every run screenshots each step into `output/schedule_verification/<post-id>/`. A
failure writes a `FAIL_*.png` showing the exact screen it gave up on. Look there first —
it usually answers the question immediately.

| Symptom | Cause | Fix |
|---|---|---|
| `NOT_LOGGED_IN` | session expired | Log in again in that Chrome window |
| Every port reports DOWN, but Chrome is open | `curl` cannot reach localhost in your shell | Use the Node check in step 4 |
| `No file input on the upload page` (TikTok) | page stranded on `/upload/unavailable` after a previous failure | Discard the draft, navigate back to the upload URL |
| Instagram video sits on a disabled Schedule button | video is taller than 4:5 and the feed composer refuses it | Nothing — `type: video` is routed to Reels automatically. If you see this, the routing was bypassed |
| Chrome will not start, "Device or resource busy" | stale `lockfile` in the profile directory | If no Chrome is using that profile, delete `chrome-*-profile/lockfile` |
| Everything hangs, even screenshots | a native "Leave site?" dialog is open (Meta Business Suite does this) | Click it yourself. Nothing automated can dismiss it |
| Post marked `scheduled` but not on the platform | you trusted the manifest | Always verify in the platform's own queue. See below |
| `Date/time did not stick` | the date is outside what that platform's picker offers | Check the scheduling-window table above and pick a nearer date |
| `Execution context was destroyed` | the browser was on a stale page (leftover tab, open composer) | The runner retries once automatically. If it persists, close the extra tabs |

### Verify in the platform, not in the log

The `scheduled` flag in `posts.json` is a convenience, not proof.

An early version of the Instagram driver clicked Schedule, slept nine seconds, and
returned success without checking anything — so posts were marked scheduled while
nothing had reached Instagram. Every driver now confirms the composer actually closed
and throws if it did not. That was a real bug and it is worth knowing it was possible.

Where to look:

- **LinkedIn** — composer → clock icon → "View all scheduled posts" (the direct URLs 404)
- **X** — composer → schedule icon → "Scheduled posts"
- **Instagram** — Business Suite → Content → **Scheduled**
- **TikTok** — Studio → **Manage posts**; a scheduled video shows a future date and 0 views

---

## The content side (optional)

If you use Claude Code, `.claude/commands/` adds a planning layer:

```
/setup-social      first run only — interviews you, writes your profile and doctrine
/create-posts      research, write, build assets, queue as pending
/schedule-posts    dry-run each, commit, verify
/refine            teach it from feedback, so it stops making the same mistake
```

### Start with `/setup-social`

It knows nothing about you until you tell it, so it asks: what you make, who you are
writing for, which platforms and handles, how often, in what language and tone, what
your recurring themes are, and what you will never post. It reads a couple of sample
sentences back in the voice it thinks you mean, and adjusts until you agree.

From that it writes three files:

| File | What it holds |
|---|---|
| `content/profile.json` | platforms, handles, cadence, audience timezone, pillar mix |
| `content/content-doctrine.md` | your written strategy: thesis, rules, voice, formats |
| `CLAUDE.md` | the short version, so every later session starts knowing it |

Run it again any time to change something — it reads what exists and only rewrites what
you name.

> `content/content-doctrine.example.md` is one product's doctrine, included to show the
> shape of a working one. `/setup-social` uses it as a structural reference and writes
> yours from scratch. `/create-posts` refuses to fall back to it.

### It learns from your corrections

The first batch will get things wrong. That is expected — no interview captures how
someone writes.

So when you push back on a draft — *"too salesy"*, *"stop opening with a question"*,
*"I'd never say that"* — it fixes the draft **and asks whether to remember it.** If you
say yes, the rule goes into `content/preferences.md`, dated, with your own words
recorded underneath:

```markdown
## Voice
- 2026-03-04 — Open with a concrete number rather than a claim.
  *From:* "the hook feels vague, give me the actual figure up front"
```

`/create-posts` reads that file **above the doctrine** — the doctrine is what you
planned, preferences are what you have since corrected, so corrections win.

`/refine` does the same thing any time, including for posts already published:

```
/refine the LinkedIn ones are too long, cut them by a third
/refine that carousel got 4x the reach of the infographic
```

Three deliberate choices about how this works:

- **Nothing is recorded silently.** You are always asked, and every rule keeps the raw
  feedback that produced it. You can read the file in two minutes and recognise every
  line as something you actually said.
- **One-off fixes are not preferences.** A wrong figure gets corrected and forgotten. A
  pattern gets recorded — and if you correct the same thing twice, it will notice and
  offer to.
- **One good post is an anecdote.** Performance feedback is recorded as evidence with a
  hedge, and only promoted to a rule once the pattern repeats. Otherwise you end up
  rewriting your strategy around noise.

It is a plain Markdown file. Delete any line you disagree with — that is the whole
undo mechanism.

### Then `/create-posts`

It reads your profile and doctrine, checks `content-history.json` so it never repeats a
topic, format or hook inside your thresholds, writes each post natively for its
platform, builds any assets, converts your audience's local times into the browser
times the schedulers expect, and queues everything as `pending`. It publishes nothing.

Asset helpers, usable on their own:

- `assets/build_assets.cjs` — HTML → PNG/PDF via headless Chrome (1080×1080 squares,
  1080×1920 verticals, LinkedIn PDF carousels)
Images and video come from your AI client — Claude Code directly, or an MCP server you
connect (see [Video, via MCP](#video-via-mcp)). PostCraft has no model of its own and no
key of its own.

One convention worth keeping when you generate illustrations: **ask for artwork with no
text in it**, and add every word afterwards in HTML/CSS through `build_assets.cjs`. That
is why output built this way never has the mangled pseudo-lettering image models produce.

---

## Video, via MCP

This repo schedules video but does not create it. For motion-graphics video — the 9:16
kind that goes to Reels, Shorts and TikTok — connect an MCP server to Claude Code and
let it generate the file, then queue the result like any other asset.

### Relo

[Relo](https://www.relo.video) generates motion-graphics video from a written brief:
stock footage, captions, background music, brand kit and AI voiceover (including a clone
of your own voice). Its MCP endpoint is:

```
https://www.relo.video/mcp
```

Add it to Claude Code:

```bash
claude mcp add --transport http relo https://www.relo.video/mcp
```

Then `/mcp` inside Claude Code to authenticate. Once connected you get tools for
creating, previewing, editing, rendering and downloading video, and `/create-posts` will
use them for any post that needs one.

**Set up on relo.video first** (neither can be done from the MCP): fill in your **brand
kit** so videos carry your colours and logo, and record a **voice sample** if you want
narration in your own voice.

**Working notes, learned the hard way:**

- Video creation **spends credits**. `/create-posts` quotes the total and waits for your
  approval before calling anything.
- **Failed generations are refunded in full**, so retrying costs nothing.
- **Check 8–10 preview frames before paying to render.** Text sometimes overflows the
  right edge of the frame, and a sparse 3-frame sample lands on transitions and makes
  intact scenes look empty.
- **Decide the brand kit at creation.** If it is off, the end card gets a generic
  placeholder icon and no later edit can swap your logo in — the asset simply is not
  attached to that video.
- **Write your social handle into the brief explicitly.** Left to infer, the model
  invents a plausible variant, and it gets burned into the render.
- Render **9:16 once** — that single file covers X, Instagram Reels and TikTok.

### Other MCP servers

Nothing here is Relo-specific. Any MCP server you connect becomes available to
`/create-posts`, so you can slot in whatever your workflow needs — image generation,
research, analytics, a writing assistant, your own internal tools. The command uses
whatever is connected; there is no list to update.

```bash
claude mcp add --transport http <name> <url>    # remote server
claude mcp add <name> -- <command>              # local stdio server
claude mcp list                                 # what is connected
```

If you connect nothing, everything still works — you supply the media yourself and the
scheduler does not care where it came from.

---

## For contributors

Each driver is one file in `lib/`, exporting a `schedule(page, post, opts)` function and
a small descriptor (port, URL, accepted types, caption limit). Adding a platform means
adding `lib/<name>.cjs` and one line in `schedule.cjs` — the runner does not change.

The comment block at the top of each driver documents that platform's traps. They are
worth reading before changing anything; most are non-obvious and cost real time to find.
A sample:

- Instagram's feed composer caps at 4:5 and rejects 9:16 by *disabling a button*, with
  the reason only in the DOM — indistinguishable from media still processing.
- TikTok's time field is a wheel picker: all 24 hours are in the DOM, but only the ~7
  inside the visible band are clickable. Clicking one outside it hits the page behind
  the popup.
- TikTok pre-fills the description with the filename, and raises a mandatory consent
  modal the first time you schedule.
- LinkedIn's composer lives in a shadow root; its date field rejects its own placeholder
  format and its time field ignores typed input entirely.
- Meta Business Suite freezes Chrome DevTools Protocol outright if you navigate away
  from an open composer. Only a human can clear it.

If a driver breaks, the failure screenshot plus the DOM at that moment is almost always
enough to find the change. PRs welcome.

---

## Things you should know before using this

**Browser automation is against most platforms' terms of service.** You are running it
yourself, on your machine, against your own accounts, with sessions you created by hand
— but read the terms and make your own decision. No one else is operating this for you.

**Never commit your profile directories.** They contain live session cookies; publishing
one hands over your accounts. They are gitignored — keep it that way. They also grow to
several hundred MB each, which is a second good reason.

**Your queue and history are yours.** `posts.json` and `content-history.json` are
gitignored too. Only the `.example` files are meant to be shared.

## Licence

MIT. No warranty — if it schedules something at the wrong time, that is on you to check.
