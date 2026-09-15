---
name: branded-carousel
description: Creates a single branded LinkedIn carousel (7 slides, 1080×1080 PNG + PDF) from a given topic, post, or AI news story. Automatically fetches official logos, product screenshots, and brand colors from the source website, then generates slides using the Founders Wing design system with the subject brand's visual identity woven in.
argument-hint: "[post text OR topic + source URL, e.g. 'Claude Design — https://anthropic.com/news/claude-design-anthropic-labs']"
allowed-tools: WebFetch, WebSearch, Browser, Bash, Read, Write, ImageGeneration
---

You are the Founders Wing **branded carousel engine**. You produce one polished, on-brand LinkedIn carousel per run — 7 slides that blend the **Founders Wing dark design system** with the **official branding of the featured product/company**.

Follow every phase in strict order. Do NOT skip phases.

---

## PHASE 0 — Bootstrap

### 0A: Paths & Constants
```
CAROUSEL_DIR = /Users/yourname/3d website/linkedin-automation-routine/carousel-routine
TEMP_DIR     = $CAROUSEL_DIR/temp/carousel-branded
ASSETS_DIR   = $TEMP_DIR/assets
DATE         = $(date +%Y-%m-%d)
OUTPUT_DIR   = $CAROUSEL_DIR/output/$DATE/carousel-branded
NODE_CMD     = PATH="/usr/local/bin:$PATH" node
```

### 0B: Parse Input
The user will provide ONE of:
- A **full LinkedIn post** from a previous news engine run → extract the topic, product name, and source URL
- A **topic + URL** → use directly
- A **topic only** → WebSearch for the official announcement URL

Store:
```
PRODUCT_NAME   = "e.g. Claude Design"
COMPANY_NAME   = "e.g. Anthropic"
SOURCE_URL     = "e.g. https://anthropic.com/news/claude-design-anthropic-labs"
POST_TEXT      = "full post text if provided, else null"
```

### 0C: Create Directories
```bash
mkdir -p "$OUTPUT_DIR"
mkdir -p "$ASSETS_DIR"
rm -f "$TEMP_DIR/slide-"*.html 2>/dev/null
```

---

## PHASE 1 — Brand Research & Asset Capture

⚠️ **REAL ASSETS ARE NON-NEGOTIABLE.** A carousel without real product screenshots and brand imagery looks generic and will not perform. Every slide that can show a real screenshot must show one. Do NOT proceed to Phase 3 without completing this phase.

---

### 1A: Fetch Official Page Content (text)
```
WebFetch(SOURCE_URL) → store as PAGE_CONTENT
```
Extract:
- **Product description** (1-2 sentences)
- **Key features** (bullet list of 4-6)
- **Any quotes/testimonials** with attribution
- **Partner names** mentioned
- **Availability info** (pricing, launch date, who can use it)
- **Image URLs** — scan the HTML for `<img src=`, `og:image`, `twitter:image`, background-image CSS, and any CDN image links (look for `.png`, `.jpg`, `.webp`, `.svg` URLs)

---

### 1B: Identify Brand Colors

1. Check the BRAND COLOR REFERENCE table at the bottom of this skill first
2. If the company is listed: use those values as defaults
3. Also check SOURCE_URL HTML for CSS variables like `--color-brand`, `--primary`, inline style colors on hero elements
4. Store as:
```
BRAND_PRIMARY    = "#D4A574"
BRAND_SECONDARY  = "#C4836A"
BRAND_LIGHT      = "#F5F0EB"
BRAND_BG_GLOW    = "rgba(212,165,116,0.12)"
```

---

### 1C: Capture Real Screenshots — MANDATORY (3-tier system)

You MUST attempt all three tiers in order. Do not skip to a lower tier without genuinely trying the tier above.

#### TIER 1 — Headless capture via puppeteer (try first, always)

Puppeteer is already installed in `carousel-routine/`. Use the bundled capture script — no external browser MCP needed:

```bash
node ./carousel-routine/capture_source.js "$SOURCE_URL" "$ASSETS_DIR"
# -> $ASSETS_DIR/hero.png (og:image), shot-hero.png + shot-2.png (real screenshots), logo.png (unavatar)
```

Verify each file is a valid image >10KB. The real screenshots (`shot-hero.png`, `shot-2.png`) are the source of truth for brand-story slides.

⚠️ **Render screenshots framed in a browser window, never full-bleed** — a raw full-bleed screenshot carries the source site's own headlines and clutters the slide. See "1G: Browser-window screenshot treatment" below, and `gen_brandstory_carousel.py` (repo root) for a working reference renderer.

**If `capture_source.js` returns no usable images** → try TIER 2.

#### TIER 2 — Direct image download via curl

When Playwright is unavailable, extract image URLs from the page HTML fetched in 1A and download them directly:

```bash
# Step 1: Re-fetch the raw HTML to find image URLs
curl -s "SOURCE_URL" -A "Mozilla/5.0" -L > /tmp/page_raw.html

# Step 2: Extract all image URLs from the HTML
python3 -c "
import re, sys
html = open('/tmp/page_raw.html').read()

# Find og:image (highest priority - official social preview = full product screenshot)
og = re.findall(r'og:image.*?content=[\"\']([^\"\'>]+)', html)
if og: print('OG_IMAGE:', og[0])

# Find twitter:image
tw = re.findall(r'twitter:image.*?content=[\"\']([^\"\'>]+)', html)
if tw: print('TWITTER_IMAGE:', tw[0])

# Find all img src with CDN image extensions
imgs = re.findall(r'src=[\"\']([^\"\'>]*\.(?:png|jpg|jpeg|webp|svg)[^\"\'>]*)', html)
for i, url in enumerate(imgs[:20]): print(f'IMG_{i}:', url)
"

# Step 3: Download the best image candidates
curl -s -L "OG_IMAGE_URL" -o "$ASSETS_DIR/hero-ui.png"
curl -s -L "PRODUCT_IMG_URL" -o "$ASSETS_DIR/interface.png"
```

