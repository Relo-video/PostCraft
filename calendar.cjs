#!/usr/bin/env node
/**
 * Local calendar of scheduled posts.
 *
 *   node calendar.cjs              serve it on http://localhost:4747 and open it
 *   node calendar.cjs --port 5000  another port
 *   node calendar.cjs --backfill   first add posts already marked scheduled in posts.json
 *   node calendar.cjs --no-open    do not open a browser
 *
 * Data comes from calendar.json, which schedule.cjs writes after each successful
 * schedule. It is gitignored, so a fresh clone shows an empty calendar.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { readCalendar, backfill } = require('./lib/calendar.cjs');

function arg(name) {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : null;
}

const ROOT = __dirname;
const PORT = Number(arg('--port')) || 4747;

if (process.argv.includes('--backfill')) {
  const n = backfill(ROOT, path.resolve(ROOT, arg('--manifest') || 'posts.json'));
  console.log(`Backfilled ${n} post(s) from posts.json.`);
}

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  try {
    if (url === '/' || url === '/calendar.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(path.join(ROOT, 'calendar.html')));
    } else if (url === '/calendar.json') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(readCalendar(ROOT)));
    } else {
      res.writeHead(404); res.end('Not found');
    }
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end(e.message);
  }
});

server.on('error', e => {
  console.error(e.code === 'EADDRINUSE'
    ? `Port ${PORT} is busy. Is the calendar already open? Otherwise use --port <n>.`
    : e.message);
  process.exit(1);
});

// Loopback only: the calendar holds unpublished captions.
server.listen(PORT, '127.0.0.1', () => {
  const url = `http://localhost:${PORT}`;
  console.log(`Calendar: ${url}  (Ctrl+C to stop)`);
  if (process.argv.includes('--no-open')) return;
  const [cmd, args] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
    : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  spawn(cmd, args, { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
});
