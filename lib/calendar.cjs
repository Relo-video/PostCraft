/**
 * calendar.json: a local record of every post that was actually scheduled, read by
 * calendar.html. Only a successful, non-dry-run schedule writes here, so the
 * calendar never shows something the platform does not have. Gitignored.
 *
 * `when` in posts.json is local wall-clock time on the machine that scheduled it,
 * so it is converted to a real instant (`at`) at record time, using this machine's
 * timezone. The page then renders that instant in ET and in the viewer's own zone.
 */
const fs = require('fs');
const path = require('path');

const FILE = 'calendar.json';

function calendarPath(rootDir) {
  return path.resolve(rootDir, FILE);
}

function readCalendar(rootDir) {
  const p = calendarPath(rootDir);
  if (!fs.existsSync(p)) return { posts: [] };
  try {
    const c = JSON.parse(fs.readFileSync(p, 'utf8'));
    return { posts: Array.isArray(c.posts) ? c.posts : [] };
  } catch (e) {
    throw new Error('calendar.json is not valid JSON: ' + e.message);
  }
}

function toEntry(post) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(post.when || '');
  if (!m) return null;
  const at = new Date(m[1], m[2] - 1, m[3], m[4], m[5]);
  const files = post.files || (post.file ? [post.file] : []);
  return {
    id: post.id,
    platform: post.platform,
    type: post.type || '',
    when: post.when,
    at: at.toISOString(),
    scheduledFrom: Intl.DateTimeFormat().resolvedOptions().timeZone,
    caption: (post.caption || '').trim(),
    files,
    recordedAt: new Date().toISOString(),
  };
}

/** Add or replace (a --force re-run) one post. */
function recordScheduled(rootDir, post) {
  const entry = toEntry(post);
  if (!entry) return;
  const cal = readCalendar(rootDir);
  cal.posts = cal.posts.filter(p => p.id !== entry.id);
  cal.posts.push(entry);
  cal.posts.sort((a, b) => a.at.localeCompare(b.at));
  fs.writeFileSync(calendarPath(rootDir), JSON.stringify(cal, null, 2) + '\n');
}

/**
 * Copy posts already marked scheduled in posts.json that the calendar lacks.
 * Their `when` is interpreted in THIS machine's timezone, which is only right if
 * they were scheduled from the same timezone.
 */
function backfill(rootDir, manifestPath) {
  if (!fs.existsSync(manifestPath)) return 0;
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const have = new Set(readCalendar(rootDir).posts.map(p => p.id));
  let n = 0;
  for (const p of manifest.posts || []) {
    if (p.status === 'scheduled' && !have.has(p.id)) {
      recordScheduled(rootDir, p);
      n++;
    }
  }
  return n;
}

module.exports = { readCalendar, recordScheduled, backfill, calendarPath };
