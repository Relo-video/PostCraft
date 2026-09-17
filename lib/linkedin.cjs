/**
 * LinkedIn serves two different composers depending on the account. This driver
 * handles both; everything below is what differs (verified September 2026).
 *
 * CURRENT BUILD
 *   - Composer lives in the LIGHT DOM, not a shadow root. Every lookup here falls
 *     back to `document` when there is no shadow root.
 *   - Scheduling is behind a clock icon immediately LEFT of the Post button. It is
 *     an <a>, not a button, carries no aria-label, and its only text is the
 *     scheduled-post count. It is found by position and the <svg> it contains.
 *   - The date/time inputs lost their aria-labels. They are located by the shape of
 *     their value instead: M/D/YYYY and H:MM AM/PM.
 *   - The panel commits with "Confirm".
 *   - LinkedIn rewrites "4:00 PM" to "4:00PM" on blur, so the read-back comparison
 *     ignores spaces. Without that it fails on a correctly-set post.
 *
 * OLDER BUILD
 *   - Everything sits inside a shadow root, with aria-labelled Date and Time fields
 *     and a "Next" button. Still supported by the same code paths.
 *
 * SHARED
 *   - The date field wants m/d/yyyy, NOT the mm/dd/yyyy its placeholder shows.
 *   - Dismiss the calendar with Tab, never Escape: Escape propagates past it, tries
 *     to close the whole composer, and raises a "Save as draft?" modal that then
 *     covers the Time field.
 */
/**
 * LinkedIn driver.
 *
 * One flow for every post type. Only attachMedia() branches, because LinkedIn
 * really does use two different UIs: a PDF goes through More -> Add a document
 * -> title -> Next, while an image goes through Add media -> Next. Everything
 * else (composer, caption, schedule, verify, commit) is shared.
 *
 * The composer lives in a shadow root. Queries must skip the light DOM or they
 * match the feed's own "Show more" / "Post" / "Next" buttons.
 */
const path = require('path');

const PORT = 9222;
const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Element whose shadowRoot holds the composer. */
async function composerHost(page, timeout = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const h = await page.evaluateHandle(() => {
      const seen = new Set();
      const stack = [document.body];
      while (stack.length) {
        const node = stack.pop();
        if (!node || seen.has(node)) continue;
        seen.add(node);
        for (const el of (node.querySelectorAll ? node.querySelectorAll('*') : [])) {
          if (el.shadowRoot) {
            if (el.shadowRoot.querySelector('.ql-editor, [contenteditable="true"], button[aria-label="Add media"]')) return el;
            stack.push(el.shadowRoot);
          }
        }
      }
      // LinkedIn moved the composer OUT of the shadow root. Older builds still
      // use one, so try shadow first, then fall back to the light DOM and
      // return <body>, whose null shadowRoot makes every helper use `document`.
      if (document.querySelector('.ql-editor, [contenteditable="true"]')) return document.body;
      return null;
    });
    const el = h.asElement();
    if (el) return el;
    await sleep(500);
  }
  throw new Error('Composer not found (neither a shadow root nor the light DOM has an editor)');
}

/** The schedule panel can render in a different shadow root than the composer. */
async function scheduleHost(page, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const h = await page.evaluateHandle(() => {
      const stack = [document.body];
      while (stack.length) {
        const n = stack.pop();
        for (const el of n.querySelectorAll('*')) {
          if (el.shadowRoot) {
            if (el.shadowRoot.querySelector('input[aria-label="Date"]')
                || Array.from(el.shadowRoot.querySelectorAll('input'))
                     .some(i => /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(i.value || ''))) return el;
            stack.push(el.shadowRoot);
          }
        }
      }
      if (document.querySelector('input[aria-label="Date"]')
          || Array.from(document.querySelectorAll('input'))
               .some(i => /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(i.value || ''))) return document.body;
      return null;
    });
    const el = h.asElement();
    if (el) return el;
    await sleep(500);
  }
  throw new Error('Schedule panel not found');
}

