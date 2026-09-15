---
description: Schedule the pending posts and videos from posts.json onto LinkedIn, X, Instagram and TikTok via the logged-in Chrome sessions, routing 9:16 video to Instagram Reels, with a dry run first and platform-side verification
---

# /schedule-posts

Ship what `/create-posts` queued. Browser automation against real logged-in sessions.
Platforms: LinkedIn, X, Instagram, TikTok.

Argument (optional): `$ARGUMENTS` may name a specific post id. Default: **every post with
`status: pending`**, one at a time, dry run first.

---

## STEP 0 — Preconditions

```bash
node schedule.cjs --list
```

Anything still carrying `[[ ]]` markers is **not ready**. Those are facts only the user
has. Ask them to fill the gaps, or drop that post from this run. Never invent the value
and never post the literal brackets.

---

## STEP 1 — Make sure the three sessions are up

**`curl` to localhost is sandboxed and reports every port as down — it lies.** Check
with node instead:

```bash
node -e '
const http=require("http");
const check=p=>new Promise(r=>{
  const q=http.get({host:"127.0.0.1",port:p,path:"/json/version",timeout:4000},res=>{
    let d="";res.on("data",c=>d+=c);res.on("end",()=>r(p+": "+(JSON.parse(d).Browser||"?")));
  });
  q.on("error",e=>r(p+": DOWN"));q.on("timeout",()=>{q.destroy();r(p+": TIMEOUT")});
});
(async()=>{for(const p of [9222,9223,9224,9225])console.log(await check(p));})();
'
```

9222 LinkedIn · 9223 X · 9224 Instagram (Meta Business Suite) · 9225 TikTok (TikTok Studio).

If any is down, tell the user to double-click **"Start Social Sessions"** on the desktop
(or run `powershell -ExecutionPolicy Bypass -File start_sessions.ps1`). It only launches
what is missing, so it is safe to run any time.

Then confirm each is actually logged in. A session that has expired lands on a login page
and the driver exits with `NOT_LOGGED_IN`. Only the user can clear a 2FA prompt.

---

## STEP 2 — Dry run, always

```bash
node schedule.cjs --id <post-id> --dry-run
```

This fills the composer completely and **stops before the final click**, leaving it open
for inspection. It also read-back-verifies the date and time and aborts on a mismatch,
which is the check that catches a silent revert.

Read the step screenshots in `output/schedule_verification/<post-id>/` and confirm:
media attached and the right count, caption intact with paragraph breaks, date and time
correct, the button says Schedule.

---

## STEP 3 — Commit

```bash
node schedule.cjs --id <post-id>
```

On success `schedule.cjs` flips that entry to `scheduled` in `posts.json` so a later run
cannot silently double-post it.

Then update the matching row in `content-history.json` from `"status": "draft"` to
`"status": "scheduled"`. Never delete history rows.

---

## STEP 4 — Verify in the platform, not in the log

A click that appears to work is not proof. Check the platform's own queue:

- **LinkedIn** — composer → clock icon → "View all scheduled posts".
  The direct URLs (`/feed/scheduled-posts/`, `/my-items/posts/`) are 404s.
- **X** — composer → schedule icon → "Scheduled posts", or Drafts → Scheduled.
- **TikTok** — Studio → **Manage posts**. A scheduled video appears in the list with
  its future date ("Sep 14, 2:30 AM") and 0 views; published ones carry a past date
  and real counts. There is no separate "scheduled" tab.
- **Instagram** — Business Suite → Content → **Scheduled** tab. Direct URL:
  `https://business.facebook.com/latest/posts/scheduled_posts?asset_id=<id>&business_id=<id>`
  (both ids appear in the URL after `/latest/home` redirects).

Report what the platform itself says, quoting its own wording. A freshly uploaded reel
shows "Processing..." in that list for a while — it is queued regardless.

---

## Video posts (`type: video`)

**Instagram will not take 9:16 as a feed post.** The "Create post" composer caps at
**4:5 to 16:9** and refuses anything taller by leaving Schedule disabled, with the reason
buried in the DOM and no visible error — it looks exactly like media still processing.
`lib/instagram.cjs` routes `type: video` to `lib/instagram-reel.cjs`, which drives the
separate three-step **Create reel** composer. This is automatic; do not "fix" it by
re-rendering at 4:5, since Reels get materially better reach.

