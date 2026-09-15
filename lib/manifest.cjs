/**
 * Shared manifest loading + validation for the scheduling scripts.
 *
 * Reads posts.json, picks the entry named by --id (or the first pending entry
 * for the platform), validates it, and derives the per-platform date/time shapes
 * the two composers actually demand. Both of those formats were arrived at the
 * hard way:
 *   - LinkedIn's date field REJECTS mm/dd/yyyy despite its own placeholder, and
 *     its time field only accepts values that exist as 15-minute typeahead options.
 *   - X's schedule dialog is six <select>s whose values are unpadded strings.
 */
const fs = require('fs');
const path = require('path');

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function arg(name) {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : null;
}

function parseWhen(when) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(when || '');
  if (!m) throw new Error(`Bad "when": ${when} (expected YYYY-MM-DDTHH:MM)`);
  const [, Y, Mo, D, H, Mi] = m.map(Number.call, Number);
  const dt = new Date(m[1], m[2] - 1, m[3], m[4], m[5]);
  if (isNaN(dt)) throw new Error(`Invalid date: ${when}`);
  if (dt.getTime() < Date.now()) throw new Error(`"when" is in the past: ${when}`);
  const h24 = Number(m[4]);
  const ampm = h24 < 12 ? 'am' : 'pm';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const minute = Number(m[5]);
  return {
    dt,
    // LinkedIn wants m/d/yyyy and a 15-minute slot label like "9:00 AM"
    liDate: `${Number(m[2])}/${Number(m[3])}/${m[1]}`,
    liTime: `${h12}:${m[5]} ${ampm.toUpperCase()}`,
    // X wants raw <select> values
    xWhen: {
      month: String(Number(m[2])), day: String(Number(m[3])), year: m[1],
      hour: String(h12), minute: String(minute), ampm,
    },
    whenLabel: `${DAYS[dt.getDay()]}, ${MONTHS[dt.getMonth()].slice(0, 3)} ${dt.getDate()} ${dt.getFullYear()}, ${h12}:${m[5]} ${ampm.toUpperCase()}`,
    minute,
  };
}

function loadPost(rootDir, platform, opts = {}) {
  const manifestPath = path.resolve(rootDir, arg('--manifest') || 'posts.json');
  if (!fs.existsSync(manifestPath)) throw new Error('Manifest not found: ' + manifestPath);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  // opts.id wins: in --all mode the runner iterates ids itself and there is no
  // --id on the command line to read.
  const id = opts.id || arg('--id');
  const candidates = manifest.posts.filter(p => p.platform === platform);
  let entry;
  if (id) {
    entry = manifest.posts.find(p => p.id === id);
    if (!entry) throw new Error(`No post with id "${id}" in ${path.basename(manifestPath)}`);
    if (entry.platform !== platform) {
      throw new Error(`Post "${id}" is for ${entry.platform}, but this script schedules ${platform}`);
    }
  } else {
    entry = candidates.find(p => p.status !== 'scheduled' && p.status !== 'posted');
    if (!entry) throw new Error(`No pending ${platform} posts. Pass --id to re-run a specific one.`);
  }

  if (entry.status === 'scheduled' && !process.argv.includes('--force')) {
    throw new Error(`Post "${entry.id}" is already marked scheduled. Re-run with --force if you really mean it.`);
  }

  // files
  const files = entry.files || (entry.file ? [entry.file] : []);
  // A text-only post has no media by design; everything else must carry a file.
  if (!files.length && entry.type !== 'text') {
    throw new Error(`Post "${entry.id}" has no file/files`);
  }
  for (const f of files) {
    const abs = path.resolve(rootDir, f);
    if (!fs.existsSync(abs)) throw new Error(`Missing asset: ${f}`);
  }

  // caption limits
  const caption = (entry.caption || '').trim();
  if (!caption) throw new Error(`Post "${entry.id}" has no caption`);
  const limit = { x: 280, instagram: 2200, linkedin: 3000 }[platform] || 3000;
  if (caption.length > limit) {
    throw new Error(`Caption is ${caption.length} chars, over the ${platform} limit of ${limit}`);
  }

  // Each script implements ONE composer flow. LinkedIn's document (PDF) path and
  // its image path are different UIs, so refuse to run the wrong one.
  if (opts.types && !opts.types.includes(entry.type)) {
    throw new Error(
      `Post "${entry.id}" is type "${entry.type}", but this script only handles: ${opts.types.join(', ')}`);
  }

  const when = parseWhen(entry.when);
  if (platform === 'x' && when.minute % 15 !== 0) {
    throw new Error(`X only offers 15-minute slots; ${entry.when} has :${String(when.minute).padStart(2, '0')}`);
  }
  if (platform === 'instagram' && when.minute % 15 !== 0) {
    throw new Error(`Business Suite schedules on 15-minute slots; ${entry.when} has :${String(when.minute).padStart(2, '0')}`);
  }
  if (platform === 'linkedin' && when.minute % 15 !== 0) {
    throw new Error(`LinkedIn's time typeahead only lists 15-minute slots; ${entry.when} has :${String(when.minute).padStart(2, '0')}`);
  }
  const maxImages = { x: 4, instagram: 10, linkedin: 20 }[platform];
  if (maxImages && files.length > maxImages) {
    throw new Error(`${platform} allows at most ${maxImages} images, got ${files.length}`);
  }

  return { ...entry, caption, files, manifestPath, ...when };
}

/** Mark an entry scheduled so a later run will not silently double-post it. */
function markScheduled(manifestPath, id) {
  const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const e = m.posts.find(p => p.id === id);
  if (!e) return;
  e.status = 'scheduled';
  e.scheduledAt = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(manifestPath, JSON.stringify(m, null, 2) + '\n');
}

module.exports = { loadPost, markScheduled, parseWhen };
