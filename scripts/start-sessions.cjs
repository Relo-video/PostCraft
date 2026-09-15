#!/usr/bin/env node
/**
 * Open one Chrome window per platform, each on its own debug port and its own
 * profile directory, so sessions never collide with your everyday browser.
 *
 *   node scripts/start-sessions.cjs              all four
 *   node scripts/start-sessions.cjs x tiktok     only those
 *
 * Already-running windows are left alone, so it is safe to run any time.
 */
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const PLATFORMS = {
  linkedin:  { port: 9222, dir: 'chrome-linkedin-profile', url: 'https://www.linkedin.com/feed/' },
  x:         { port: 9223, dir: 'chrome-x-profile',        url: 'https://x.com/home' },
  instagram: { port: 9224, dir: 'chrome-ig-profile',       url: 'https://business.facebook.com/latest/home' },
  tiktok:    { port: 9225, dir: 'chrome-tiktok-profile',   url: 'https://www.tiktok.com/tiktokstudio/upload' },
};

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const candidates = {
    win32: [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      (process.env.LOCALAPPDATA || '') + '\\Google\\Chrome\\Application\\chrome.exe',
    ],
    darwin: [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ],
    linux: [
      '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium',
    ],
  }[process.platform] || [];
  const hit = candidates.find(c => { try { return c && fs.existsSync(c); } catch { return false; } });
  if (!hit) throw new Error('Could not find Chrome. Install it, or set CHROME_PATH to its location.');
  return hit;
}

const isUp = port => new Promise(resolve => {
  const req = http.get({ host: '127.0.0.1', port, path: '/json/version', timeout: 2500 }, res => {
    res.resume();
    resolve(res.statusCode === 200);
  });
  req.on('error', () => resolve(false));
  req.on('timeout', () => { req.destroy(); resolve(false); });
});

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const asked = process.argv.slice(2).map(s => s.toLowerCase()).filter(s => PLATFORMS[s]);
  const wanted = asked.length ? asked : Object.keys(PLATFORMS);
  const chrome = findChrome();

  for (const name of wanted) {
    const { port, dir, url } = PLATFORMS[name];
    if (await isUp(port)) { console.log(`${name.padEnd(10)} already running on ${port}`); continue; }

    const profile = path.join(ROOT, dir);
    fs.mkdirSync(profile, { recursive: true });
    // A stale lock from a crashed Chrome blocks reuse of the profile.
    for (const lock of ['lockfile', 'SingletonLock']) {
      try { fs.unlinkSync(path.join(profile, lock)); } catch { /* absent or held */ }
    }

    spawn(chrome, [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      url,
    ], { detached: true, stdio: 'ignore' }).unref();

    console.log(`${name.padEnd(10)} starting on ${port} ...`);
  }

  // Report what actually came up, rather than assuming the spawn worked.
  await sleep(6000);
  console.log('');
  let ready = 0;
  for (const name of wanted) {
    const up = await isUp(PLATFORMS[name].port);
    if (up) ready++;
    console.log(`  ${up ? 'ready ' : 'DOWN  '} ${name} (port ${PLATFORMS[name].port})`);
  }

  console.log('');
  console.log(ready === wanted.length
    ? 'Log into each window by hand, then leave them open.'
    : 'Some windows did not start. Run this again, or launch that platform manually.');
})().catch(e => { console.error('ERROR: ' + e.message); process.exit(1); });