**Video is slow.** Upload plus transcode runs minutes, not the 10 seconds an image takes.
Both drivers poll for completion — X waits for the `<video>` element and an enabled Post
button, Instagram for "Next" to enable. Give each post a generous timeout and expect a
single video post to take 2–4 minutes.

**TikTok** takes 9:16 natively — no Reels-style branch needed. Its quirks live in
`lib/tiktok.cjs`, and the ones that bite hardest:

- The description box is **pre-filled with the filename**; it must be cleared or the
  caption lands appended to `my-video.mp4`.
- Choosing "Schedule" raises a **required consent modal** ("Allow your video to be
  saved for scheduled posting?"). Until Allow is clicked the radio never registers,
  which reads exactly like a failed click.
- "When to post" sits **below the fold**. Scroll it into view before clicking — a
  mouse click at an off-screen y silently hits nothing.
- Onboarding overlays ("Preview your post") grey out the page and swallow every
  click. Dismiss them before each interactive phase.
- The time field is a **wheel picker**. All 24 hours are in the DOM but only ~7 are
  inside the clipped band; clicking an off-band item lands on the page *behind* the
  popup and can navigate into the cover editor. Centre the item using **measured
  rect deltas** — `offsetTop` is relative to the offset parent, not the scroller,
  and produces a wrong target.
- The submit button **relabels from "Post" to "Schedule"** once scheduling is on.

**If a TikTok run fails oddly, check the page is not stranded on
`/tiktokstudio/upload/unavailable`** — stray clicks land there, and it has no file
input, so the next run fails with "No file input on the upload page". Discard the
draft and re-navigate to the upload URL.

**Reels are silent about the aspect-ratio failure.** If a video post stalls on a disabled
button, read the DOM for the real reason before assuming it is still processing:

```bash
# inside the composer: surface any hidden validation message
node -e '...page.evaluate(() => document.body.innerText.split("\n")
  .filter(l => /aspect ratio|error|unsupported|cannot/i.test(l)))'
```

---

## Failure modes you will actually hit

**The manifest's `scheduled` flag is not proof.** The Instagram driver used to click
Schedule, sleep 9s, and return success without checking anything — marking posts
scheduled while nothing reached the platform. That is fixed (it now waits for the button
to genuinely enable and confirms the composer closes), but the lesson stands: **always
verify in the platform's own queue**, per STEP 4.

**Never close every tab to clear a stuck browser — Chrome exits.** Close the wedged tab
only, or open a fresh one and work there:

```bash
# open a clean tab without touching the frozen one (works while CDP is hung)
node -e 'require("http").request({host:"127.0.0.1",port:9224,
  path:"/json/new?"+encodeURIComponent("https://business.facebook.com/latest/home"),
  method:"PUT"},r=>r.on("data",d=>console.log(d.toString()))).end()'
```

**`puppeteer.connect` attaches to every tab**, so one wedged tab freezes the whole
connection — even `Network.enable` times out. Close it before connecting.

**A stale `lockfile` in the profile blocks relaunch.** If Chrome died, delete
`chrome-<platform>-profile/lockfile` before starting it again. "Device or resource busy"
means a live Chrome still holds it — do not force it.

**Launch Chrome detached or it dies with the shell:**
`cmd //c start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=<port> --user-data-dir="<repo>\chrome-<x>-profile" ...`

**`ElementHandle.click()` stalls on heavy Business Suite pages** — it runs a
`scrollIntoView` evaluate that times out while a video preview renders. Focus through
`page.evaluate` instead, and use `protocolTimeout: 240000`.

**A native "Leave site?" dialog freezes CDP completely.** Screenshots, evaluate, even
`Page.handleJavaScriptDialog` all hang. Only a human clicking the button clears it. All
three drivers close the composer through the UI before navigating to avoid causing one,
but if you hit it, stop and ask the user to click it. Do not retry.

**Never `page.goto()` while a draft is open.** That is what causes the above.

Platform quirks are documented in `SCHEDULING.md`, including LinkedIn's date field
rejecting its own placeholder format, its time typeahead ignoring typed input, X having
two composers at once, and Instagram dropping files on multi-upload.

---

## Rules

- **Dry run before every commit.** No exceptions.
- One post at a time. If one fails, keep going and report a summary at the end.
- Never `--force` unless the user explicitly asks.
- Never edit a caption at this stage. If it is wrong, go back to `/create-posts`.
- Report honestly: if a post did not schedule, say so plainly with the error.