async function clickIn(page, host, fn, timeout = 12000, label = 'element') {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const ok = await page.evaluate((h, src) => {
      const f = new Function('return ' + src)();
      const el = f(h.shadowRoot || document);
      if (!el) return false;
      el.scrollIntoView({ block: 'center' });
      el.click();
      return true;
    }, host, fn.toString());
    if (ok) return true;
    await sleep(700);
  }
  throw new Error(`Could not click ${label}`);
}

async function typeInto(page, host, selector, value, { clear = true } = {}) {
  const focused = await page.evaluate((h, sel) => {
    const el = (h.shadowRoot || document).querySelector(sel);
    if (!el) return false;
    el.scrollIntoView({ block: 'center' });
    el.focus();
    el.select && el.select();
    return true;
  }, host, selector);
  if (!focused) throw new Error(`Field not found: ${selector}`);
  await sleep(400);
  if (clear) {
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await sleep(250);
  }
  await page.keyboard.type(value, { delay: 25 });
  await sleep(600);
}

async function uploadTo(page, host, files) {
  const h = await page.evaluateHandle(
    hh => (hh.shadowRoot || document).querySelector('input[type=file]')
           || document.querySelector('input[type=file]'), host);
  const input = h.asElement();
  if (!input) throw new Error('No file input found');
  await input.uploadFile(...files);
}

// --------------------------------------------------------------------------
// The ONE part that differs per post type.
// --------------------------------------------------------------------------
async function attachMedia(page, host, post, shot) {
  const files = post.files.map(f => path.resolve(post.rootDir, f));

  if (post.type === 'document') {
    // LinkedIn relabelled "More" to "Expand content types" (Sep 2026) and made
    // "Document" an <a>, not a button. Accept both generations.
    console.log('   More -> Add a document');
    await clickIn(page, host,
      root => Array.from(root.querySelectorAll('button,[role="button"]'))
        .find(b => ['More', 'Expand content types']
          .includes((b.getAttribute('aria-label') || '').trim())),
      12000, 'the More button');
    await sleep(1800);
    await clickIn(page, host,
      root => Array.from(root.querySelectorAll('button,[role="button"],a[aria-label]'))
        .find(b => {
          const s = ((b.getAttribute('aria-label') || '') + ' ' + (b.innerText || '')).trim().toLowerCase();
          return s === 'document' || s.includes('add a document');
        }),
      12000, '"Add a document"');
    await sleep(2500);
    await shot(page, 'document_modal');

    console.log('   uploading', path.basename(files[0]));
    // The new "Share a document" modal has no file input until "Choose file" is
    // clicked, so fall back to the native file chooser.
    const hasInput = await page.evaluate(h =>
      !!((h.shadowRoot || document).querySelector('input[type=file]')
         || document.querySelector('input[type=file]')), host);
    if (hasInput) {
      await uploadTo(page, host, files);
    } else {
      const [chooser] = await Promise.all([
        page.waitForFileChooser({ timeout: 15000 }),
        clickIn(page, host,
          root => Array.from(root.querySelectorAll('button'))
            .find(b => (b.innerText || '').trim() === 'Choose file'),
          12000, '"Choose file"'),
      ]);
      await chooser.accept(files);
    }
    await sleep(8000);
    await shot(page, 'uploaded');

    // LinkedIn requires a title; Next stays disabled without one.
    if (post.documentTitle) {
      console.log('   setting document title');
      await typeInto(page, host,
        'input[id*="title"], input[aria-label*="itle"], input[placeholder*="itle"], input[name*="title"]',
        post.documentTitle).catch(e => console.log('   WARNING:', e.message));
    }

    // Done stays inert until LinkedIn has rendered the PDF ("7 pages"), which can
    // take well over the 20s the generic wait allows.
    console.log('   waiting for the document to finish processing');
    const t0 = Date.now();
    while (Date.now() - t0 < 120000) {
      const ready = await page.evaluate(() => /\b\d+\s+pages?\b/.test(document.body.innerText));
      if (ready) break;
      await sleep(1500);
    }
    await shot(page, 'document_processed');
  } else {
    console.log('   Add media');
    await clickIn(page, host,
      root => Array.from(root.querySelectorAll('button,[role="button"]'))
        .find(b => ['Add media', 'Media'].includes((b.getAttribute('aria-label') || '').trim())),
      12000, 'the Add media button');
    await sleep(2000);
    await shot(page, 'media_modal');

    console.log(`   uploading ${files.length} file(s)`);
    await uploadTo(page, host, files);
    await sleep(8000);
    await shot(page, 'uploaded');
  }

  // Both paths exit through the same Next/Done button.
  console.log('   leaving the media modal');
  await clickIn(page, host,
    // The Sep 2026 document modal renders Done as an <a>, not a <button>.
    root => Array.from(root.querySelectorAll('button, a')).find(b => {
      const t = (b.innerText || '').trim();
      return (t === 'Next' || t === 'Done') && !b.disabled
        && b.getAttribute('aria-disabled') !== 'true'
        && (b.offsetWidth > 0 || b.offsetHeight > 0);
    }),
    20000, 'Next/Done on the media modal');
  await sleep(3000);
}

