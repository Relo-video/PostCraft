/**
 * TikTok driver, via TikTok Studio (studio upload page).
 *
 * Quirks learned driving it:
 *   - The description box is pre-filled with the FILENAME. Clear it before typing
 *     or the caption lands appended to "my-video.mp4".
 *   - Choosing "Schedule" raises a required consent modal ("Allow your video to be
 *     saved for scheduled posting?"). Until Allow is clicked the radio never
 *     registers as checked, which reads exactly like the click failing.
 *     A second, optional modal offers automatic content checks - declined here.
 *   - The date field opens a calendar. Scope the day cell lookup to the container
 *     holding the month header, or a stray number from the time picker matches.
 *   - The time field is a WHEEL PICKER: two scrollable columns, and the value
 *     commits from what lands in the centre band. The input's `value` is the only
 *     honest feedback, and it lags the click by a moment - poll it.
 *   - Writing to the inputs directly does nothing: React re-renders over it.
 *   - The submit button RELABELS from "Post" to "Schedule" once scheduling is on,
 *     and it sits below the fold. Identify it by the footer row it shares with
 *     "Save draft"/"Discard", which separates it from the "Schedule" radio label.
 *   - TikTok Studio schedules in the BROWSER's timezone, same as X and Instagram.
 *     It also enforces a ~20 minute minimum lead time.
 */
const path = require('path');

const PORT = 9225;
const sleep = ms => new Promise(r => setTimeout(r, ms));

function clickText(page, re, what) {
  return page.evaluate(src => {
    const rx = new RegExp(src, 'i');
    const el = Array.from(document.querySelectorAll('button,[role="button"],div[tabindex]'))
      .find(e => rx.test((e.innerText || '').trim()) && e.getBoundingClientRect().width > 0);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    el.click();
    return true;
  }, re.source).then(ok => {
    if (!ok && what) throw new Error(`Could not click ${what}`);
    return ok;
  });
}

/**
 * TikTok Studio drops feature-onboarding overlays ("Preview your post", "New
 * features added") over the editor. They grey out the page and swallow clicks,
 * so every interaction silently does nothing until they are dismissed. They
 * appear unpredictably - once per feature, per account - so clear them before
 * each interactive phase rather than once at the start.
 */
async function dismissOverlays(page) {
  for (let i = 0; i < 4; i++) {
    const hit = await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('button,[role="button"]'))
        .find(e => /^(got it|ok|okay|skip|next|done|dismiss)$/i.test((e.innerText || '').trim())
                   && e.getBoundingClientRect().width > 0);
      if (!el) return null;
      const t = (el.innerText || '').trim();
      el.click();
      return t;
    });
    if (!hit) return;
    await sleep(1500);
  }
}

const readFields = page => page.evaluate(() => {
  const out = { date: null, time: null };
  Array.from(document.querySelectorAll('input[type="text"]')).forEach(i => {
    const r = i.getBoundingClientRect();
    if (r.width <= 0) return;
    const v = i.value || '';
    const pos = { x: r.left + r.width / 2, y: r.top + r.height / 2, value: v };
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) out.date = pos;
    else if (/^\d{1,2}:\d{2}$/.test(v)) out.time = pos;
  });
  return out;
});

