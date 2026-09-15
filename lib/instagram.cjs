/**
 * Instagram driver, via Meta Business Suite.
 *
 * instagram.com itself cannot schedule at all - it only posts immediately - so
 * scheduling goes through business.facebook.com, which also happens to be a far
 * calmer surface to automate than instagram.com.
 *
 * Requires the IG account to be Business/Creator and connected in Business Suite.
 *
 * Quirks:
 *   - The caption editor's centre is covered by an overlay div, so a mouse click
 *     never lands. focus() + CDP Input.insertText is what actually works.
 *   - Uploading many files at once silently drops some ("Couldn't Upload Photos").
 *     Upload in small chunks and verify the running count.
 *   - The date field is a calendar popup, not a typed field. Time is three
 *     separate text inputs: hours / minutes / meridiem.
 *   - Business Suite refuses anything sooner than 20 minutes out or further than
 *     29 days.
 */
const path = require('path');
const { scheduleReel } = require('./instagram-reel.cjs');

const PORT = 9224;
const CHUNK = 3;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function clickByText(page, re, what) {
  return page.evaluate(src => {
    const rx = new RegExp(src, 'i');
    const el = Array.from(document.querySelectorAll('[role="button"],button,a'))
      .find(e => rx.test((e.innerText || '').trim()) && e.getBoundingClientRect().width > 0);
    if (!el) return false;
    el.click();
    return true;
  }, re.source).then(ok => {
    if (!ok && what) throw new Error(`Could not click ${what}`);
    return ok;
  });
}

/** Tiles carry a "Remove photo" control; counting them counts real attachments. */
// Business Suite labels the thumbnail's delete control "Remove photo" for images
// and "Remove video" for clips, so match either or a video post counts as zero.
function mediaCount(page) {
  return page.evaluate(() => Array.from(document.querySelectorAll('[role="button"]'))
    .filter(e => /remove (photo|video|media)/i.test((e.innerText || '') + (e.getAttribute('aria-label') || '')))
    .length);
}

async function dismissErrors(page) {
  await page.evaluate(() => {
    const body = document.body.innerText || '';
    if (/Couldn't Upload|couldn't upload/i.test(body)) {
      const c = Array.from(document.querySelectorAll('[role="button"],button'))
        .find(e => /^close$/i.test((e.innerText || '').trim()) && e.getBoundingClientRect().width > 0);
      if (c) c.click();
    }
  });
  await sleep(1200);
}

async function uploadChunk(page, files) {
  const [chooser] = await Promise.all([
    page.waitForFileChooser({ timeout: 25000 }),
    clickByText(page, /^add photo\/video$/, 'Add photo/video'),
  ]);
  await chooser.accept(files);

  const isVideo = files.some(f => /\.(mp4|mov|webm|m4v)$/i.test(f));
  if (isVideo) {
    // Meta uploads and then transcodes; the thumbnail (and its "Remove video"
    // control) only appears once that finishes. A fixed sleep is nowhere near
    // long enough for a 10MB+ clip, so wait for the control itself.
    console.log('   waiting for video upload and processing...');
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll('[role="button"]'))
        .some(e => /remove (video|media)/i.test((e.innerText || '') + (e.getAttribute('aria-label') || ''))),
      { timeout: 300000, polling: 3000 },
    ).catch(() => console.log('   (no remove-control seen; dry-run will show the real state)'));
    await sleep(3000);
  } else {
    await sleep(4000 + 2500 * files.length);
  }
  await dismissErrors(page);
}

/**
 * Leave an open composer through its own Cancel button before navigating.
 * Business Suite raises a native beforeunload dialog otherwise, and that freezes
 * CDP completely - only a human clicking the button clears it.
 */