// --------------------------------------------------------------------------
/**
 * Close an open composer through the UI first. Navigating away with a draft
 * open raises a native beforeunload dialog that freezes CDP completely - no
 * screenshots, no evaluate, and Page.handleJavaScriptDialog cannot clear it
 * either. Only a human clicking the button gets you out, so never get there.
 */
async function closeComposerIfOpen(page) {
  for (let i = 0; i < 3; i++) {
    const open = await page.evaluate(() => {
      const stack = [document.body];
      while (stack.length) {
        const n = stack.pop();
        for (const el of n.querySelectorAll('*')) {
          if (el.shadowRoot) {
            if (el.shadowRoot.querySelector('.ql-editor, [contenteditable="true"]')) return true;
            stack.push(el.shadowRoot);
          }
        }
      }
      return false;
    });
    if (!open) return;

    // Dismiss (X), then answer the "Save this post as a draft?" prompt.
    await page.evaluate(() => {
      const stack = [document.body];
      while (stack.length) {
        const n = stack.pop();
        for (const el of n.querySelectorAll('*')) {
          if (el.shadowRoot) {
            const x = el.shadowRoot.querySelector('button[aria-label="Dismiss"]');
            if (x) { x.click(); return; }
            stack.push(el.shadowRoot);
          }
        }
      }
    });
    await sleep(1800);
    await page.evaluate(() => {
      const stack = [document.body];
      while (stack.length) {
        const n = stack.pop();
        for (const el of n.querySelectorAll('*')) {
          if (el.shadowRoot) {
            const d = Array.from(el.shadowRoot.querySelectorAll('button'))
              .find(b => /^discard$/i.test((b.innerText || '').trim()));
            if (d) { d.click(); return; }
            stack.push(el.shadowRoot);
          }
        }
      }
    });
    await sleep(2000);
  }
}

