#!/usr/bin/env node
/**
 * One entry point for scheduling any post on any platform.
 *
 *   node schedule.cjs --list                   show the queue
 *   node schedule.cjs --id <id> --dry-run      rehearse (stops before commit)
 *   node schedule.cjs --id <id>                schedule it
 *   node schedule.cjs --all --dry-run          every pending post, in order
 *
 * Post definitions live in posts.json. The platform driver is chosen from the
 * entry's "platform" field, so adding a platform means adding lib/<name>.cjs -
 * nothing here changes.
 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const { loadPost, markScheduled } = require('./lib/manifest.cjs');
const { recordScheduled } = require('./lib/calendar.cjs');

const DRIVERS = {
  linkedin: require('./lib/linkedin.cjs'),
  x: require('./lib/x.cjs'),
  instagram: require('./lib/instagram.cjs'),
  tiktok: require('./lib/tiktok.cjs'),
};

const DRY_RUN = process.argv.includes('--dry-run');
const ALL = process.argv.includes('--all');
const LIST = process.argv.includes('--list');

function arg(name) {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : null;
}

const manifestPath = path.resolve(__dirname, arg('--manifest') || 'posts.json');

function readManifest() {
  if (!fs.existsSync(manifestPath)) {
    // First run. Say what to do rather than throwing a raw ENOENT at someone who
    // has just cloned the repo.
    throw new Error(
      'No posts.json yet.\n\n' +
      '  Run /setup-social in Claude Code to create it along with your profile,\n' +
      '  or start from the example:  cp posts.example.json posts.json');
  }
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (e) {
    throw new Error('posts.json is not valid JSON: ' + e.message);
  }
}

function list() {
  const m = readManifest();
  console.log(`\n${m.posts.length} post(s) in ${path.basename(manifestPath)}:\n`);
  for (const p of m.posts) {
    const mark = p.status === 'scheduled' ? '✓' : p.status === 'posted' ? '·' : ' ';
    console.log(`  ${mark} ${(p.status || 'pending').padEnd(10)} ${p.platform.padEnd(9)} ${(p.type || '').padEnd(9)} ${p.when}  ${p.id}`);
  }
  console.log('');
}

function makeShot(id) {
  const dir = path.resolve(__dirname, 'output/schedule_verification', id);
  fs.mkdirSync(dir, { recursive: true });
  let n = 0;
  return async (page, label) => {
    const p = path.join(dir, `${String(++n).padStart(2, '0')}_${label}.png`);
    await page.screenshot({ path: p });
    console.log('   shot →', path.basename(p));
  };
}

async function runOne(id) {
  const first = readManifest().posts.find(p => p.id === id);
  if (!first) throw new Error(`No post with id "${id}"`);
  const driver = DRIVERS[first.platform];
  if (!driver) throw new Error(`No driver for platform "${first.platform}"`);

  // Validate before opening anything.
  const post = loadPost(__dirname, first.platform, { types: driver.types, id });
  post.rootDir = __dirname;

  console.log(`\n=== ${post.id} → ${post.platform} (${post.type}) → ${post.whenLabel} ===`);
  if (DRY_RUN) console.log('*** DRY RUN - stops before the final click ***');

  const browser = await puppeteer.connect({
    browserURL: `http://127.0.0.1:${driver.PORT}`,
    defaultViewport: null,
  }).catch(() => {
    throw new Error(`No Chrome on port ${driver.PORT}. Start the ${post.platform} profile first (see SCHEDULING.md).`);
  });

  let page = (await browser.pages()).find(p => p.url().includes(driver.urlMatch));
  if (!page) { page = await browser.newPage(); await page.goto(driver.homeUrl); }
  await page.bringToFront();

  // Without this, a Chrome window that is minimised or simply not the OS-foreground
  // window never updates document.activeElement, so focus() and type() silently do
  // nothing and captions land empty. Focus emulation makes the page behave as if it
  // were frontmost, which is what lets these runs work while you use the machine.
  try {
    const cdp = await page.createCDPSession();
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  } catch (e) {
    console.log('   note: focus emulation unavailable:', e.message);
  }
  if (driver.loginRe.test(page.url())) {
    throw new Error(`Not logged in to ${post.platform}. Log in in the open window, then rerun.`);
  }

  const result = await driver.schedule(page, post, { dryRun: DRY_RUN, shot: makeShot(post.id) });
  browser.disconnect();

  if (result.dryRun) {
    console.log('\nDRY RUN complete - composer is filled in and waiting. Review it, then rerun without --dry-run.');
    return 'dry-run';
  }
  markScheduled(manifestPath, post.id);
  try {
    recordScheduled(__dirname, post);
  } catch (e) {
    // The post is on the platform; a calendar hiccup must not report it as failed.
    console.log('   note: calendar not updated:', e.message);
  }
  console.log(`\nSUCCESS: "${post.id}" scheduled for ${post.whenLabel}. Manifest and calendar updated.`);
  return 'scheduled';
}

(async () => {
  if (LIST) { list(); return; }

  const id = arg('--id');
  if (!id && !ALL) {
    console.log('\nUsage:');
    console.log('  node schedule.cjs --list');
    console.log('  node schedule.cjs --id <post-id> [--dry-run]');
    console.log('  node schedule.cjs --all [--dry-run]');
    list();
    return;
  }

  const ids = id
    ? [id]
    : readManifest().posts.filter(p => p.status !== 'scheduled' && p.status !== 'posted').map(p => p.id);

  if (!ids.length) { console.log('Nothing pending.'); return; }

  const results = [];
  for (const one of ids) {
    try {
      results.push([one, await runOne(one)]);
    } catch (e) {
      // A browser sitting on a stale page - a leftover tab, an open composer - can
      // kill the execution context the moment the driver navigates. It is transient:
      // the retry lands on a clean page. Retry once before reporting a failure.
      if (/Execution context was destroyed|Target closed|detached Frame/i.test(e.message)) {
        console.error(`\n  ${one}: browser was on a stale page, retrying once...`);
        try {
          results.push([one, await runOne(one)]);
          continue;
        } catch (again) {
          e = again;
        }
      }
      console.error(`\nFAILED (${one}): ${e.message}`);
      results.push([one, 'failed: ' + e.message]);
      // keep going: one bad post should not block the rest of the batch
    }
  }

  if (results.length > 1) {
    console.log('\n=== summary ===');
    for (const [i, r] of results) console.log(`  ${r.startsWith('failed') ? '✗' : '✓'} ${i}: ${r}`);
  }
  process.exit(results.some(([, r]) => r.startsWith('failed')) ? 1 : 0);
})().catch(e => { console.error('\nERROR: ' + e.message); process.exit(1); });
