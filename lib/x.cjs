/**
 * X (Twitter) driver.
 *
 * Images and text-only share one flow; the upload step is simply skipped when
 * there are no files. Quirks worth remembering:
 *   - Two composers exist at once (modal + inline). The modal is NOT always
 *     inside [role="dialog"], so resolve it structurally and fresh every time:
 *     React replaces the nodes on re-render.
 *   - tweetButtonInline is the INLINE composer's button and is disabled.
 *     The modal's is tweetButton, labelled "Schedule".
 *   - The schedule <select>s are React-controlled: native setter + input/change.
 */
const path = require('path');

const PORT = 9223;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const PICK_LARGEST = `
  const b = Array.from(document.querySelectorAll('[data-testid="tweetTextarea_0"]'))
    .map(el => ({ el, r: el.getBoundingClientRect() }))
    .filter(o => o.r.width > 0 && o.r.height > 0)
    .sort((x, y) => (y.r.width * y.r.height) - (x.r.width * x.r.height));
`;

async function textarea(page) {
  const h = await page.evaluateHandle(new Function(`${PICK_LARGEST} return b.length ? b[0].el : null;`));
  const el = h.asElement();
  if (!el) throw new Error('composer textarea not found');
  return el;
}

async function fileInput(page) {
  const h = await page.evaluateHandle(new Function(`
    ${PICK_LARGEST}
    if (!b.length) return null;
    let n = b[0].el;
    for (let i = 0; i < 25 && n; i++, n = n.parentElement) {
      const fi = n.querySelector && n.querySelector('[data-testid="fileInput"]');
      if (fi) return fi;
    }
    return null;
  `));
  const el = h.asElement();
  if (!el) throw new Error('composer fileInput not found');
  return el;
}

/** Close through the UI. Navigating with a draft open freezes CDP on a native dialog. */
async function closeComposer(page) {
  for (let i = 0; i < 3; i++) {
    const open = await page.evaluate(() =>
      !!Array.from(document.querySelectorAll('[data-testid="tweetTextarea_0"]'))
        .find(e => e.getBoundingClientRect().height > 40));
    if (!open) return;
    await page.evaluate(() => {
      const x = document.querySelector('[data-testid="app-bar-close"]');
      if (x) x.click();
    });
    await sleep(1500);
    await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll('[role="button"],button'))
        .find(e => /^discard$/i.test((e.innerText || '').trim()));
      if (b) b.click();
    });
    await sleep(2000);
  }
}

async function setSelect(page, index, wanted) {
  return page.evaluate((i, want) => {
    const sel = document.querySelectorAll('select')[i];
    if (!sel) return 'no select';
    const opt = Array.from(sel.options).find(o =>
      o.value === want || o.text.trim() === want || o.text.trim() === String(Number(want)));
    if (!opt) return 'no option ' + want;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
    setter.call(sel, opt.value);
    sel.dispatchEvent(new Event('input', { bubbles: true }));
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return 'ok:' + opt.value;
  }, index, wanted);
}