async function schedule(page, post, { dryRun, shot }) {
  page.on('dialog', async d => { await d.accept().catch(() => {}); });

  console.log('Opening a fresh composer...');
  await closeComposerIfOpen(page);
  await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
  await sleep(3500);
  await page.evaluate(() => {
    const s = document.createElement('style');
    s.innerHTML = '.msg-overlay-container,[class*="msg-overlay"],#msg-overlay{display:none!important}';
    document.head.appendChild(s);
  });

  const started = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button,[role="button"]'))
      .find(el => (el.innerText || '').trim().includes('Start a post'));
    if (!b) return false;
    b.click();
    return true;
  });
  if (!started) throw new Error('Could not find "Start a post"');
  await sleep(2500);

  const host = await composerHost(page);
  await shot(page, 'editor_open');

  if (post.type === 'text' || !post.files.length) {
    console.log('Text-only post, skipping media.');
  } else {
    console.log(`Attaching media (${post.type})...`);
    await attachMedia(page, host, post, shot);
  }

  console.log('Typing the caption...');
  const ok = await page.evaluate(h => {
    const ed = (h.shadowRoot || document).querySelector('.ql-editor, [contenteditable="true"]');
    if (!ed) return false;
    ed.focus();
    return true;
  }, host);
  if (!ok) { await shot(page, 'FAIL_no_editor'); throw new Error('Caption editor not found'); }
  const lines = post.caption.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) { await page.keyboard.press('Enter'); await sleep(80); }
    if (lines[i]) { await page.keyboard.type(lines[i], { delay: 4 }); await sleep(80); }
  }
  await sleep(1500);

  // Verify. Focus can drop after the first keystroke, leaving e.g. just "M" -
  // which would otherwise be scheduled as the whole post.
  const norm = s => (s || '').replace(/\s+/g, ' ').trim();
  const readCaption = () => page.evaluate(h => {
    const ed = (h.shadowRoot || document).querySelector('.ql-editor, [contenteditable="true"]');
    return ed ? ed.innerText : '';
  }, host);
  if (norm(await readCaption()) !== norm(post.caption)) {
    console.log('   caption did not land intact, re-inserting');
    await page.evaluate(h => {
      const ed = (h.shadowRoot || document).querySelector('.ql-editor, [contenteditable="true"]');
      ed.focus();
    }, host);
    await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await sleep(400);
    const cdp = await page.createCDPSession();
    const parts = post.caption.split('\n');
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) { await page.keyboard.press('Enter'); await sleep(60); }
      if (parts[i]) await cdp.send('Input.insertText', { text: parts[i] });
    }
    await sleep(1500);
  }
  if (norm(await readCaption()) !== norm(post.caption)) {
    await shot(page, 'FAIL_caption');
    throw new Error(`Caption did not land intact (box has ${norm(await readCaption()).length} of ${norm(post.caption).length} chars)`);
  }
  console.log(`   caption verified (${norm(post.caption).length} chars)`);
  await shot(page, 'caption_filled');

  // ---- open the schedule panel -------------------------------------------
  // Current LinkedIn: an <a> carrying an <svg> clock, immediately LEFT of the Post
  // button, whose only text is the scheduled-post count ("1"). No aria-label, not a
  // <button> - it matches nothing you would search for by name. Older builds used a
  // button labelled "Schedule post". Both handled.
  console.log('Opening schedule settings...');
  const opened = await page.evaluate(() => {
    const vis = e => e.getBoundingClientRect().width > 0;
    const labelled = Array.from(document.querySelectorAll('button,[role="button"],a'))
      .filter(vis)
      .find(e => /schedule post/i.test((e.getAttribute('aria-label') || '') + (e.innerText || '')));
    if (labelled) { labelled.click(); return 'label'; }

    const post = Array.from(document.querySelectorAll('button,[role="button"]'))
      .filter(vis).find(e => /^post$/i.test((e.innerText || '').trim()));
    if (!post) return null;
    const pr = post.getBoundingClientRect();
    const clock = Array.from(document.querySelectorAll('a,button,[role="button"]'))
      .filter(e => {
        if (!vis(e)) return false;
        const r = e.getBoundingClientRect();
        return Math.abs(r.top - pr.top) < 40 && r.right <= pr.left + 5
               && !!e.querySelector('svg') && /^\d*$/.test((e.innerText || '').trim());
      }).pop();
    if (!clock) return null;
    clock.click();
    return 'clock';
  });
  if (!opened) { await shot(page, 'FAIL_no_clock'); throw new Error('Schedule control not found next to Post'); }
  console.log('   opened via ' + opened);
  await sleep(3500);

  // ---- fill date and time -------------------------------------------------
  console.log(`Setting ${post.liDate} at ${post.liTime}...`);
  const sh = await scheduleHost(page);

  // New LinkedIn dropped the aria-labels, so find the fields by the shape of their
  // value. The aria path is kept for older builds.
  const locate = () => page.evaluate(h => {
    const root = h.shadowRoot || document;
    const vis = e => e.getBoundingClientRect().width > 0;
    const all = Array.from(root.querySelectorAll('input')).filter(vis);
    const aria = l => all.find(i => (i.getAttribute('aria-label') || '') === l);
    const pick = el => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, value: el.value };
    };
    return {
      date: pick(aria('Date') || all.find(i => /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(i.value || ''))),
      time: pick(aria('Time') || all.find(i => /^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(i.value || ''))),
    };
  }, sh);

  let f = await locate();
  if (!f.date || !f.time) { await shot(page, 'FAIL_no_fields'); throw new Error('Date/Time fields not found in the schedule panel'); }

  const retype = async (box, value) => {
    await page.mouse.click(box.x, box.y);
    await sleep(500);
    await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await sleep(300);
    await page.keyboard.type(value, { delay: 50 });
    await sleep(900);
  };

  // Date wants m/d/yyyy, NOT the mm/dd/yyyy its placeholder shows.
  await retype(f.date, post.liDate);
  // Tab, NOT Escape. Escape propagates past the calendar, tries to close the whole
  // composer, and raises a "Save this post as a draft?" modal over the Time field.
  await page.keyboard.press('Tab');
  await sleep(1200);

  // Time: the current build is a plain text field. Older builds used an artdeco
  // typeahead that ignores typing and commits only on a real mouse press on the
  // li[role="option"]. Type first, fall back to the option list.
  const want = post.liTime.toUpperCase().replace(/\s+/g, '');
  f = await locate();
  await retype(f.time, post.liTime);

  f = await locate();
  if ((f.time.value || '').toUpperCase().replace(/\s+/g, '') !== want) {
    const c = await page.evaluate((h, w) => {
      const root = h.shadowRoot || document;
      const o = Array.from(root.querySelectorAll('li[role="option"]'))
        .find(x => (x.innerText || '').trim().toUpperCase() === w);
      if (!o) return null;
      o.scrollIntoView({ block: 'center' });
      const r = o.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, sh, want);
    if (c && c.y > 0) {
      await page.mouse.move(c.x, c.y); await sleep(250);
      await page.mouse.down(); await sleep(120); await page.mouse.up();
      await sleep(1400);
    }
  }

  // Read back. A silent revert here posts at the wrong time and looks like success.
  f = await locate();
  console.log(`   field values: ${f.date.value} / ${f.time.value}`);
  if (f.date.value !== post.liDate
      || (f.time.value || '').toUpperCase().replace(/\s+/g, '') !== want) {
    await shot(page, 'FAIL_datetime');
    throw new Error(`Date/time did not stick: got ${f.date.value} ${f.time.value}, wanted ${post.liDate} ${post.liTime}`);
  }
  await shot(page, 'datetime_set');

  // Panel confirm: "Confirm" on the current build, "Next" on older ones.
  const confirmed = await page.evaluate(h => {
    const root = h.shadowRoot || document;
    const b = Array.from(root.querySelectorAll('button,[role="button"]'))
      .filter(e => e.getBoundingClientRect().width > 0)
      .find(e => /^(confirm|next|done)$/i.test((e.innerText || '').trim()) && !e.disabled);
    if (!b) return null;
    const t = (b.innerText || '').trim();
    b.click();
    return t;
  }, sh);
  if (!confirmed) { await shot(page, 'FAIL_confirm'); throw new Error('No Confirm/Next button in the schedule panel'); }
  console.log('   confirmed via "' + confirmed + '"');
  await sleep(3000);

  // Re-check the caption after the schedule panel, just before any commit.
  if (norm(await readCaption()) !== norm(post.caption)) {
    await shot(page, 'FAIL_caption_changed');
    throw new Error('Caption changed after setting the schedule - not committing');
  }
  await shot(page, 'ready');

  if (dryRun) return { dryRun: true };

  console.log('Clicking Schedule...');
  await clickIn(page, host,
    root => Array.from(root.querySelectorAll('button,[role="button"]'))
      .find(b => /^(schedule|post)$/i.test((b.innerText || '').trim()) && !b.disabled
                 && b.getBoundingClientRect().width > 0),
    12000, 'the final Schedule button');
  await sleep(7000);
  await shot(page, 'confirmation');
  return { scheduled: true };
}

module.exports = {
  PORT,
  urlMatch: 'linkedin.com',
  homeUrl: 'https://www.linkedin.com/feed/',
  loginRe: /\/login|\/signup|\/checkpoint/,
  types: ['document', 'image', 'images', 'text'],
  captionLimit: 3000,
  schedule,
};