async function closeComposerIfOpen(page) {
  for (let i = 0; i < 3; i++) {
    const open = await page.evaluate(() =>
      !!document.querySelector('[contenteditable="true"]') &&
      /Create post|Post details/i.test(document.body.innerText || ''));
    if (!open) return;
    await clickByText(page, /^cancel$/);
    await sleep(2000);
    // "Discard post?" style confirmation
    await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll('[role="button"],button'))
        .find(e => /^(discard|discard post|yes, discard|ok)$/i.test((e.innerText || '').trim())
                   && e.getBoundingClientRect().width > 0);
      if (b) b.click();
    });
    await sleep(2500);
  }
}

async function schedule(page, post, { dryRun, shot }) {
  // 9:16 cannot go through the feed composer at all - Business Suite caps feed
  // posts at 4:5 and refuses taller clips silently. Route video to Reels.
  if (post.type === 'video') return scheduleReel(page, post, { dryRun, shot });

  const files = post.files.map(f => path.resolve(post.rootDir, f));
  page.on('dialog', async d => { await d.accept().catch(() => {}); });

  console.log('Opening the composer...');
  await closeComposerIfOpen(page);
  await page.goto('https://business.facebook.com/latest/home', { waitUntil: 'domcontentloaded', timeout: 40000 }).catch(() => {});
  await sleep(6000);
  await clickByText(page, /^create post$/, '"Create post"');
  await page.waitForSelector('[contenteditable="true"]', { timeout: 30000 });
  await sleep(4000);
  await shot(page, 'composer');

  const target = await page.evaluate(() =>
    (document.body.innerText.match(/Post to\n+([^\n]+)/) || [])[1] || null);
  console.log('   posting to:', target);

  // --- media, in chunks: a single big batch silently drops files ---
  console.log(`Uploading ${files.length} image(s) in chunks of ${CHUNK}...`);
  for (let i = 0; i < files.length; i += CHUNK) {
    const chunk = files.slice(i, i + CHUNK);
    await uploadChunk(page, chunk);
    let have = await mediaCount(page);
    const want = Math.min(i + chunk.length, files.length);
    if (have < want) {
      console.log(`   ${have}/${want} after chunk, retrying the missing ${want - have}`);
      await uploadChunk(page, files.slice(have, want));
      have = await mediaCount(page);
    }
    console.log(`   ${have}/${files.length}`);
  }
  const attached = await mediaCount(page);
  if (attached !== files.length) {
    await shot(page, 'FAIL_media');
    throw new Error(`Only ${attached}/${files.length} images attached`);
  }
  await shot(page, 'media');

  // --- caption: the editor is covered by an overlay, so clicks never land ---
  console.log('Writing the caption...');
  const focused = await page.evaluate(() => {
    const e = document.querySelector('[contenteditable="true"]');
    if (!e) return false;
    e.scrollIntoView({ block: 'center' });
    e.focus();
    return document.activeElement === e || e.contains(document.activeElement);
  });
  if (!focused) { await shot(page, 'FAIL_caption_focus'); throw new Error('Could not focus the caption editor'); }
  const cdp = await page.createCDPSession();
  await cdp.send('Input.insertText', { text: post.caption });
  await sleep(1500);
  const typed = await page.evaluate(() =>
    (document.querySelector('[contenteditable="true"]').innerText || '').trim());
  console.log(`   ${typed.length} chars in the box`);
  if (typed.length < 20) { await shot(page, 'FAIL_caption'); throw new Error('Caption did not land'); }
  await shot(page, 'caption');

  // --- schedule toggle ---
  console.log(`Setting ${post.whenLabel}...`);
  const already = await page.evaluate(() => {
    const cb = document.querySelector('input[aria-label="Set date and time"]');
    return cb ? cb.value === 'true' || cb.checked : null;
  });
  if (!already) {
    await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('[aria-label],[role="button"],button'))
        .find(e => /set date and time/i.test(e.getAttribute('aria-label') || '') && e.getBoundingClientRect().width > 0);
      if (el) el.click();
    });
    await sleep(3000);
  }

  // --- date: a calendar popup, not a typed field ---
  const wantMonth = `${MONTHS[post.dt.getMonth()]} ${post.dt.getFullYear()}`;
  const dateBox = await page.evaluate(() => {
    const i = Array.from(document.querySelectorAll('input'))
      .find(x => /^[A-Z][a-z]{2} \d{1,2}, \d{4}$|^\d{1,2}\/\d{1,2}\/\d{4}$/.test(x.value || ''));
    if (!i) return null;
    i.scrollIntoView({ block: 'center' });
    const r = i.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  if (!dateBox) { await shot(page, 'FAIL_no_date'); throw new Error('Date field not found'); }
  await sleep(600);
  await page.mouse.click(dateBox.x, dateBox.y);
  await sleep(2500);

  for (let i = 0; i < 13; i++) {
    // Read the month from the CALENDAR, not from document.body: the feed behind the
    // modal is full of dates and body.innerText happily matches one of those instead.
    const shown = await page.evaluate(() => {
      const cell = document.querySelector('[role="gridcell"]');
      if (!cell) return null;
      const rx = /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/;
      for (let n = cell.parentElement, i = 0; n && i < 8; n = n.parentElement, i++) {
        const m = (n.innerText || '').match(rx);
        if (m) return m[0];
      }
      return null;
    });
    if (shown === wantMonth) break;
    if (i === 12) { await shot(page, 'FAIL_month'); throw new Error(`Could not reach ${wantMonth} (showing ${shown})`); }
    const fwd = post.dt > new Date();
    await page.evaluate(f => {
      const el = Array.from(document.querySelectorAll('[role="button"],button'))
        .find(e => new RegExp(f ? 'next month' : 'previous month', 'i').test((e.innerText || '') + (e.getAttribute('aria-label') || '')));
      if (el) el.click();
    }, fwd);
    await sleep(1200);
  }

  const day = String(post.dt.getDate());
  const cell = await page.evaluate(d => {
    const c = Array.from(document.querySelectorAll('[role="gridcell"]'))
      .find(x => (x.innerText || '').trim() === d);
    if (!c) return null;
    c.scrollIntoView({ block: 'center' });
    const r = c.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, day);
  if (!cell) { await shot(page, 'FAIL_day'); throw new Error(`Day ${day} not found in the calendar`); }
  await sleep(500);
  await page.mouse.click(cell.x, cell.y);
  await sleep(2500);

  // --- time: three separate text inputs ---
  const h12 = post.dt.getHours() % 12 === 0 ? 12 : post.dt.getHours() % 12;
  const parts = [
    ['hours', String(h12)],
    ['minutes', String(post.dt.getMinutes()).padStart(2, '0')],
    ['meridiem', post.dt.getHours() < 12 ? 'AM' : 'PM'],
  ];
  for (const [label, value] of parts) {
    const ok = await page.evaluate(l => {
      const i = Array.from(document.querySelectorAll('input')).find(x => x.getAttribute('aria-label') === l);
      if (!i) return false;
      i.scrollIntoView({ block: 'center' });
      i.focus();
      i.select && i.select();
      return true;
    }, label);
    if (!ok) { await shot(page, 'FAIL_time'); throw new Error(`Time field "${label}" not found`); }
    await sleep(350);
    await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control');
    await sleep(200);
    await page.keyboard.type(value, { delay: 60 });
    await sleep(600);
  }
  await sleep(1200);

  // --- verify before committing ---
  const check = await page.evaluate(() => {
    const body = document.body.innerText || '';
    const di = Array.from(document.querySelectorAll('input'))
      .find(x => /^[A-Z][a-z]{2} \d{1,2}, \d{4}$|^\d{1,2}\/\d{1,2}\/\d{4}$/.test(x.value || ''));
    const btn = Array.from(document.querySelectorAll('[role="button"],button'))
      .find(e => /^schedule$/i.test((e.innerText || '').trim()) && e.getBoundingClientRect().width > 0);
    // The time inputs always read value="" - the digits you see are rendered in
    // a sibling span next to each input, so that is where we verify from.
    const part = l => {
      const i = Array.from(document.querySelectorAll('input')).find(x => x.getAttribute('aria-label') === l);
      const s = i && i.previousElementSibling;
      return s ? (s.innerText || '').trim() : null;
    };
    const hh = part('hours'), mm = part('minutes'), ap = part('meridiem');
    return {
      date: di ? di.value : null,
      time: (hh && mm && ap) ? `${hh}:${mm} ${ap}` : null,
      error: body.split('\n').map(s => s.trim())
        .find(l => /need to be shared|Couldn't Upload|something went wrong/i.test(l)) || null,
      hasButton: !!btn,
    };
  });
  console.log(`   fields: ${check.date} / ${check.time}`);
  if (check.error) { await shot(page, 'FAIL_validation'); throw new Error('Business Suite says: ' + check.error); }

  const wantDay = post.dt.getDate(), wantMon = post.dt.getMonth() + 1, wantYr = post.dt.getFullYear();
  const dm = (check.date || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const dm2 = (check.date || '').match(/^([A-Z][a-z]{2}) (\d{1,2}), (\d{4})$/);
  const dateOk = dm
    ? (+dm[1] === wantMon && +dm[2] === wantDay && +dm[3] === wantYr)
    : dm2
      ? (MONTHS[post.dt.getMonth()].startsWith(dm2[1]) && +dm2[2] === wantDay && +dm2[3] === wantYr)
      : false;
  const timeOk = (check.time || '').replace(/^0/, '').replace(/\s/g, '').toUpperCase() ===
    `${h12}:${String(post.dt.getMinutes()).padStart(2, '0')}${post.dt.getHours() < 12 ? 'AM' : 'PM'}`;
  if (!dateOk || !timeOk) {
    await shot(page, 'FAIL_datetime');
    throw new Error(`Date/time did not stick: got ${check.date} ${check.time}, wanted ${post.whenLabel}`);
  }
  if (!check.hasButton) { await shot(page, 'FAIL_no_button'); throw new Error('Schedule button not present'); }
  await shot(page, 'ready');

  if (dryRun) return { dryRun: true };

  // Business Suite keeps Schedule disabled until it has finished processing the
  // media server-side. A video can still be processing long after its thumbnail
  // appears, and clicking a disabled button is a silent no-op - which is how
  // posts used to be reported as scheduled without ever being scheduled.
  console.log('Waiting for the Schedule button to enable...');
  await page.waitForFunction(() => {
    const b = Array.from(document.querySelectorAll('[role="button"],button'))
      .find(e => /^schedule$/i.test((e.innerText || '').trim()) && e.getBoundingClientRect().width > 0);
    if (!b) return false;
    return b.getAttribute('aria-disabled') !== 'true' && !b.disabled;
  }, { timeout: 300000, polling: 2000 })
    .catch(async () => {
      await shot(page, 'FAIL_button_disabled');
      throw new Error('Schedule button never enabled - media probably still processing');
    });

  console.log('Clicking Schedule...');
  await clickByText(page, /^schedule$/, 'the Schedule button');

  // Verify it actually took: on success the composer closes. If it is still
  // open after the wait, the click did nothing and this post is NOT scheduled.
  const closed = await page.waitForFunction(() => {
    const composerOpen = !!document.querySelector('[contenteditable="true"]')
      && /Create post|Post details/i.test(document.body.innerText || '');
    return !composerOpen;
  }, { timeout: 90000, polling: 2000 }).then(() => true).catch(() => false);

  await shot(page, 'confirmation');
  if (!closed) {
    throw new Error('Composer stayed open after clicking Schedule - post was NOT scheduled');
  }
  console.log('   composer closed - scheduled');
  return { scheduled: true };
}

module.exports = {
  PORT,
  urlMatch: 'facebook.com',
  homeUrl: 'https://business.facebook.com/latest/home',
  loginRe: /loginpage|\/login/,
  types: ['images', 'image', 'video'],
  captionLimit: 2200,
  schedule,
};
