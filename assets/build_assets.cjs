#!/usr/bin/env node
/**
 * Generalized asset builder. Any topic, any brand.
 *
 * Everything that used to be hardcoded in per-brand scripts
 * (colours, fonts, slide copy, output paths) now comes from a JSON brief.
 *
 *   node build_assets.cjs --brief briefs/my-carousel.json
 *   node build_assets.cjs --brief briefs/x.json --only square
 *
 * Outputs, driven by the brief's "outputs" array:
 *   square    1080x1080 PNG per slide   LinkedIn / Instagram / X
 *   pdf       1080x1080 multipage PDF   LinkedIn document post
 *   vertical  1080x1920 PNG per slide   Reels / Shorts / TikTok
 *   video     1080x1920 MP4 (crossfade) from the vertical slides, needs ffmpeg
 *
 * Brand colours can be auto-pulled from a site with:
 *   node build_assets.cjs --brand-from https://example.com --out briefs/brand.json
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const puppeteer = require('puppeteer-core');

// Chrome, located without any configuration at all. CHROME_PATH still overrides for
// unusual installs, but nothing in PostCraft requires an environment variable.
const CHROME = process.env.CHROME_PATH || (() => {
  const fsx = require('fs');
  const byPlatform = {
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
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium',
    ],
  };
  const found = (byPlatform[process.platform] || [])
    .find(c => { try { return c && fsx.existsSync(c); } catch (e) { return false; } });
  if (!found) {
    throw new Error('Could not find Chrome. Install it, or set CHROME_PATH to its location.');
  }
  return found;
})();
const sleep = ms => new Promise(r => setTimeout(r, ms));

function arg(n, d = null) {
  const i = process.argv.indexOf(n);
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
}

// ---------------------------------------------------------------- brand probe
async function brandFrom(url, out) {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
  const brand = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    const vars = {};
    for (const sheet of Array.from(document.styleSheets)) {
      let rules = [];
      try { rules = Array.from(sheet.cssRules || []); } catch (e) { continue; }
      for (const r of rules) {
        if (r.style) for (const p of Array.from(r.style)) {
          if (p.startsWith('--')) vars[p] = r.style.getPropertyValue(p).trim();
        }
      }
    }
    const pick = (...names) => {
      for (const n of names) {
        const hit = Object.keys(vars).find(k => k.includes(n));
        if (hit && vars[hit]) return vars[hit];
      }
      return null;
    };
    return {
      vars,
      accent: pick('accent', 'primary', 'brand'),
      gradient: pick('grad'),
      ink: pick('ink', 'text-primary', 'foreground'),
      bg: pick('bg-primary', 'background'),
      fontDisplay: pick('font-display', 'font-heading'),
      fontBody: pick('font-body', 'font-sans'),
      title: document.title,
    };
  });
  await browser.close();
  const brief = {
    source: url, title: brand.title,
    colors: {
      accent: brand.accent || '#3878ff', gradient: brand.gradient || null,
      ink: brand.ink || '#0a0a0b', paper: '#F8FAFC', bg: brand.bg || '#0a0a0b',
    },
    fonts: { display: brand.fontDisplay || 'Sora', body: brand.fontBody || 'Inter' },
    _all_css_vars: brand.vars,
  };
  fs.writeFileSync(out, JSON.stringify(brief, null, 2));
  console.log(`brand written to ${out}`);
  console.log(`  accent=${brief.colors.accent}  gradient=${brief.colors.gradient || 'none'}`);
  return brief;
}

// ------------------------------------------------------------------ templates
function css(b, vertical) {
  const W = 1080, H = vertical ? 1920 : 1080;
  const s = vertical ? 1.55 : 1;      // scale type up on the taller canvas
  const grad = b.colors.gradient || `linear-gradient(115deg, ${b.colors.accent}, ${b.colors.accent})`;

  // theme: "light" or "dark" (default). Everything that used to be hardcoded for a
  // dark canvas is derived here, so a brief can flip the whole look with one field.
  const light = (b.theme || 'dark') === 'light';
  const bg = b.colors.bg || (light ? '#F7F5F2' : '#0a0a0b');
  const fg = b.colors.fg || (light ? '#0a0a0b' : '#F8FAFC');
  const rgb = light ? '10,10,11' : '248,250,252';      // fg as rgb, for alpha shades
  const muted = `rgba(${rgb},${light ? 0.66 : 0.62})`;
  const hair = `rgba(${rgb},${light ? 0.14 : 0.11})`;   // rules and borders
  const chipBg = `rgba(${rgb},${light ? 0.04 : 0.05})`;
  const chipBd = `rgba(${rgb},${light ? 0.16 : 0.13})`;
  const grain = light ? 'rgba(10,10,11,.030)' : 'rgba(255,255,255,.045)';
  const meshDefault = light
    ? `radial-gradient(48% 42% at 14% 16%, ${b.colors.accent}1f, transparent 62%),
       radial-gradient(46% 40% at 88% 12%, ${b.colors.accent}18, transparent 62%)`
    : `radial-gradient(45% 40% at 16% 20%, ${b.colors.accent}22, transparent 60%),
       radial-gradient(45% 38% at 86% 16%, ${b.colors.accent}33, transparent 60%)`;

  const fonts = [b.fonts.display, b.fonts.body, 'Instrument Serif']
    .map(f => f.replace(/["']/g, '').split(',')[0].trim().replace(/ /g, '+'))
    .filter((v, i, a) => a.indexOf(v) === i)
    .map(f => `family=${f}:ital,wght@0,400;0,600;0,700;0,800;1,400`).join('&');
  return `
<meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?${fonts}&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{width:${W}px;height:${H}px;overflow:hidden;background:${bg};color:${fg};
  font-family:'${b.fonts.body}',-apple-system,sans-serif;position:relative;
  padding:${Math.round(64 * s)}px ${Math.round(68 * s)}px;
  display:flex;flex-direction:column;justify-content:space-between}
.mesh{position:absolute;inset:0;pointer-events:none;background:${b.mesh || meshDefault}}
.grain{position:absolute;inset:0;pointer-events:none;opacity:.35;
  background-image:radial-gradient(${grain} 1px, transparent 1px);background-size:4px 4px}
.z{position:relative;z-index:2}
.nav{display:flex;justify-content:space-between;align-items:center}
.badge{display:inline-flex;align-items:center;gap:${10 * s}px;background:${chipBg};
  border:1px solid ${chipBd};padding:${9 * s}px ${20 * s}px;border-radius:9999px;
  font-size:${Math.round(13 * s)}px;font-weight:700;letter-spacing:1.3px;text-transform:uppercase}
.dot{width:${9 * s}px;height:${9 * s}px;border-radius:50%;background:${grad}}
.wordmark{font-family:'${b.fonts.display}',sans-serif;font-weight:800;font-size:${Math.round(20 * s)}px;letter-spacing:-.3px}
.wordmark span{background:${grad};-webkit-background-clip:text;-webkit-text-fill-color:transparent}
h1{font-family:'${b.fonts.display}',sans-serif;font-weight:800;letter-spacing:-${2.4 * s}px;line-height:1.03;
  font-size:${Math.round(72 * s)}px}
h2{font-family:'${b.fonts.display}',sans-serif;font-weight:700;letter-spacing:-${1.6 * s}px;line-height:1.14;
  font-size:${Math.round(46 * s)}px;margin-bottom:${20 * s}px}
.ital{font-family:'Instrument Serif',serif;font-style:italic;font-weight:400;letter-spacing:-1px;
  background:${grad};-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.sub{font-size:${Math.round(23 * s)}px;line-height:1.5;color:${muted};max-width:${vertical ? 920 : 820}px}
.rule{height:${3 * s}px;width:${96 * s}px;border-radius:2px;background:${grad}}
.num{font-family:'Instrument Serif',serif;font-style:italic;font-size:${Math.round(120 * s)}px;line-height:.8;
  background:${grad};-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.stat{font-family:'${b.fonts.display}',sans-serif;font-size:${Math.round(96 * s)}px;font-weight:800;
  letter-spacing:-${3.5 * s}px;margin:${18 * s}px 0 ${10 * s}px}
.foot{display:flex;justify-content:space-between;align-items:center;border-top:1px solid ${hair};
  padding-top:${22 * s}px;font-size:${Math.round(15 * s)}px;color:${muted}}
.foot b{color:${fg};font-weight:600}
.cta{display:inline-flex;align-items:center;gap:${14 * s}px;background:${grad};color:${light ? '#ffffff' : bg};
  font-family:'${b.fonts.display}',sans-serif;font-weight:800;font-size:${Math.round(24 * s)}px;
  padding:${20 * s}px ${38 * s}px;border-radius:9999px}
.shot{margin:${34 * s}px 0;border-radius:20px;overflow:hidden;border:1px solid ${chipBd};
  box-shadow:0 30px 80px -30px rgba(0,0,0,.9);max-height:${vertical ? 700 : 420}px}
.shot img{width:100%;display:block}
</style>`;
}

function render(slide, b, i, total, vertical) {
  const head = css(b, vertical);
  const brandMark = b.wordmark
    ? `<div class="wordmark">${b.wordmark.replace(/^(.*?)(\..*)$/, '$1<span>$2</span>')}</div>` : '';
  const nav = `<div class="nav z"><div class="badge"><span class="dot"></span>${slide.kicker || b.kicker || ''}</div>${brandMark}</div>`;
  const foot = `<div class="foot z"><div>${slide.footer || `${i + 1} / ${total}`}</div><div><b>${b.handle || ''}</b></div></div>`;
  const ital = t => (t || '').replace(/\*(.+?)\*/g, '<span class="ital">$1</span>');

  let img = '';
  if (slide.image && fs.existsSync(slide.image)) {
    img = `<div class="shot"><img src="data:image/png;base64,${fs.readFileSync(slide.image).toString('base64')}"></div>`;
  }

  const body = slide.type === 'cover'
    ? `<div class="z"><div class="rule" style="margin-bottom:34px"></div>
         <h1 style="font-size:${vertical ? 150 : 104}px">${ital(slide.title)}</h1>
         ${slide.sub ? `<p class="sub" style="margin-top:34px;font-size:${vertical ? 40 : 25}px">${slide.sub}</p>` : ''}</div>`
    : slide.type === 'cta'
      ? `<div class="z"><h1>${ital(slide.title)}</h1>${img}
         ${slide.cta ? `<div class="cta">${slide.cta}</div>` : ''}
         ${slide.sub ? `<p class="sub" style="margin-top:22px">${slide.sub}</p>` : ''}</div>`
      : `<div class="z">${slide.index !== false ? `<div class="num">${String(i + 1).padStart(2, '0')}</div>` : ''}
         ${slide.stat ? `<div class="stat">${ital(slide.stat)}</div>` : ''}
         <div class="rule" style="margin:26px 0 30px"></div>
         ${slide.title ? `<h2>${ital(slide.title)}</h2>` : ''}
         ${slide.body ? `<p class="sub" style="font-size:${vertical ? 34 : 26}px">${slide.body}</p>` : ''}${img}</div>`;

  return `<!DOCTYPE html><html><head>${head}</head><body>
<div class="mesh"></div><div class="grain"></div>${nav}${body}${foot}</body></html>`;
}

