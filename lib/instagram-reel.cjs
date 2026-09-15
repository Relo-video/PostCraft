/**
 * Instagram Reels composer (Business Suite).
 *
 * Why this exists: the "Create post" composer only accepts 4:5 to 16:9. A 9:16
 * clip is refused by leaving the Schedule button disabled, with the reason buried
 * in the DOM rather than surfaced as an error — so it looks exactly like media
 * still processing. Vertical video must go through "Create reel" instead, which
 * is a different three-step composer: Create -> Edit -> Share.
 *
 * Quirks learned driving it:
 *   - "Next" enabling is the only reliable signal the upload finished.
 *   - ElementHandle.click() stalls: it runs a scrollIntoView evaluate that can
 *     time out while the video preview renders. Focus through the DOM instead.
 *   - "Schedule" appears twice on the Share step: the radio option (first in DOM
 *     order) and the submit button (last).
 *   - The three time spinbuttons never populate `.value`. Read the rendered
 *     "06:30 PM" text to verify instead.
 */
const path = require('path');

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

/** Date is a calendar popup; time is three spinbuttons that ignore .value. */
async function setReelDateTime(page, post, shot) {
  const box = await page.evaluate(() => {
    const i = Array.from(document.querySelectorAll('input'))
      .find(x => /^[A-Z][a-z]{2} \d{1,2}, \d{4}$/.test(x.value || ''));
    if (!i) return null;
    i.scrollIntoView({ block: 'center' });
    const r = i.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  if (!box) { await shot(page, 'FAIL_reel_date'); throw new Error('Reel date field not found'); }
  await page.mouse.click(box.x, box.y);
  await sleep(2500);

  const want = `${MONTHS[post.dt.getMonth()]} ${post.dt.getFullYear()}`;
  for (let i = 0; i < 13; i++) {
    const shown = await page.evaluate(() => {
      const cell = document.querySelector('[role="gridcell"]');
      if (!cell) return null;
      const rx = /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/;
      for (let n = cell.parentElement, k = 0; n && k < 8; n = n.parentElement, k++) {
        const m = (n.innerText || '').match(rx);
        if (m) return m[0];
      }
      return null;
    });
    if (shown === want) break;
    if (i === 12) { await shot(page, 'FAIL_reel_month'); throw new Error(`Could not reach ${want}`); }
    await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('[role="button"],button'))
        .find(e => /next month/i.test((e.innerText || '') + (e.getAttribute('aria-label') || '')));
      if (el) el.click();
    });
    await sleep(1200);
  }

  const cell = await page.evaluate(d => {
    const c = Array.from(document.querySelectorAll('[role="gridcell"]'))
      .find(x => (x.innerText || '').trim() === d);
    if (!c) return null;
    c.scrollIntoView({ block: 'center' });
    const r = c.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, String(post.dt.getDate()));
  if (!cell) { await shot(page, 'FAIL_reel_day'); throw new Error('Day cell not found'); }
  await page.mouse.click(cell.x, cell.y);
  await sleep(2500);

  const h12 = post.dt.getHours() % 12 === 0 ? 12 : post.dt.getHours() % 12;
  const hh = String(h12).padStart(2, '0');
  const mm = String(post.dt.getMinutes()).padStart(2, '0');
  const ap = post.dt.getHours() < 12 ? 'AM' : 'PM';

  for (const [label, val] of [['hours', hh], ['minutes', mm], ['meridiem', ap]]) {
    const pos = await page.evaluate(l => {
      const i = Array.from(document.querySelectorAll('input')).find(x => x.getAttribute('aria-label') === l);
      if (!i) return null;
      i.scrollIntoView({ block: 'center' });
      const r = i.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, label);
    if (!pos) { await shot(page, 'FAIL_reel_time'); throw new Error(`Reel time field "${label}" not found`); }
    await page.mouse.click(pos.x, pos.y);
    await sleep(500);
    await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control');
    await sleep(200);
    await page.keyboard.type(val, { delay: 120 });
    await sleep(800);
  }

  const shown = await page.evaluate(() => {
    const m = (document.body.innerText || '').match(/(\d{2})\s*:\s*(\d{2})\s*(AM|PM)/);
    return m ? `${m[1]}:${m[2]} ${m[3]}` : null;
  });
  const wantTime = `${hh}:${mm} ${ap}`;
  console.log(`   time shows: ${shown} (want ${wantTime})`);
  if (shown !== wantTime) {
    await shot(page, 'FAIL_reel_time_mismatch');
    throw new Error(`Reel time did not stick: got ${shown}, wanted ${wantTime}`);
  }
}

async function scheduleReel(page, post, { dryRun, shot }) {
  const file = path.resolve(post.rootDir, post.files[0]);
  page.on('dialog', async d => { await d.accept().catch(() => {}); });

  // The content URL needs the account's asset/business ids; home redirects to a
  // URL carrying both, so read them rather than hardcoding.
  await page.goto('https://business.facebook.com/latest/home',
    { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await sleep(7000);
  const ids = (page.url().match(/asset_id=(\d+).*?business_id=(\d+)/) || []).slice(1);
  if (ids.length === 2) {
    await page.goto(`https://business.facebook.com/latest/posts/scheduled_posts?asset_id=${ids[0]}&business_id=${ids[1]}`,
      { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    await sleep(11000);
  }

  console.log('Opening the reel composer...');
  await clickByText(page, /^create reel$/, '"Create reel"');
  await sleep(9000);
  await shot(page, 'reel_composer');

  console.log('Uploading the video...');
  const [chooser] = await Promise.all([
    page.waitForFileChooser({ timeout: 30000 }),
    clickByText(page, /^add video$/, '"Add Video"'),
  ]);
  await chooser.accept([file]);

  await page.waitForFunction(() => {
    const n = Array.from(document.querySelectorAll('[role="button"],button'))
      .find(e => /^next$/i.test((e.innerText || '').trim()) && e.getBoundingClientRect().width > 0);
    return n && n.getAttribute('aria-disabled') !== 'true';
  }, { timeout: 300000, polling: 3000 })
    .catch(async () => { await shot(page, 'FAIL_reel_upload'); throw new Error('Reel upload never finished'); });
  console.log('   uploaded');

  console.log('Writing the caption...');
  await page.evaluate(() => {
    const e = document.querySelector('[contenteditable="true"]');
    if (e) { e.focus(); e.click(); }
  });
  await sleep(1500);
  const cdp = await page.createCDPSession();
  await cdp.send('Input.insertText', { text: post.caption });
  await sleep(2500);
  const chars = await page.evaluate(() => {
    const e = document.querySelector('[contenteditable="true"]');
    return e ? (e.innerText || '').trim().length : 0;
  });
  console.log(`   ${chars} chars in the box`);
  if (chars < 20) { await shot(page, 'FAIL_reel_caption'); throw new Error('Caption did not land'); }
  await shot(page, 'reel_caption');

  // Create -> Edit -> Share
  for (let i = 0; i < 2; i++) {
    await page.evaluate(() => {
      const n = Array.from(document.querySelectorAll('[role="button"],button'))
        .find(e => /^next$/i.test((e.innerText || '').trim()) && e.getBoundingClientRect().width > 0
                   && e.getAttribute('aria-disabled') !== 'true');
      if (n) n.click();
    });
    await sleep(11000);
  }

  // The radio option, not the submit button: it comes first in DOM order.
  await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('[role="radio"],[role="button"],label,div[tabindex],span'))
      .filter(e => e.getBoundingClientRect().width > 0 && /^schedule$/i.test((e.innerText || '').trim()));
    if (els.length) els[0].click();
  });
  await sleep(7000);

  console.log(`Setting ${post.whenLabel}...`);
  await setReelDateTime(page, post, shot);
  await shot(page, 'reel_ready');
  if (dryRun) return { dryRun: true };

  const clicked = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('[role="button"],button'))
      .filter(e => e.getBoundingClientRect().width > 0 && /^schedule$/i.test((e.innerText || '').trim()));
    if (!all.length) return 'none';
    const btn = all[all.length - 1];
    if (btn.getAttribute('aria-disabled') === 'true') return 'disabled';
    btn.click();
    return 'clicked';
  });
  if (clicked !== 'clicked') { await shot(page, 'FAIL_reel_submit'); throw new Error('Schedule button was ' + clicked); }

  // "Scheduling options" exists only inside the composer, so its disappearance
  // is the signal the dialog committed and closed.
  const closed = await page.waitForFunction(() =>
    !/Scheduling options/i.test(document.body.innerText || ''),
    { timeout: 120000, polling: 2500 }).then(() => true).catch(() => false);
  await shot(page, 'reel_confirmation');
  if (!closed) throw new Error('Reel composer stayed open - NOT scheduled');
  console.log('   composer closed - scheduled');
  return { scheduled: true };
}

module.exports = { scheduleReel };