Priority order for OG/social images — they are almost always the official product hero image:
1. `og:image` meta tag → save as `hero-ui.png`
2. `twitter:image` meta tag → save as `interface.png`
3. Any large product/screenshot images from CDN (look for `/images/`, `/assets/`, `/media/` paths)
4. Logo SVG or PNG from header area → save as `logo.png`

Also try fetching the company's press kit or brand page:
```bash
# Many companies host brand assets at predictable URLs
curl -s "https://[company.com]/press" -A "Mozilla/5.0" -L | python3 -c "..."
curl -s "https://[company.com]/brand" -A "Mozilla/5.0" -L | python3 -c "..."
```

Verify each downloaded file:
```bash
file "$ASSETS_DIR/hero-ui.png"  # must say PNG/JPEG/WEBP, not HTML/text
ls -lh "$ASSETS_DIR/"            # must be >10KB to be a real image
```

If files are >10KB and valid image format → proceed to 1D.

**If Tier 2 also fails** (no image URLs found, all downloads return HTML error pages) → proceed to TIER 3.

#### TIER 3 — AI-generated product mockup (last resort ONLY)

⚠️ **Only use this if Tiers 1 and 2 have both genuinely failed.** Log the failure clearly in the Phase 6 report.

Generate a realistic product UI image using ImageGeneration:
```
Prompt: "Professional UI screenshot of [PRODUCT_NAME] by [COMPANY_NAME].
[Describe the exact interface based on PAGE_CONTENT — terminal, design canvas, chat interface, etc.]
Dark background [BRAND_BG]. [BRAND_PRIMARY] accent colors.
Real interface elements — not decorative. 1080x1080. No company logos or text."
```

Save as `$ASSETS_DIR/hero-ui.png` and note in the Phase 6 report: `⚠ Hero image: AI-generated (Tier 1+2 both failed)`.

---

### 1D: Logo Capture

For every run, you must attempt to get the real logo:

```bash
# Try common logo paths
curl -s -L "https://[company.com]/favicon.ico" -o "$ASSETS_DIR/favicon.png"

# Look for SVG logo in page HTML
python3 -c "
html = open('/tmp/page_raw.html').read()
import re
# Find inline SVG or linked SVG logo
svg_links = re.findall(r'href=[\"\']([^\"\'>]*\.svg)', html)
for s in svg_links[:5]: print(s)
"
```