/** Calendar popup. Scoped to the month container so stray numbers cannot match. */
async function setDate(page, post, shot) {
  const want = `${post.dt.getFullYear()}-${String(post.dt.getMonth() + 1).padStart(2, '0')}-${String(post.dt.getDate()).padStart(2, '0')}`;
  let f = await readFields(page);
  if (!f.date) { await shot(page, 'FAIL_no_date'); throw new Error('TikTok date field not found'); }
  if (f.date.value === want) return;

  await page.mouse.click(f.date.x, f.date.y);
  await sleep(3000);

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const header = `${MONTHS[post.dt.getMonth()]} / ${post.dt.getFullYear()}`;

  for (let i = 0; i < 13; i++) {
    const shown = await page.evaluate(() => {
      const m = (document.body.innerText || '').match(/([A-Z][a-z]+)\s*\/\s*(\d{4})/);
      return m ? `${m[1]} / ${m[2]}` : null;
    });
    if (shown === header) break;
    if (i === 12) { await shot(page, 'FAIL_month'); throw new Error(`Could not reach ${header}`); }
    await page.evaluate(() => {
      const nav = Array.from(document.querySelectorAll('svg,span,div,button'))
        .filter(e => e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().width < 50);
      const next = nav[nav.length - 1];
      if (next) next.click();
    });
    await sleep(1200);
  }

  const hit = await page.evaluate(([month, year, day]) => {
    // Match the header with flexible whitespace: the DOM's spacing around the
    // slash does not match a naively rebuilt "September / 2026" string.
    const rx = new RegExp(month + '\\s*/\\s*' + year);
    const cal = Array.from(document.querySelectorAll('div')).find(e => {
      const t = e.innerText || '';
      const r = e.getBoundingClientRect();
      return rx.test(t) && /Sun/.test(t) && r.width > 200 && r.width < 700;
    });
    if (!cal) return null;
    const cells = Array.from(cal.querySelectorAll('*')).filter(e => {
      const r = e.getBoundingClientRect();
      return (e.innerText || '').trim() === day && !e.children.length && r.width > 0 && r.width < 80;
    });
    if (!cells.length) return null;
    const r = cells[0].getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, [MONTHS[post.dt.getMonth()], String(post.dt.getFullYear()), String(post.dt.getDate())]);
  if (!hit) { await shot(page, 'FAIL_day'); throw new Error('Day cell not found in the calendar'); }
  await page.mouse.click(hit.x, hit.y);
  await sleep(2500);

  f = await readFields(page);
  if (!f.date || f.date.value !== want) {
    await shot(page, 'FAIL_date_stuck');
    throw new Error(`Date did not stick: got ${f.date && f.date.value}, wanted ${want}`);
  }
}

/** Wheel picker: scroll each column until the input itself reads the target. */
async function setTime(page, post, shot) {
  const hh = String(post.dt.getHours()).padStart(2, '0');
  const mm = String(post.dt.getMinutes()).padStart(2, '0');
  const want = `${hh}:${mm}`;

  let f = await readFields(page);
  if (!f.time) { await shot(page, 'FAIL_no_time'); throw new Error('TikTok time field not found'); }
  if (f.time.value === want) return;

  await page.mouse.click(f.time.x, f.time.y);
  await sleep(3000);

  const geom = await page.evaluate(() => {
    const input = Array.from(document.querySelectorAll('input[type="text"]'))
      .find(x => /^\d{1,2}:\d{2}$/.test(x.value || '') && x.getBoundingClientRect().width > 0);
    const ir = input.getBoundingClientRect();
    const leaves = [];
    document.querySelectorAll('div,span,li').forEach(e => {
      const t = (e.innerText || '').trim();
      if (!/^\d{1,2}$/.test(t) || e.children.length) return;
      const r = e.getBoundingClientRect();
      if (r.width <= 0 || r.width > 90 || r.height > 60) return;
      if (r.bottom > ir.top + 5 || r.bottom < ir.top - 340) return;
      leaves.push({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
    });
    if (!leaves.length) return null;
    const xs = [...new Set(leaves.map(l => Math.round(l.x)))].sort((a, b) => a - b);
    const colOf = x => leaves.filter(l => Math.abs(l.x - x) < 25).sort((a, b) => a.y - b.y);
    const h = colOf(xs[0]);
    const m = xs.length > 1 ? colOf(xs[1]) : [];
    return {
      inputTop: ir.top,
      hourX: xs[0], hourMidY: (h[0].y + h[h.length - 1].y) / 2,
      minX: xs[1] || null, minMidY: m.length ? (m[0].y + m[m.length - 1].y) / 2 : null,
    };
  });
  if (!geom) { await shot(page, 'FAIL_picker'); throw new Error('Time picker did not open'); }

  // The columns scroll both ways; wanting 02 while sitting on 09 needs an
  // upward scroll, and a download-only loop can never reach it.
  /**
   * All 24 hours (and every minute step) exist in the DOM, but the column only
   * shows ~7 at a time. An item scrolled out of the clipped viewport still has
   * coordinates - pointing at the page BEHIND the popup - so clicking it lands
   * on the form underneath instead of selecting anything.
   *
   * So: centre the wanted item inside its scroller using measured rect deltas
   * (offsetTop is relative to the offset parent, which is not the scroller and
   * gives the wrong target), confirm it is actually inside the visible band,
   * then click it.
   */
  const pickExact = async (colX, value) => {
    for (let pass = 0; pass < 6; pass++) {
      const res = await page.evaluate(([cx, want]) => {
        const leaves = [];
        document.querySelectorAll('div,span,li').forEach(e => {
          if (e.children.length) return;
          const t = (e.innerText || '').trim();
          if (!/^\d{1,2}$/.test(t)) return;
          const r = e.getBoundingClientRect();
          if (r.width <= 0 || r.width > 90 || r.height > 60) return;
          if (Math.abs(r.left + r.width / 2 - cx) > 25) return;
          leaves.push(e);
        });
        if (!leaves.length) return { state: 'no-column' };

        let sc = leaves[0].parentElement;
        for (let k = 0; sc && k < 8; k++, sc = sc.parentElement) {
          if (sc.scrollHeight > sc.clientHeight + 5) break;
        }
        if (!sc) return { state: 'no-scroller' };

        const target = leaves.find(e => (e.innerText || '').trim() === want);
        if (!target) return { state: 'not-rendered' };

        const sr = sc.getBoundingClientRect();
        const tr = target.getBoundingClientRect();
        const inside = tr.top >= sr.top - 2 && tr.bottom <= sr.bottom + 2;
        if (inside) {
          return { state: 'clickable', x: tr.left + tr.width / 2, y: tr.top + tr.height / 2 };
        }
        // Measured delta between the item's centre and the band's centre.
        sc.scrollTop += (tr.top + tr.height / 2) - (sr.top + sr.height / 2);
        return { state: 'centring' };
      }, [colX, value]);

      if (res.state === 'clickable') {
        await page.mouse.click(res.x, res.y);
        await sleep(1500);
        return true;
      }
      if (res.state !== 'centring') return false;
      await sleep(700);
    }
    return false;
  };

  const pick = async (colX, midY, value, current) => {
    if (await pickExact(colX, value)) return true;
    const step = (Number(current) > Number(value)) ? -80 : 80;
    for (let i = 0; i < 40; i++) {
      // Abort if we are no longer on the form: a stray click can navigate into
      // TikTok's cover editor, and every later click then lands on that instead.
      const onForm = await page.evaluate(() =>
        !!Array.from(document.querySelectorAll('input[type="text"]'))
          .find(x => /^\d{1,2}:\d{2}$/.test(x.value || '') && x.getBoundingClientRect().width > 0));
      if (!onForm) return false;

      const hit = await page.evaluate(([cx, want, top]) => {
        let found = null;
        document.querySelectorAll('div,span,li').forEach(e => {
          if (found || e.children.length) return;
          if ((e.innerText || '').trim() !== want) return;
          const r = e.getBoundingClientRect();
          if (r.width <= 0 || r.width > 90 || r.height > 60) return;
          // Strictly inside this column, and strictly above the input: the popup
          // floats directly over the form and nothing else qualifies.
          if (Math.abs(r.left + r.width / 2 - cx) > 25) return;
          if (r.bottom > top + 5 || r.bottom < top - 340) return;
          found = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        });
        return found;
      }, [colX, value, geom.inputTop]);
      if (hit) { await page.mouse.click(hit.x, hit.y); await sleep(1200); return true; }
      const scrolled = await page.evaluate(([cx, my, delta]) => {
        let n = document.elementFromPoint(cx, my);
        for (let k = 0; n && k < 8; k++, n = n.parentElement) {
          if (n.scrollHeight > n.clientHeight + 5) {
            const before = n.scrollTop;
            n.scrollTop = before + delta;
            return n.scrollTop !== before;
          }
        }
        return false;
      }, [colX, midY, step]);
      if (!scrolled) return false;
      await sleep(350);
    }
    return false;
  };

  const cur = (f.time.value || '').split(':');
  await pick(geom.hourX, geom.hourMidY, hh, cur[0]);
  if (geom.minX !== null) await pick(geom.minX, geom.minMidY, mm, cur[1]);

  // The picker commits a moment after the click - poll rather than reading once.
  for (let i = 0; i < 12; i++) {
    f = await readFields(page);
    if (f.time && f.time.value === want) return;
    await sleep(1000);
  }
  await shot(page, 'FAIL_time_stuck');
  throw new Error(`Time did not stick: got ${f.time && f.time.value}, wanted ${want}`);
}

async function schedule(page, post, { dryRun, shot }) {
  const file = path.resolve(post.rootDir, post.files[0]);
  page.on('dialog', async d => { await d.accept().catch(() => {}); });

  console.log('Opening TikTok Studio...');
  await page.goto('https://www.tiktok.com/tiktokstudio/upload',
    { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await sleep(8000);
  if (/\/login/.test(page.url())) throw new Error('NOT_LOGGED_IN - TikTok session expired');
  await shot(page, 'studio');

  console.log('Uploading the video...');
  const input = await page.$('input[type="file"]');
  if (!input) { await shot(page, 'FAIL_no_input'); throw new Error('No file input on the upload page'); }
  await input.uploadFile(file);

  await page.waitForFunction(() =>
    /Description|Who can see this post|When to post/i.test(document.body.innerText || ''),
    { timeout: 300000, polling: 3000 })
    .catch(async () => { await shot(page, 'FAIL_upload'); throw new Error('Editor never appeared'); });
  console.log('   uploaded');
  await dismissOverlays(page);
  await shot(page, 'editor');

  // The box is pre-filled with the filename; clear it first.
  console.log('Writing the caption...');
  await page.evaluate(() => {
    const e = document.querySelector('[contenteditable="true"]');
    if (e) { e.focus(); e.click(); }
  });
  await sleep(1200);
  await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control');
  await sleep(300);
  await page.keyboard.press('Backspace');
  await sleep(800);
  const cdp = await page.createCDPSession();
  await cdp.send('Input.insertText', { text: post.caption });
  await sleep(2500);

  const chars = await page.evaluate(() => {
    const e = document.querySelector('[contenteditable="true"]');
    return e ? (e.innerText || '').trim().length : 0;
  });
  console.log(`   ${chars} chars in the box`);
  if (chars < 20) { await shot(page, 'FAIL_caption'); throw new Error('Caption did not land'); }
  await shot(page, 'caption');

  // Schedule radio -> required consent modal -> optional checks modal.
  console.log(`Setting ${post.whenLabel}...`);
  await dismissOverlays(page);
  const already = await page.evaluate(() =>
    !!Array.from(document.querySelectorAll('input[type="radio"]')).find(x => x.value === 'schedule' && x.checked));
  if (!already) {
    // "When to post" sits below the fold. Scroll it into view FIRST - a mouse
    // click at an off-screen y silently hits nothing, which looks identical to
    // the radio refusing to engage.
    await page.evaluate(() => {
      const r = Array.from(document.querySelectorAll('input[type="radio"]')).find(x => x.value === 'schedule');
      if (r) r.scrollIntoView({ block: 'center' });
    });
    await sleep(1800);

    const pos = await page.evaluate(() => {
      const r = Array.from(document.querySelectorAll('input[type="radio"]')).find(x => x.value === 'schedule');
      if (!r) return null;
      let n = r;
      for (let i = 0; i < 5 && n; i++, n = n.parentElement) {
        const b = n.getBoundingClientRect();
        if (/^schedule$/i.test((n.innerText || '').trim()) && b.width > 0) {
          return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
        }
      }
      const b2 = r.getBoundingClientRect();
      return b2.width > 0 ? { x: b2.left + b2.width / 2, y: b2.top + b2.height / 2 } : null;
    });
    if (!pos) { await shot(page, 'FAIL_no_schedule_radio'); throw new Error('Schedule option not found'); }
    await page.mouse.click(pos.x, pos.y);
    await sleep(4000);
    await clickText(page, /^allow$/).catch(() => {});      // required consent
    await sleep(4000);
    await clickText(page, /^cancel$/).catch(() => {});      // decline auto content checks
    await sleep(4000);
  }

  const on = await page.evaluate(() =>
    !!Array.from(document.querySelectorAll('input[type="radio"]')).find(x => x.value === 'schedule' && x.checked));
  if (!on) { await shot(page, 'FAIL_schedule_off'); throw new Error('Schedule option never engaged'); }

  await setDate(page, post, shot);
  await setTime(page, post, shot);

  const fields = await readFields(page);
  console.log(`   fields: ${fields.date.value} ${fields.time.value}`);
  await shot(page, 'ready');
  if (dryRun) return { dryRun: true };

  // Submit: relabelled "Schedule", in the footer row with "Save draft".
  const ok = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button,[role="button"]'))
      .map(e => ({ e, t: (e.innerText || '').trim(), r: e.getBoundingClientRect() }))
      .filter(x => x.r.width > 0);
    const draft = btns.find(x => /^save draft$/i.test(x.t));
    if (!draft) return false;
    const submit = btns.find(x => /^(schedule|post)$/i.test(x.t) && Math.abs(x.r.top - draft.r.top) < 25);
    if (!submit || submit.e.getAttribute('aria-disabled') === 'true' || submit.e.disabled) return false;
    submit.e.scrollIntoView({ block: 'center' });
    return true;
  });
  if (!ok) { await shot(page, 'FAIL_no_submit'); throw new Error('Submit button not available'); }
  await sleep(1500);

  const xy = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button,[role="button"]'))
      .map(e => ({ e, t: (e.innerText || '').trim(), r: e.getBoundingClientRect() }))
      .filter(x => x.r.width > 0);
    const draft = btns.find(x => /^save draft$/i.test(x.t));
    const submit = btns.find(x => /^(schedule|post)$/i.test(x.t) && Math.abs(x.r.top - draft.r.top) < 25);
    const r = submit.e.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await page.mouse.click(xy.x, xy.y);
  console.log('   clicked Schedule');

  const done = await page.waitForFunction(() =>
    !document.querySelector('[contenteditable="true"]')
    || /Posts \d+|Manage posts/i.test(document.body.innerText || ''),
    { timeout: 180000, polling: 3000 }).then(() => true).catch(() => false);
  await shot(page, 'confirmation');
  if (!done) throw new Error('Editor stayed open - NOT scheduled');
  console.log('   editor closed - scheduled');
  return { scheduled: true };
}

module.exports = {
  PORT,
  urlMatch: 'tiktok.com',
  homeUrl: 'https://www.tiktok.com/tiktokstudio/upload',
  loginRe: /\/login/,
  types: ['video'],
  captionLimit: 4000,
  schedule,
};