// ----------------------------------------------------------------------- main
(async () => {
  const brandUrl = arg('--brand-from');
  if (brandUrl) { await brandFrom(brandUrl, arg('--out', 'brand.json')); return; }

  const briefPath = arg('--brief');
  if (!briefPath) {
    console.log('usage: node build_assets.cjs --brief <file.json> [--only square|pdf|vertical|video]');
    console.log('       node build_assets.cjs --brand-from <url> --out brand.json');
    process.exit(1);
  }
  const brief = JSON.parse(fs.readFileSync(briefPath, 'utf8'));
  const b = brief.brand;
  const only = arg('--only');
  const outputs = only ? [only] : (brief.outputs || ['square']);
  const OUT = path.resolve(__dirname, brief.outDir || `output/${new Date().toISOString().slice(0, 10)}/${brief.id}`);
  fs.mkdirSync(OUT, { recursive: true });

  // resolve relative slide images against the brief's directory
  for (const s of brief.slides) {
    if (s.image) s.image = path.resolve(path.dirname(path.resolve(briefPath)), s.image);
  }

  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--font-render-hinting=none'],
  });
  const page = await browser.newPage();
  const made = {};

  for (const kind of outputs.filter(o => o === 'square' || o === 'vertical' || o === 'pdf' || o === 'video')) {
    const vertical = kind === 'vertical' || kind === 'video';
    if (kind === 'pdf' && made.square) { /* reuse squares below */ }
    const W = 1080, H = vertical ? 1920 : 1080;
    const tag = vertical ? 'v' : 's';
    if (made[vertical ? 'vertical' : 'square']) continue;

    await page.setViewport({ width: W, height: H, deviceScaleFactor: vertical ? 1 : 2 });
    const files = [];
    for (let i = 0; i < brief.slides.length; i++) {
      const tmp = path.join(OUT, '_tmp.html');
      fs.writeFileSync(tmp, render(brief.slides[i], b, i, brief.slides.length, vertical));
      await page.goto('file:///' + tmp.replace(/\\/g, '/'), { waitUntil: 'networkidle0' });
      await sleep(900);
      const f = path.join(OUT, `${tag}_${String(i + 1).padStart(2, '0')}.png`);
      await page.screenshot({ path: f });
      files.push(f);
      console.log('  rendered', path.basename(f));
    }
    fs.unlinkSync(path.join(OUT, '_tmp.html'));
    made[vertical ? 'vertical' : 'square'] = files;
  }

  // PDF (LinkedIn document post) from the square slides
  if (outputs.includes('pdf')) {
    const imgs = made.square;
    if (!imgs) { console.log('  pdf needs "square" in outputs'); }
    else {
      const html = `<!DOCTYPE html><html><head><style>@page{size:1080px 1080px;margin:0}
        *{margin:0;padding:0}img{width:1080px;height:1080px;display:block;page-break-after:always}
        img:last-child{page-break-after:auto}</style></head><body>` +
        imgs.map(p => `<img src="data:image/png;base64,${fs.readFileSync(p).toString('base64')}">`).join('') +
        `</body></html>`;
      const tmp = path.join(OUT, '_pdf.html');
      fs.writeFileSync(tmp, html);
      await page.goto('file:///' + tmp.replace(/\\/g, '/'), { waitUntil: 'networkidle0' });
      await page.pdf({ path: path.join(OUT, `${brief.id}.pdf`), width: '1080px', height: '1080px',
                       printBackground: true, pageRanges: `1-${imgs.length}` });
      fs.unlinkSync(tmp);
      console.log('  rendered', `${brief.id}.pdf`);
    }
  }
  await browser.close();

  // MP4 from the vertical slides
  if (outputs.includes('video')) {
    const imgs = made.vertical;
    if (!imgs) { console.log('  video needs "vertical" in outputs'); }
    else {
      const HOLD = brief.video?.hold ?? 3.0, FADE = brief.video?.fade ?? 0.45, FPS = brief.video?.fps ?? 30;
      const seg = HOLD + FADE;
      const args = [];
      for (const f of imgs) args.push('-loop', '1', '-t', String(seg), '-i', f);
      // offset advances by HOLD, NOT HOLD+FADE - xfade consumes the transition
      let filter = '', prev = '[0:v]';
      for (let i = 1; i < imgs.length; i++) {
        const out = i === imgs.length - 1 ? '[v]' : `[x${i}]`;
        filter += `${prev}[${i}:v]xfade=transition=fade:duration=${FADE}:offset=${(HOLD * i).toFixed(2)}${out};`;
        prev = out;
      }
      const mp4 = path.join(OUT, `${brief.id}.mp4`);
      execFileSync('ffmpeg', ['-y', ...args,
        '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
        '-filter_complex', filter.replace(/;$/, ''),
        '-map', '[v]', '-map', `${imgs.length}:a`,
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', String(FPS),
        '-profile:v', 'high', '-level', '4.0', '-movflags', '+faststart',
        '-c:a', 'aac', '-b:a', '128k', '-shortest', mp4], { stdio: ['ignore', 'ignore', 'pipe'] });
      const secs = (seg * imgs.length - FADE * (imgs.length - 1)).toFixed(1);
      console.log(`  rendered ${brief.id}.mp4  (${secs}s, 1080x1920)`);
    }
  }

  console.log(`\nDone → ${OUT}`);
})().catch(e => { console.error('\nFAILED:', e.message); process.exit(1); });