async function schedule(page, post, { dryRun, shot }) {
  page.on('dialog', async d => { await d.accept().catch(() => {}); });

  console.log('Opening a clean composer...');
  await closeComposer(page);
  await page.goto('https://x.com/compose/post', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await page.waitForSelector('[data-testid="tweetTextarea_0"]', { timeout: 30000 });
  await sleep(1500);

  const existing = await page.evaluate(el => (el.innerText || '').trim().length, await textarea(page));
  if (existing > 0) {
    console.log('   discarding an existing draft...');
    await closeComposer(page);
    await page.goto('https://x.com/compose/post', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    await page.waitForSelector('[data-testid="tweetTextarea_0"]', { timeout: 30000 });
    await sleep(1500);
  }

  // A bare .focus() does not arm the editor; click it, then confirm.
  console.log('Typing the caption...');
  let ta = await textarea(page);
  await ta.click().catch(() => {});
  await sleep(900);
  ta = await textarea(page);
  let armed = await page.evaluate(el => document.activeElement === el || el.contains(document.activeElement), ta);
  if (!armed) {
    await page.evaluate(el => el.focus(), ta);
    await sleep(700);
    ta = await textarea(page);
    armed = await page.evaluate(el => document.activeElement === el || el.contains(document.activeElement), ta);
  }
  if (armed) {
    const lines = post.caption.split('\n');
    for (let i = 0; i < lines.length; i++) {
      // Shift+Enter: a plain Enter can submit.
      if (i > 0) {
        await page.keyboard.down('Shift'); await page.keyboard.press('Enter'); await page.keyboard.up('Shift');
        await sleep(60);
      }
      if (lines[i]) { await page.keyboard.type(lines[i], { delay: 5 }); await sleep(60); }
    }
  } else {
    // Keyboard focus does not always take on the modal composer. CDP insertText
    // writes straight into the focused editor and handles newlines - the same
    // fallback the Instagram driver relies on.
    console.log('   keyboard focus failed, using CDP insertText');
    ta = await textarea(page);
    await page.evaluate(el => el.focus(), ta);
    await sleep(400);
    const cdp = await page.createCDPSession();
    await cdp.send('Input.insertText', { text: post.caption });
  }
  await sleep(1500);
  ta = await textarea(page);
  const typed = await page.evaluate(el => (el.innerText || '').trim(), ta);
  console.log(`   ${typed.length} chars in the box`);
  if (typed.length > 280) throw new Error(`Caption is ${typed.length} chars, over the 280 limit`);
  if (typed.length < 20) throw new Error('Caption did not land in the box');

  const files = post.files.map(f => path.resolve(post.rootDir, f));
  if (files.length) {
    const isVideo = files.some(f => /\.(mp4|mov|webm|m4v)$/i.test(f));
    console.log(`Uploading ${files.length} ${isVideo ? 'video' : 'image(s)'}...`);
    const input = await fileInput(page);
    await input.uploadFile(...files);

    if (isVideo) {
      // A video attaches as <video>, never <img>, so the image count check below
      // would always see zero. X also transcodes after the upload finishes and
      // keeps the Post button disabled until it is done - far longer than the
      // fixed 10s an image needs. Poll for both conditions instead of sleeping.
      console.log('   waiting for upload and transcode...');
      await page.waitForFunction(() => {
        const v = document.querySelector('[data-testid="attachments"] video');
        if (!v) return false;
        const btn = document.querySelector('[data-testid="tweetButton"]');
        return !btn || btn.getAttribute('aria-disabled') !== 'true';
      }, { timeout: 300000, polling: 2000 });
      console.log('   video attached and processed');
    } else {
      await sleep(10000);
      const media = await page.evaluate(() => document.querySelectorAll('[data-testid="attachments"] img').length);
      console.log(`   ${media} attached`);
      if (media !== files.length) throw new Error(`Only ${media}/${files.length} images attached`);
    }
  }
  await shot(page, 'composed');

  console.log(`Setting ${post.whenLabel}...`);
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('[data-testid="scheduleOption"]'))
      .find(e => e.getBoundingClientRect().width > 0);
    if (!b) throw new Error('no scheduleOption');
    b.click();
  });
  await page.waitForSelector('select', { timeout: 20000 });
  await sleep(2000);

  const order = ['month', 'day', 'year', 'hour', 'minute', 'ampm'];
  for (let i = 0; i < order.length; i++) {
    await setSelect(page, i, post.xWhen[order[i]]);
    await sleep(500);
  }
  await sleep(1000);

  const got = await page.evaluate(() => Array.from(document.querySelectorAll('select')).map(s => s.value));
  const want = order.map(k => post.xWhen[k]);
  console.log('   selects now:', JSON.stringify(got));
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    await shot(page, 'FAIL_datetime');
    throw new Error(`Date/time did not stick. got ${JSON.stringify(got)} wanted ${JSON.stringify(want)}`);
  }
  await shot(page, 'datetime_set');

  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('[role="button"],button'))
      .find(x => /^confirm$/i.test((x.innerText || '').trim()));
    if (!b) throw new Error('no Confirm button');
    b.click();
  });
  await sleep(3500);

  const banner = await page.evaluate(() =>
    (document.body.innerText || '').split('\n').find(l => /will send on/i.test(l)) || null);
  console.log('   composer says:', banner);
  if (!banner) { await shot(page, 'FAIL_no_banner'); throw new Error('No "Will send on" confirmation appeared'); }
  await shot(page, 'ready');

  if (dryRun) return { dryRun: true };

  console.log('Clicking Schedule...');
  const res = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('[data-testid="tweetButton"]'))
      .find(e => e.getBoundingClientRect().width > 0);
    if (!el) return 'missing';
    if (el.getAttribute('aria-disabled') === 'true') return 'disabled';
    if (!/schedule/i.test((el.innerText || '').trim())) return 'wrong label: ' + el.innerText.trim();
    el.click();
    return 'clicked';
  });
  if (res !== 'clicked') throw new Error('Could not click Schedule: ' + res);
  await sleep(7000);
  await shot(page, 'confirmation');
  return { scheduled: true };
}

module.exports = {
  PORT,
  urlMatch: 'x.com',
  homeUrl: 'https://x.com/home',
  loginRe: /\/login|\/i\/flow/,
  types: ['images', 'image', 'text', 'video'],
  captionLimit: 280,
  schedule,
};