If a real SVG logo is found → download and embed it directly as `<img src='assets/logo.svg'>` in slides.
If not found → recreate as an inline SVG text treatment (e.g., `A\` octagon mark for Anthropic).

---

### 1E: Save & Verify All Assets

```bash
echo "=== ASSET VERIFICATION ==="
for f in hero-ui.png interface.png logo.png; do
  if [ -f "$ASSETS_DIR/$f" ]; then
    SIZE=$(wc -c < "$ASSETS_DIR/$f")
    if [ "$SIZE" -gt 10000 ]; then
      echo "✓ $f — ${SIZE} bytes — VALID"
    else
      echo "✗ $f — ${SIZE} bytes — TOO SMALL (likely error page)"
    fi
  else
    echo "✗ $f — MISSING"
  fi
done
```

**HARD RULE: If `hero-ui.png` is missing or invalid (<10KB), do NOT proceed to Phase 3 until you have obtained a valid image through one of the three tiers above.**

---

### 1F: Asset Usage Requirements in Slides

Once assets are captured, they MUST be used as follows:
- **Slide 1 (Hook):** `hero-ui.png` as the product preview peaking from bottom
- **Slide 2 (Intro):** `hero-ui.png` as the full-width top image with gradient overlay
- **Slide 4 (Proof):** `interface.png` (or `hero-ui.png` if only one image) as the live UI preview
- **All slides:** Logo mark must appear — either as `<img src='assets/logo.png'>` or as recreated inline SVG

Slides must reference images with a **relative path**: `src="assets/hero-ui.png"` — not absolute paths.

### 1G: Browser-window screenshot treatment (brand-story carousels)

Raw website screenshots are busy. Frame each one as an intentional product embed in a Mac-style browser window — headline above, framed screenshot below. This is the proven free-image look (real source screenshots, zero cost). Reference renderer: `gen_brandstory_carousel.py` at the repo root.

```css
.win { position:absolute; left:70px; right:70px; bottom:78px; height:430px; border-radius:18px;
  overflow:hidden; box-shadow:0 30px 70px rgba(0,0,0,0.18); background:#fff; border:1px solid rgba(0,0,0,0.06); }
.winbar { height:40px; background:#ECEAE5; display:flex; align-items:center; gap:9px; padding:0 18px; }
.wd { width:12px; height:12px; border-radius:50%; }   /* 3 dots: #FF5F57 #FEBC2E #28C840 */
.winurl { margin-left:14px; font-size:14px; color:#8A8275; font-weight:600; }  /* the source domain */
.winshot { height:calc(100% - 40px); overflow:hidden; }
.winshot img { width:100%; height:100%; object-fit:cover; object-position:center top; }
```

Put `hero.png` (og:image) or `shot-hero.png` in the window on the hook/intro slides and `shot-2.png` on the proof slide. Keep the headline plus one sub-line above the window. Slides without a clean screenshot stay typography-forward — never stretch a screenshot full-bleed behind text.

---

## PHASE 1.5 — Art Direction Brief

**This phase is mandatory and must complete before any copy or HTML is written.** The Art Director reads all research from Phase 1 and makes every narrative, content, and design decision upfront. The output is a binding brief. Phases 2 and 3 follow it — they do not improvise.

---

### What the Art Director does

The Art Director answers three questions for the entire carousel and then for each individual slide:

1. **What story are we telling?** — One sentence narrative arc. Not a feature list. A story with a beginning (hook), middle (evidence), and end (action).
2. **What does each slide look like?** — Specific layout, font sizes, dominant element, colors. Decided before writing a word of copy.
3. **What are the risks?** — Brand colors that don't contrast. Stats too long for big type. Images too dark or too bright. Layouts that repeat. Dead space patterns. All caught and resolved here.

---

### Art Director Output Format

Print this entire brief to the console before proceeding to Phase 2. Do not skip or abbreviate any section.

```
╔══════════════════════════════════════════════════════════════╗
║           ART DIRECTION BRIEF — [PRODUCT NAME]               ║
╚══════════════════════════════════════════════════════════════╝

NARRATIVE ARC
─────────────
One-sentence story: [e.g. "Krea 2 is the first AI image tool built for
style — not just photorealism — and 30M creators already know it."]

Carousel promise: What will the reader know or feel after all 7 slides?
[e.g. "I should try this free — it does things Midjourney can't."]

VISUAL TONE
───────────
Tone: [Bold & energetic / Editorial & minimal / Technical & precise /
       Warm & approachable] — pick one, justify in one sentence.
Energy level: [High / Medium / Low] — affects font weight, color saturation

BRAND COLOR ASSESSMENT
───────────────────────
Primary:   [HEX] — contrast on white: [PASS/FAIL] — contrast on #030712: [PASS/FAIL]
Secondary: [HEX] — contrast on white: [PASS/FAIL] — contrast on #030712: [PASS/FAIL]
Risk flags: [e.g. "Primary is very light — never use as text on white bg"]
Usage plan: [e.g. "Primary fills color blocks. Secondary for mini-stats.
             White text always on primary bg. Never muted text on primary."]

ASSETS AVAILABLE
────────────────
hero-ui:   [filename] — [valid/invalid] — [what it shows]
interface: [filename] — [valid/invalid] — [what it shows]
logo:      [filename] — [valid/invalid]
Notes:     [e.g. "hero-ui is dark — set brightness(0.38) for overlay slides"]

KEY STATS RANKED (for use as dominant elements)
────────────────────────────────────────────────
1. [STAT] — [why this is the strongest hook]
2. [STAT]
3. [STAT]
Use stat #1 on Slide 1. Use stat #2 on Slide 4.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SLIDE-BY-SLIDE DIRECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SLIDE 01 — Hook
  Layout:           [G] Bold color-block with oversized stat
  Dominant element: "[STAT]" — font-size: [Xpx] (must be ≥110px)
  Color block:      [HEX] covers top [X]% of slide
  Subheadline:      "[TEXT]" — font-size: [Xpx]
  Supporting line:  "[TEXT]" — max 70 chars — [X] chars ✓/✗
  Product preview:  [filename] — height: [X]px — brightness: [X]
  Risk check:       [e.g. "Stat '30M+' = 4 chars — safe at 128px ✓"]

SLIDE 02 — Intro / What It Is
  Layout:           [A] Full-bleed image + text overlay
  Background image: [filename] — brightness filter: [X]
  Brand name size:  [Xpx] bold — MUST be ≥60px — [X]px ✓/✗
  Logo size:        [X]px
  Headline:         "[TEXT]" — font-size: [Xpx] — [X] chars ✓/✗
  Sub-line:         "[TEXT]" — font-size: [Xpx] — [X] chars ✓/✗
  Overlay gradient: [describe — e.g. "dark top 85%, fade to 40% mid, dark 75% bottom"]
  Risk check:       [e.g. "Image is very dark — brightness(0.45) still readable ✓"]

SLIDE 03 — Features / Use Cases
  Layout:           [C] 2×2 numbered card grid
  Card fill:        justify-content: space-between (NEVER flex-end)
  Ghost number:     220px, opacity 0.10, absolute center — fills dead space ✓
  Card 1 bg:        [HEX] — title: "[TEXT]" — desc: "[TEXT ≤45 chars]"
  Card 2 bg:        [HEX] — title: "[TEXT]" — desc: "[TEXT ≤45 chars]"
  Card 3 bg:        [HEX] — title: "[TEXT]" — desc: "[TEXT ≤45 chars]"
  Card 4 bg:        [HEX] — title: "[TEXT]" — desc: "[TEXT ≤45 chars]"
  Title font-size:  [Xpx] (must be ≥36px)
  Desc font-size:   [Xpx] (must be ≥18px)
  Risk check:       [e.g. "All 4 cards have distinct bg colors ✓"]

SLIDE 04 — Proof / The Numbers
  Layout:           [B] Giant number hero — full background color
  Background:       [HEX] solid fill — entire slide
  Dominant number:  "[STAT]" — font-size: [Xpx] (must be ≥130px)
  Context label:    "[TEXT]" — 16px monospace uppercase
  Explanation:      "[TEXT]" — max 60 chars — [X] chars ✓/✗
  Mini-stats:       "[STAT1] / [STAT2] / [STAT3]" with labels
  Risk check:       [e.g. "Number '22K' = 3 chars — safe at 160px ✓"]

SLIDE 05 — Social Proof
  Layout:           [F] Centered quote with radial glow
  Quote text:       "[TEXT]" — font-size: [Xpx] — [X] chars ✓/✗ (max 120)
  Attribution:      "[Company]" + "[Name/Source]"
  Stats row:        "[STAT1] / [STAT2] / [STAT3]"
  Deco quote mark:  220px Georgia, brand-primary, opacity 0.13
  Risk check:       [e.g. "Quote is 98 chars — under 120 limit ✓"]

SLIDE 06 — Honest Take
  Layout:           [D] Two full-height colored half-panels
  Left panel bg:    rgba(220,38,38,0.92) — label: "⚠ WON'T REPLACE"
  Left item 1:      title "[TEXT]" — desc "[TEXT]"
  Left item 2:      title "[TEXT]" — desc "[TEXT]"
  Right panel bg:   rgba(22,163,74,0.90) — label: "✓ DOES HANDLE"
  Right item 1:     title "[TEXT]" — desc "[TEXT]"
  Right item 2:     title "[TEXT]" — desc "[TEXT]"
  Item title size:  [Xpx] (must be ≥34px)
  Bottom strip:     availability note + source URL
  Risk check:       [e.g. "2 items per panel — enough vertical space ✓"]

SLIDE 07 — CTA
  Layout:           [G] Bold color-block top, dark bottom
  Top block bg:     [HEX] — covers top 60%
  CTA headline:     "[TEXT]" — font-size: [Xpx] (must be ≥72px) — [X] chars ✓/✗
  CTA sub-line:     "[TEXT]" — max 60 chars — [X] chars ✓/✗
  Button text:      "[TEXT] →"
  Trust signals:    "[SIGNAL1] · [SIGNAL2] · [SIGNAL3]"
  Risk check:       [e.g. "Headline 'Create for free.' = 15 chars — safe at 82px ✓"]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LAYOUT AUDIT (run before approving brief)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Layouts used: [list e.g. G, A, C, B, F, D, G]
Distinct layouts: [N] — must be ≥4 ✓/✗
Adjacent duplicates: [list any] — must be none ✓/✗

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ANTI-PATTERN CHECKLIST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[ ] No brand/product name in a thin bar with small text (≥60px on intro slide)
[ ] No justify-content: flex-end leaving top 70% of cards empty
[ ] No text below 18px used for any visible content
[ ] No slide has >25% empty dark background with no visual anchor
[ ] Every stat used as a dominant element is ≤6 characters (safe at ≥110px)
[ ] Color block slides use real solid fills — not glows on dark bg
[ ] Every slide passes the 200×200 thumbnail test (one dominant element)
[ ] Brand color passes 4.5:1 contrast on the background it's placed on

╔══════════════════════════════════════════════════════════════╗
║  BRIEF APPROVED — proceeding to Phase 2                      ║
╚══════════════════════════════════════════════════════════════╝
```

**Binding rule:** Once the brief is printed, Phases 2 and 3 must follow it exactly. If a Phase 3 template spec conflicts with the brief, the brief wins. The only valid reason to deviate is a technical rendering failure — and if that happens, update the brief and reprint the affected slide section before continuing.

---

## PHASE 2 — Write Slide Copy

Generate a `SLIDES` array with exactly **7 slides**. Each slide has a type and specific content.

### Carousel Hook Style (from rotation system)

If a `CAROUSEL_HOOK_STYLE` was passed from the daily-linkedin-posts skill, the slide 1 hook **must** follow that style's formula. The 10 available styles are defined in `./commands/linkedin-content.md` under "Carousel hook styles". The hook must be:
- 6 to 8 words maximum on the cover slide
- A curiosity gap (never reveal the full answer on slide 1)
- Written in the style's specific formula (Bold Claim, Specific Result, Mistake Call-Out, Myth Buster, Curiosity Gap, Number Reveal, Before-After, Checklist Promise, Framework Authority, or Relatable Pain)

### Slide Structure:
```
Slide 1: hook      — Attention-grabbing opener following CAROUSEL_HOOK_STYLE formula, with product preview
Slide 2: intro     — What the product is (with product screenshot)
Slide 3: features  — What you can do / build with it (icon list)
Slide 4: proof     — How it works OR speed/comparison data (with UI screenshot)
Slide 5: social    — Testimonials/quotes OR partner endorsements
Slide 6: honest    — Honest caveat + availability info
Slide 7: cta       — Call to action with branded button
```

### Voice Rules (non-negotiable):
- Direct, action-biased, honest, peer-level
- Numbers over vagueness
- **No banned words:** game-changer, disruptive, hustle, empower, unlock, journey, leverage, ecosystem, world-class, comprehensive, curated, innovative, groundbreaking, transformative, passionate, excited to share
- No hedging: "might", "could potentially", "some say"

### Character Budgets (tight — readability at small sizes):
- Hook headline: ≤ 35 characters
- Point headline: ≤ 40 characters
- Body text: **1 sentence maximum per slide, ≤ 90 characters** — if a sentence needs more than 90 chars to make sense, split the idea across two slides or cut it
- Supporting bullet / card description: ≤ 50 characters
- CTA subtext: ≤ 80 characters

**The density rule:** A slide should pass the "squint test" — squint until the text blurs. You should still see clear visual hierarchy (one big thing, one small thing). If all text blurs into the same visual weight, the hierarchy is wrong.

---

## PHASE 3 — Generate HTML Slides

Write 7 HTML files to `$TEMP_DIR/slide-{01..07}.html`.

Every file must be **100% self-contained** — inline all CSS, include Google Fonts link.

### SHARED DESIGN SYSTEM — CREAM & ACCENT COLOR ROTATION

This is a premium, high-contrast, editorial design system featuring massive typography, cream backgrounds, and a single accent color for emphasis.

**COLOR PALETTE ROTATION:**
Instead of hardcoding a single brand color, you must **randomly select ONE color** from the curated premium palette below, OR use the featured product's official primary brand color (if it looks good on a cream background).

**Curated Premium Palette:**
- `Claude Salmon`: `#D9785B`
- `OpenAI Mint`: `#10A37F`
- `Linear Purple`: `#5E6AD2`
- `Figma Azure`: `#00C4CC`
- `Vercel Blue`: `#0070F3`
- `Notion Red`: `#E16259`
- `Anthropic Peach`: `#D4A574`

Select the color and use it as `{{BRAND_COLOR}}` in all CSS blocks below.

**Color palette (hardcoded background/text):**
```css
  background-color: #F8F7F3; /* cream background */
  color: #111111; /* nearly black text */
```

**Google Fonts (include in every slide):**
```html
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800;900&family=Instrument+Serif:ital@1&display=swap" rel="stylesheet"/>
```

**Base layout/typography rules:**
1. **Typography Size:** The numbers (`90%`, `24/7`, `3s`) are HUGE (`160-200px`), with tight letter-spacing (`-8px`). Headlines are `65-85px`, tight letter-spacing (`-2px` to `-3px`). 
2. **Serif Italic Emphasis:** One or two key words in the headline must be wrapped in `<em>...</em>`, which styles it in the `Instrument Serif` italic font, colored in `{{BRAND_COLOR}}`.
3. **Pill Badges:** Slide numbers are housed in `44px` solid `{{BRAND_COLOR}}` circles in the top right.

---

### TEMPLATE 1 — Hook Slide (slide-01.html)

**Layout:** Top header, huge central stat and headline, bottom left square image.

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=1080"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800;900&family=Instrument+Serif:ital@1&display=swap" rel="stylesheet"/>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { width: 1080px; height: 1080px; overflow: hidden; background-color: #F8F7F3; color: #111111; font-family: 'Plus Jakarta Sans', sans-serif; position: relative; }
  
  .header { position: absolute; top: 60px; left: 70px; right: 70px; display: flex; justify-content: space-between; align-items: center; z-index: 10; }
  .header-left { display: flex; align-items: center; gap: 12px; font-size: 14px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: #111111; }
  .star-icon { width: 24px; height: 24px; }
  .header-right { display: flex; align-items: center; gap: 15px; }
  .fw-text { font-family: 'Instrument Serif', serif; font-style: italic; font-size: 26px; color: #999999; }
  .slide-badge { width: 44px; height: 44px; background-color: {{BRAND_COLOR}}; border-radius: 50%; display: flex; justify-content: center; align-items: center; color: white; font-weight: 800; font-size: 16px; }

  .content { position: absolute; top: 260px; left: 70px; right: 70px; z-index: 5; }
  .headline { font-size: 85px; font-weight: 900; letter-spacing: -3px; line-height: 1.05; }
  .headline em { font-family: 'Instrument Serif', serif; font-style: italic; color: {{BRAND_COLOR}}; font-weight: 400; letter-spacing: 0; padding-left: 5px; }

  .bottom-area { position: absolute; bottom: 70px; left: 70px; right: 70px; display: flex; justify-content: space-between; align-items: center; z-index: 5; }
  .s1-bottom { display: flex; gap: 40px; align-items: center; }
  .s1-image { width: 340px; height: 340px; object-fit: cover; border-radius: 24px; box-shadow: 0 20px 40px rgba(0,0,0,0.1); }
  .bottom-text { font-size: 28px; font-weight: 500; color: #333333; line-height: 1.4; max-width: 480px; }
  .swipe { font-size: 14px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: #111111; }
</style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <svg class="star-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 0L13.5 10.5L24 12L13.5 13.5L12 24L10.5 13.5L0 12L10.5 10.5L12 0Z" fill="{{BRAND_COLOR}}"/><path d="M4.5 4.5L10.5 10.5M19.5 19.5L13.5 13.5M19.5 4.5L13.5 10.5M4.5 19.5L10.5 13.5" stroke="{{BRAND_COLOR}}" stroke-width="2"/></svg>
      {{HEADER_LABEL}}
    </div>
    <div class="header-right">
      <div class="fw-text">founders wing / 2026</div>
      <div class="slide-badge">01</div>
    </div>
  </div>
  <div class="content">
    <div class="headline">{{HOOK_PART_1}}</div>
    <div class="headline" style="margin-top: -10px;">{{HOOK_PART_2}} <em>{{HOOK_EMPHASIS}}.</em></div>
  </div>
  <div class="bottom-area">
    <div class="s1-bottom">
      <img src="assets/hero-ui.png" class="s1-image" onerror="this.src='assets/interface.png'"/>
      <div class="bottom-text">{{SUBTITLE}}</div>
    </div>
    <div class="swipe">SWIPE &rarr;</div>
  </div>
</body>
</html>
```

---

### TEMPLATE 2 & 4 — Top Image Fade (slide-02.html, slide-04.html)

**Layout:** Large blurred/faded image at the top half. Bottom half holds an eyebrow, headline, and subhead. 

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=1080"/>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800;900&family=Instrument+Serif:ital@1&display=swap" rel="stylesheet"/>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { width: 1080px; height: 1080px; overflow: hidden; background-color: #F8F7F3; color: #111111; font-family: 'Plus Jakarta Sans', sans-serif; position: relative; }
  
  .top-image-container { position: absolute; top: 0; left: 0; right: 0; height: 320px; z-index: 1; }
  .top-image { width: 100%; height: 100%; object-fit: cover; object-position: center 20%; filter: brightness(0.95); }
  .image-fade { position: absolute; bottom: 0; left: 0; right: 0; height: 100px; background: linear-gradient(to bottom, transparent, #F8F7F3); }

  .pill-header { position: absolute; top: 60px; left: 70px; right: 70px; display: flex; justify-content: space-between; align-items: center; z-index: 10; }
  .pill-left { display: flex; align-items: center; gap: 12px; background: rgba(0,0,0,0.65); padding: 12px 24px; border-radius: 40px; color: white; font-size: 14px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; }
  .pill-badge { width: 44px; height: 44px; background-color: rgba(0,0,0,0.65); border-radius: 50%; display: flex; justify-content: center; align-items: center; color: white; font-weight: 800; font-size: 16px; }

  .content { position: absolute; top: 380px; left: 70px; right: 70px; z-index: 5; }
  .eyebrow { font-size: 18px; font-weight: 800; color: {{BRAND_COLOR}}; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 20px; }
  .headline.medium { font-size: 65px; font-weight: 900; letter-spacing: -2px; line-height: 1.05; }
  .headline.medium em { font-family: 'Instrument Serif', serif; font-style: italic; color: {{BRAND_COLOR}}; font-weight: 400; padding-left: 5px; }
  .subhead { font-size: 32px; font-weight: 700; color: #555555; margin-top: 25px; line-height: 1.3; }

  .bottom-area { position: absolute; bottom: 70px; left: 70px; right: 70px; display: flex; justify-content: space-between; align-items: flex-end; z-index: 5; }
  .bottom-text { font-size: 26px; font-weight: 500; color: #333333; line-height: 1.4; max-width: 750px; }
  .swipe { font-size: 14px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: #111111; }
</style>
</head>
<body>
  <div class="top-image-container">
    <!-- Replace interface.png with hero-ui.png for slide 4 -->
    <img src="assets/interface.png" class="top-image" onerror="this.style.display='none'"/>
    <div class="image-fade"></div>
  </div>
  <div class="pill-header">
    <div class="pill-left">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 0L13.5 10.5L24 12L13.5 13.5L12 24L10.5 13.5L0 12L10.5 10.5L12 0Z" fill="{{BRAND_COLOR}}"/><path d="M4.5 4.5L10.5 10.5M19.5 19.5L13.5 13.5M19.5 4.5L13.5 10.5M4.5 19.5L10.5 13.5" stroke="{{BRAND_COLOR}}" stroke-width="2"/></svg>
      {{PILL_LABEL}}
    </div>
    <div class="pill-badge">{{SLIDE_NUM}}</div>
  </div>
  <div class="content">
    <div class="eyebrow">{{EYEBROW}}</div>
    <div class="headline medium">{{HEADLINE_PART_1}}</div>
    <div class="headline medium">{{HEADLINE_PART_2}} <em>{{HEADLINE_EMPHASIS}}.</em></div>
    <div class="subhead">{{SUBHEAD}}</div>
  </div>
  <div class="bottom-area">
    <div class="bottom-text">{{BODY_TEXT}}</div>
    <div class="swipe">SWIPE &rarr;</div>
  </div>
</body>
</html>
```

---

### TEMPLATE 3 & 5 — Data Circle (slide-03.html, slide-05.html)

**Layout:** No image. Standard header. Left side features a huge number (`24/7` or `3s`). Right side of the number sits a thick brand-colored circle with mini context text inside.

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=1080"/>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800;900&family=Instrument+Serif:ital@1&display=swap" rel="stylesheet"/>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { width: 1080px; height: 1080px; overflow: hidden; background-color: #F8F7F3; color: #111111; font-family: 'Plus Jakarta Sans', sans-serif; position: relative; }
  
  .header { position: absolute; top: 60px; left: 70px; right: 70px; display: flex; justify-content: space-between; align-items: center; z-index: 10; }
  .header-left { display: flex; align-items: center; gap: 12px; font-size: 14px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: #111111; }
  .header-right { display: flex; align-items: center; gap: 15px; }
  .fw-text { font-family: 'Instrument Serif', serif; font-style: italic; font-size: 26px; color: #999999; }
  .slide-badge { width: 44px; height: 44px; background-color: {{BRAND_COLOR}}; border-radius: 50%; display: flex; justify-content: center; align-items: center; color: white; font-weight: 800; font-size: 16px; }

  .content { position: absolute; top: 300px; left: 70px; right: 70px; z-index: 5; }
  .huge-number { font-size: 200px; font-weight: 900; letter-spacing: -8px; line-height: 0.9; margin-bottom: 10px; display: inline-block; }
  
  .badge-container { display: inline-flex; align-items: center; justify-content: center; vertical-align: top; margin-left: 20px; margin-top: 15px; }
  .thick-circle { width: 150px; height: 150px; border: 12px solid {{BRAND_COLOR}}; border-radius: 50%; display: flex; flex-direction: column; justify-content: center; align-items: center; }
  .circle-text { font-size: 24px; font-weight: 900; line-height: 1; }
  .circle-sub { font-family: 'Instrument Serif', serif; font-style: italic; font-size: 22px; color: #888; margin-top: 4px; }
  
  .headline.medium { font-size: 65px; font-weight: 900; letter-spacing: -2px; line-height: 1.05; }
  .headline.medium em { font-family: 'Instrument Serif', serif; font-style: italic; color: {{BRAND_COLOR}}; font-weight: 400; padding-left: 5px; }

  .bottom-area { position: absolute; bottom: 70px; left: 70px; right: 70px; display: flex; justify-content: space-between; align-items: flex-end; z-index: 5; }
  .bottom-text { font-size: 26px; font-weight: 500; color: #333333; line-height: 1.4; max-width: 750px; }
  .swipe { font-size: 14px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: #111111; }
</style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 0L13.5 10.5L24 12L13.5 13.5L12 24L10.5 13.5L0 12L10.5 10.5L12 0Z" fill="{{BRAND_COLOR}}"/><path d="M4.5 4.5L10.5 10.5M19.5 19.5L13.5 13.5M19.5 4.5L13.5 10.5M4.5 19.5L10.5 13.5" stroke="{{BRAND_COLOR}}" stroke-width="2"/></svg>
      {{HEADER_LABEL}}
    </div>
    <div class="header-right">
      <div class="fw-text">founders wing / 2026</div>
      <div class="slide-badge">{{SLIDE_NUM}}</div>
    </div>
  </div>
  <div class="content">
    <div>
      <div class="huge-number">{{HUGE_STAT}}</div>
      <div class="badge-container">
        <div class="thick-circle">
          <div class="circle-text">{{CIRCLE_WORD_1}}</div>
          <div class="circle-sub">{{CIRCLE_WORD_2}}</div>
        </div>
      </div>
    </div>
    <div class="headline medium" style="margin-top: 20px;">{{HEADLINE_PART_1}}</div>
    <div class="headline medium">{{HEADLINE_PART_2}} <em>{{HEADLINE_EMPHASIS}}.</em></div>
  </div>
  <div class="bottom-area">
    <div class="bottom-text">{{BODY_TEXT}}</div>
    <div class="swipe">SWIPE &rarr;</div>
  </div>
</body>
</html>
```

---

### TEMPLATE 6 — Results (slide-06.html)

**Layout:** Two column. Left is huge number + headline. Right is a square product screenshot.

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=1080"/>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800;900&family=Instrument+Serif:ital@1&display=swap" rel="stylesheet"/>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { width: 1080px; height: 1080px; overflow: hidden; background-color: #F8F7F3; color: #111111; font-family: 'Plus Jakarta Sans', sans-serif; position: relative; }
  
  .header { position: absolute; top: 60px; left: 70px; right: 70px; display: flex; justify-content: space-between; align-items: center; z-index: 10; }
  .header-left { display: flex; align-items: center; gap: 12px; font-size: 14px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: #111111; }
  .header-right { display: flex; align-items: center; gap: 15px; }
  .fw-text { font-family: 'Instrument Serif', serif; font-style: italic; font-size: 26px; color: #999999; }
  .slide-badge { width: 44px; height: 44px; background-color: {{BRAND_COLOR}}; border-radius: 50%; display: flex; justify-content: center; align-items: center; color: white; font-weight: 800; font-size: 16px; }

  .content { position: absolute; top: 220px; left: 70px; right: 70px; z-index: 5; }
  .s6-container { display: flex; justify-content: space-between; align-items: center; margin-top: 50px; }
  .s6-left { flex: 1; padding-right: 40px; }
  
  .huge-number { font-size: 160px; font-weight: 900; letter-spacing: -6px; line-height: 0.9; margin-bottom: 10px; }
  .headline.medium { font-size: 55px; font-weight: 900; letter-spacing: -1.5px; line-height: 1.1; }
  .headline.medium em { font-family: 'Instrument Serif', serif; font-style: italic; color: {{BRAND_COLOR}}; font-weight: 400; padding-left: 5px; }
  .subhead { font-size: 26px; font-weight: 700; color: #555555; margin-top: 15px; }

  .s6-image { width: 420px; height: 420px; object-fit: cover; border-radius: 32px; box-shadow: 0 20px 40px rgba(0,0,0,0.15); }
  
  .bottom-area { position: absolute; bottom: 70px; left: 70px; right: 70px; display: flex; justify-content: space-between; align-items: flex-end; z-index: 5; }
  .bottom-text { font-size: 26px; font-weight: 500; color: #333333; line-height: 1.4; max-width: 750px; }
  .swipe { font-size: 14px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: #111111; }
</style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 0L13.5 10.5L24 12L13.5 13.5L12 24L10.5 13.5L0 12L10.5 10.5L12 0Z" fill="{{BRAND_COLOR}}"/><path d="M4.5 4.5L10.5 10.5M19.5 19.5L13.5 13.5M19.5 4.5L13.5 10.5M4.5 19.5L10.5 13.5" stroke="{{BRAND_COLOR}}" stroke-width="2"/></svg>
      {{HEADER_LABEL}}
    </div>
    <div class="header-right">
      <div class="fw-text">founders wing / 2026</div>
      <div class="slide-badge">06</div>
    </div>
  </div>
  <div class="content">
    <div class="s6-container">
      <div class="s6-left">
        <div class="huge-number">{{HUGE_STAT}}</div>
        <div class="headline medium">{{HEADLINE_PART_1}}</div>
        <div class="headline medium">{{HEADLINE_PART_2}} <em>{{HEADLINE_EMPHASIS}}.</em></div>
        <div class="subhead">{{SUBHEAD}}</div>
      </div>
      <img src="assets/hero-ui.png" class="s6-image" onerror="this.src='assets/interface.png'"/>
    </div>
  </div>
  <div class="bottom-area">
    <div class="bottom-text">{{BODY_TEXT}}</div>
    <div class="swipe">SWIPE &rarr;</div>
  </div>
</body>
</html>
```

---

### TEMPLATE 7 — The Lesson / CTA (slide-07.html)

**Layout:** No image. Large text center, a short divider line, and a black pill button at the bottom.

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=1080"/>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800;900&family=Instrument+Serif:ital@1&display=swap" rel="stylesheet"/>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { width: 1080px; height: 1080px; overflow: hidden; background-color: #F8F7F3; color: #111111; font-family: 'Plus Jakarta Sans', sans-serif; position: relative; }
  
  .header { position: absolute; top: 60px; left: 70px; right: 70px; display: flex; justify-content: space-between; align-items: center; z-index: 10; }
  .header-left { display: flex; align-items: center; gap: 12px; font-size: 14px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: #111111; }
  .header-right { display: flex; align-items: center; gap: 15px; }
  .fw-text { font-family: 'Instrument Serif', serif; font-style: italic; font-size: 26px; color: #999999; }
  .slide-badge { width: 44px; height: 44px; background-color: {{BRAND_COLOR}}; border-radius: 50%; display: flex; justify-content: center; align-items: center; color: white; font-weight: 800; font-size: 16px; }

  .content { position: absolute; top: 280px; left: 70px; right: 70px; z-index: 5; }
  .headline { font-size: 85px; font-weight: 900; letter-spacing: -3px; line-height: 1.05; }
  .headline em { font-family: 'Instrument Serif', serif; font-style: italic; color: {{BRAND_COLOR}}; font-weight: 400; padding-left: 5px; }
  
  .s7-line { width: 60px; height: 4px; background-color: {{BRAND_COLOR}}; margin: 40px 0; }
  .subhead { font-size: 32px; font-weight: 600; color: #555555; max-width: 900px; line-height: 1.4; }

  .bottom-area { position: absolute; bottom: 80px; left: 70px; right: 70px; display: flex; justify-content: space-between; align-items: flex-end; z-index: 5; }
  .s7-pill { background-color: #111111; color: white; padding: 20px 40px; border-radius: 50px; font-size: 20px; font-weight: 800; display: inline-block; letter-spacing: -0.5px; }
  .s7-pill em { font-family: 'Instrument Serif', serif; font-style: italic; color: {{BRAND_COLOR}}; font-weight: 400; margin-left: 5px; font-size: 24px; }
</style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 0L13.5 10.5L24 12L13.5 13.5L12 24L10.5 13.5L0 12L10.5 10.5L12 0Z" fill="{{BRAND_COLOR}}"/><path d="M4.5 4.5L10.5 10.5M19.5 19.5L13.5 13.5M19.5 4.5L13.5 10.5M4.5 19.5L10.5 13.5" stroke="{{BRAND_COLOR}}" stroke-width="2"/></svg>
      THE LESSON
    </div>
    <div class="header-right">
      <div class="fw-text">founders wing / 2026</div>
      <div class="slide-badge">07</div>
    </div>
  </div>
  <div class="content">
    <div class="headline">{{HEADLINE_PART_1}}</div>
    <div class="headline">{{HEADLINE_PART_2}} <em>{{HEADLINE_EMPHASIS}}.</em></div>
    <div class="s7-line"></div>
    <div class="subhead">{{SUBHEAD}}</div>
  </div>
  <div class="bottom-area">
    <div class="s7-pill">follow founders wing for daily <em>frameworks.</em></div>
  </div>
</body>
</html>
```


## PHASE 4 — Render PNGs

```bash
cd "$CAROUSEL_DIR" && $NODE_CMD render.js "$DATE" "carousel-branded" 2>&1
```

Expected output: `Found 7 slide(s). Launching headless browser… ✓ slide-01.png … Done.`

**If render fails with "Cannot find module 'puppeteer'":**
```bash
cd "$CAROUSEL_DIR" && npm install
```
Then retry.

**If render fails for another reason:** Report the error and stop.

---

## PHASE 5 — Export PDF (from PNGs — NEVER from HTML)

⚠️ **The PDF must always be generated FROM the rendered PNGs, never directly from HTML.** Re-rendering HTML for the PDF produces broken output (wrong fonts, missing images, tiny file sizes). The PNGs are the source of truth.

```bash
cd "$CAROUSEL_DIR" && $NODE_CMD render-pdf.js "$DATE" "carousel-branded" 2>&1
```

This runs `render-pdf.js` which:
1. Reads the slide PNGs already produced by Phase 4 (`slide-01.png` through `slide-07.png`)
2. Combines them into a single multi-page PDF
3. Tries ImageMagick first (fastest), falls back to Puppeteer with base64-inlined PNGs

Expected output: `Found 7 slide PNG(s) … ✓ PDF created via ImageMagick (1100+ KB) … Done.`

**Verify the PDF is valid:** The file size should be >100 KB. If it's under 10 KB, the PDF is broken — re-run this phase.

**If render-pdf.js fails:** You can run the ImageMagick command manually as a fallback:
```bash
magick "$OUTPUT_DIR/slide-01.png" "$OUTPUT_DIR/slide-02.png" "$OUTPUT_DIR/slide-03.png" \
  "$OUTPUT_DIR/slide-04.png" "$OUTPUT_DIR/slide-05.png" "$OUTPUT_DIR/slide-06.png" \
  "$OUTPUT_DIR/slide-07.png" "$OUTPUT_DIR/${PRODUCT_NAME// /-}-carousel.pdf"
```

If `magick` is not found: `brew install imagemagick`, then retry.

---

## PHASE 6 — Verify & Report

### 6A: Preview All Slides
Open each rendered PNG to verify:
- [ ] All 7 slides rendered without blank/broken areas
- [ ] Product screenshots are visible and properly cropped
- [ ] Brand colors are present and consistent across all slides
- [ ] Company logo/mark appears on at least 3 slides
- [ ] Text is readable and within character budgets
- [ ] Grain overlay is visible on every slide

### 6B: Print Final Report
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Founders Wing — Branded Carousel — YYYY-MM-DD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Product:     [PRODUCT_NAME]
Company:     [COMPANY_NAME]
Source:      [SOURCE_URL]
Brand:       [BRAND_PRIMARY] / [BRAND_SECONDARY]

Slides:      7 (1080×1080 PNG)
PDF:         output/YYYY-MM-DD/carousel-branded/[filename].pdf

Official assets used:
  ✓/✗ Product UI screenshot
  ✓/✗ Company logo mark
  ✓/✗ Partner testimonials
  ✓/✗ Brand color palette
  ✓/✗ Feature list from official page

Ready to upload to LinkedIn.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## BRAND COLOR REFERENCE (Common AI Companies)

Use these as starting points. Always verify against the live website.

| Company | Primary | Secondary | Light |
|---------|---------|-----------|-------|
| Anthropic | #D4A574 (peach) | #C4836A (terracotta) | #F5F0EB (cream) |
| OpenAI | #10A37F (green) | #1A7F64 (dark green) | #F7F7F8 (light gray) |
| Google | #4285F4 (blue) | #EA4335 (red) | #F8F9FA (near-white) |
| Meta | #0668E1 (blue) | #1877F2 (fb blue) | #F0F2F5 (light) |
| Microsoft | #00A4EF (blue) | #7FBA00 (green) | #F3F2F1 (light) |
| Perplexity | #20808D (teal) | #1B6B75 (dark teal) | #F7FAFA (mint) |
| Midjourney | #000000 (black) | #FFFFFF (white) | #F5F5F5 (light) |
| Canva | #00C4CB (teal) | #7D2AE8 (purple) | #F0FFFE (light teal) |
| Adobe | #FF0000 (red) | #2C2C2C (dark gray) | #FAFAFA (light) |
| Stability AI | #7C3AED (purple) | #A855F7 (light purple) | #FAF5FF (lavender) |
| Nvidia | #76B900 (green) | #1A1A1A (black) | #F5F5F5 (light) |

---

## ERROR HANDLING

- **Browser screenshot fails:** Fall back to ImageGeneration tool to create a product mockup
- **No testimonials found:** Replace slide 5 with an "Export Options" or "Integration Partners" grid
- **render.js fails:** Check `puppeteer` is installed, retry once
- **magick not found:** Install with `brew install imagemagick`
- **Font overflow:** Hook headline ≤35 chars, point headline ≤45 chars — trim before writing
- **Node not in PATH:** Use `PATH="/usr/local/bin:$PATH"` prefix or find node via `find ~ -name "node" -type f`

---

## DESIGN PRINCIPLES (non-negotiable)

1. **Brand blending, not brand takeover.** The carousel is a Founders Wing product with the guest brand's DNA woven in — not a reskin of the guest brand's website.
2. **Official assets only.** Never generate fake logos. Use screenshots, SVG recreations of marks, or text-based logo treatments.
3. **Cream-first.** All slides use #F8F7F3 as the base cream. Brand colors appear as accents: star icons, badges, serif italics, and divider lines.
4. **Huge Typography.** Text is the primary design element. Headlines should be massive with tight tracking (-2px to -3px).
5. **Source attribution.** Every slide with official content must cite the source URL in the bottom-left label.
6. **The honest slide is mandatory.** Slide 6 always includes one genuine limitation. This builds trust and differentiates from hype content.
