# PostCraft - scheduling reference (LinkedIn, X, Instagram, TikTok)

Browser automation against a real logged-in session. No APIs, no third-party tools.

## One-time setup

Each platform gets its own Chrome profile on its own debug port, so the sessions
stay logged in and never collide with your everyday browser.

```bash
# LinkedIn
"C:/Program Files/Google/Chrome/Application/chrome.exe" \
  --remote-debugging-port=9222 \
  --user-data-dir="<repo>/chrome-linkedin-profile" \
  --no-first-run --no-default-browser-check https://www.linkedin.com/feed/

# X
"C:/Program Files/Google/Chrome/Application/chrome.exe" \
  --remote-debugging-port=9223 \
  --user-data-dir="<repo>/chrome-x-profile" \
  --no-first-run --no-default-browser-check https://x.com/home

# Instagram (via Meta Business Suite)
"C:/Program Files/Google/Chrome/Application/chrome.exe" \
  --remote-debugging-port=9224 \
  --user-data-dir="<repo>/chrome-ig-profile" \
  --no-first-run --no-default-browser-check https://business.facebook.com/latest/home

# TikTok (via TikTok Studio)
"C:/Program Files/Google/Chrome/Application/chrome.exe" \
  --remote-debugging-port=9225 \
  --user-data-dir="<repo>/chrome-tiktok-profile" \
  --no-first-run --no-default-browser-check https://www.tiktok.com/tiktokstudio/upload
```

Instagram goes through Business Suite because instagram.com cannot schedule at
all - it only posts immediately. This needs the IG account to be Business or
Creator and connected in Business Suite.

TikTok goes through TikTok Studio, the only surface that offers scheduling. It
accepts 9:16 natively, unlike Instagram's feed composer.

Log in once per profile. The session persists, so later runs skip the login.
Leave the window open while scheduling.

## Adding a post

Add an entry to `posts.json`:

```json
{
  "id": "unique-slug",
  "platform": "linkedin" | "x" | "instagram",
  "type": "document" | "images" | "image",
  "file": "path/to.pdf",              // single-asset posts
  "files": ["a.png", "b.png"],        // multi-image (X max 4, IG max 10)
  "documentTitle": "Shown above a LinkedIn PDF",
  "when": "2026-09-08T09:00",
  "caption": "...",
  "status": "pending"
}
```

`when` is local time, `YYYY-MM-DDTHH:MM`, minutes on a 15-minute boundary
(all three platforms only offer quarter-hour slots).

## Running

```bash
node schedule.cjs --list                    # show the queue
node schedule.cjs --id <post-id> --dry-run  # rehearse
node schedule.cjs --id <post-id>            # commit
node schedule.cjs --all --dry-run           # every pending post
```

One entry point for every platform and post type. The driver is chosen from the
post's `platform`; only `attachMedia()` branches on `type`, because LinkedIn
really does use a different UI for documents and images. Adding a platform means
adding `lib/<name>.cjs` - the runner does not change.

`--dry-run` fills everything in and stops before the final click, leaving the
composer open for inspection. Always dry-run first.
Add `--force` to re-run a post already marked `scheduled`.

On success the script flips that entry's `status` to `scheduled` so a later run
can't silently double-post it.

## What the manifest refuses to do

`lib/manifest.cjs` validates before touching a browser:

- caption over the platform limit (X 280, Instagram 2200, LinkedIn 3000)
- a `when` in the past, or off a 15-minute boundary
- too many images (X 4, Instagram 10, LinkedIn 20)
- a missing asset file
- a post already marked `scheduled` (unless `--force`)
- running the wrong composer flow for the post's `type`
- a post whose `platform` doesn't match the script

## Verifying afterwards

- **LinkedIn** — composer → clock icon → "View all scheduled posts". The
  direct URLs (`/feed/scheduled-posts/`, `/my-items/posts/`) are 404s.
- **X** — composer → schedule icon → "Scheduled posts", or the Drafts →
  Scheduled tab.
- **Instagram** — Business Suite → Content → Scheduled tab.
- **TikTok** — Studio → Manage posts. A scheduled video shows a FUTURE date
  ("Sep 14, 2:30 AM") and 0 views; published ones show a past date and real
  counts. There is no separate "scheduled" tab.

Step-by-step screenshots land in `output/schedule_verification/<post-id>/`.

---

## Platform quirks (learned the hard way)

### LinkedIn

LinkedIn serves two composers depending on the account, and the driver handles both.

**Current build (Sep 2026):**
- The composer is in the **light DOM**, not a shadow root.
- Scheduling is behind a **clock icon immediately left of Post**. It is an `<a>`, not a
  button, it has no `aria-label`, and its only text is the scheduled-post count ("1") -
  so it matches nothing you would search for by name. Find it by position instead.
- The date and time inputs **no longer carry `aria-label="Date"` / `"Time"`**. Locate
  them by the shape of their value: `M/D/YYYY` and `H:MM AM/PM`.
- The panel commits with **Confirm** (older builds used Next).
- LinkedIn rewrites `4:00 PM` to `4:00PM` on blur, so compare times ignoring spaces or
  the read-back check fails on a post that was actually set correctly.

**Older build** quirks, still supported:


- The whole composer lives in a **shadow root**. Queries must skip the light DOM
  or they match the feed's own "Show more" / "Post" / "Next" buttons. Walking the
  full DOM on every retry is slow enough to look like a hang.
- **"Add a document" is hidden behind the "More" menu.** Toolbar labels are
  `Add media`, `Create an event`, `Celebrate an occasion`, `More`.
- **The date field rejects its own placeholder format.** It shows `mm/dd/yyyy`
  but only accepts `m/d/yyyy`, and the calendar must be dismissed or the value
  silently reverts to today.
- **Dismiss that calendar with `Tab`, never `Escape`.** Escape propagates past
  the calendar, tries to close the whole composer, and raises a "Save this post
  as a draft?" modal that then covers the Time field.
- **The time field is not a text input.** It's an artdeco typeahead that ignores
  typing entirely. Only a real mouse press on the `li[role="option"]` commits,
  and the list renders off-screen until the option is scrolled into view.

The last two are why the script reads both fields back and aborts on mismatch.
Without that check a run looks like a clean success and posts at the wrong time.

### X

- **Two composers exist at once** (the modal and the inline one behind it), and
  the modal is *not* always inside `[role="dialog"]` — it depends how you
  navigated in. Resolve it structurally: largest visible `tweetTextarea_0`, then
  walk up to the ancestor holding its own `fileInput`.
- React replaces those nodes on re-render, so resolve a **fresh handle at every
  use**; a cached selector or a tagged attribute goes stale.
- **`tweetButtonInline` is the wrong button.** The modal's is `tweetButton`
  (labelled "Schedule"). The inline one is disabled — clicking it does nothing
  while looking like success.
- A bare `.focus()` does not arm the editor; click it, then confirm
  `document.activeElement` before sending keystrokes.
- The schedule dialog is six plain `<select>`s, but they're React-controlled:
  set via the native setter and dispatch `input` + `change`.

### Instagram (Business Suite)

- **The caption editor is covered by an overlay div**, so a mouse click never
  reaches it (`elementFromPoint` returns something else). `focus()` plus CDP
  `Input.insertText` is what works.
- **Uploading many files at once silently drops some.** Seven at once attached
  four and raised "Couldn't Upload Photos" only afterwards. Upload in chunks of
  three, count the "Remove photo" controls after each, retry the shortfall.
- **The date is a calendar popup**, not a typed field, so the driver navigates
  months and clicks the day cell. Time is three separate inputs: `hours`,
  `minutes`, `meridiem`.
- **The time inputs always read `value=""`.** The digits you see live in a
  sibling span next to each input - verify from there, not from `.value`.
- Business Suite refuses anything sooner than 20 minutes out or further than
  29 days.

### TikTok (TikTok Studio)

- **The description box is pre-filled with the FILENAME.** Clear it before typing or
  the caption ends up appended to "my-video.mp4".
- **Choosing "Schedule" raises a mandatory consent modal** ("Allow your video to be
  saved for scheduled posting?"). Until Allow is clicked the radio never registers as
  checked, which looks exactly like the click failing.
- **"When to post" sits below the fold.** Scroll it into view before clicking - a mouse
  click at an off-screen y silently hits nothing.
- **Onboarding overlays** ("Preview your post") grey out the page and swallow every
  click. Dismiss them before each interactive phase.
- **The time field is a wheel picker.** All 24 hours exist in the DOM but only the ~7
  inside the visible band are clickable; clicking an item outside it lands on the page
  BEHIND the popup and can navigate into the cover editor. Centre the item with
  measured `getBoundingClientRect` deltas - `offsetTop` is relative to the offset
  parent, not the scroller, and aims at the wrong place.
- **The submit button relabels from "Post" to "Schedule"** once scheduling is on, and
  it sits in the footer row with "Save draft" / "Discard".
- **A failed run can strand the page on `/tiktokstudio/upload/unavailable`**, which has
  no file input. The next run then fails with "No file input on the upload page".
  Discard the draft and navigate back to the upload URL.

### All four

**Never `page.goto()` while a draft is open.** All three raise a native
beforeunload dialog that freezes CDP completely — screenshots, evaluate, even
`Page.handleJavaScriptDialog` all hang, and only a human clicking the button
clears it. Close the composer through the UI first.

## Limitations

- Needs this machine awake with the right Chrome running. Cloud/scheduled agents
  can't reach a local browser.
- Sessions expire eventually and 2FA needs a human.
- Selectors are the platforms' markup, and they change without notice. Every
  break needs a fresh DOM probe.
- LinkedIn's User Agreement prohibits automated posting. Low practical risk at
  this volume, but it's your account.
- Not implemented: LinkedIn company-page posting (needs the "Post as"
  selector), X threads, Instagram Reels/Stories.

---

## Video posts (`type: video`)

`file` points at an MP4. Both X and Instagram accept video; LinkedIn video is not wired up.

**Instagram: 9:16 must go through Reels.** The "Create post" composer accepts only
4:5 to 16:9 and refuses anything taller by leaving the Schedule button disabled, with
the reason buried in the DOM and no visible error - it is indistinguishable from media
still processing. `lib/instagram.cjs` therefore routes `type: video` to
`lib/instagram-reel.cjs`, which drives the separate three-step Create reel composer
(Create -> Edit -> Share). Quirks are documented at the top of that file.

**Expect 2-4 minutes per video post.** Upload plus transcode is far slower than an
image. Both drivers poll rather than sleeping: X waits for the `<video>` element and an
enabled Post button, Instagram for "Next" to enable.

**Verify in the platform, never in the manifest.** The Instagram driver previously
returned `{scheduled: true}` after a blind 9-second sleep, marking posts scheduled while
nothing reached the platform. It now waits for the button to genuinely enable and
confirms the composer closes - but check Business Suite -> Content -> Scheduled anyway.
