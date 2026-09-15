# Mad Over Marketing inspired carousel format library

Six distinct carousel formats. The carousel engine selects one based on the topic. Every format uses real images. Every format follows the writing rules (no em-dashes, raw human voice, 2 sentences max per slide).

> **Content doctrine gate (`content-doctrine.md` wins).** The carousel topic must be in the lane: a shift, a thesis, or a story about where AI is taking work, income, skills, or the future. Tactical listicles are out ("7 tools for your stack," "build in public," "how to validate an idea"). Future-of-work explainers and big-picture takes are in ("the 5 jobs AI is quietly rewriting," "what work looks like by 2027"). If the chosen format is LISTICLE, the list must be a list of *shifts or consequences*, never a list of tools or how-to steps. Run the doctrine topic filter before designing.

## Format selection rules

Run this decision tree before designing any carousel:

```
1. Does the topic feature a specific brand, product, or company with available imagery?
   YES → BRAND_STORY
   NO  → continue

2. Is the topic "X things about Y" or a numbered list (5 ways, 7 tools, etc.)?
   YES → LISTICLE
   NO  → continue

3. Is the topic primarily data, stats, percentages, or rankings?
   YES → DATA_STORY
   NO  → continue

4. Is this a marketing/business case study (how X brand did Y)?
   YES → HOW_THEY_DID_IT
   NO  → continue

5. Is the topic a contrarian take, hot opinion, or myth-buster?
   YES → HOT_TAKE
   NO  → continue

6. Default → MYSTERY_REVEAL (curiosity hook, story-driven)
```

Mark the chosen format at the top of every Art Direction Brief.

---

## Shared design system (all formats use these)

**Palette options (pick one per carousel based on subject):**
- Warm cream: bg `#F5EFE8`, accent `#E63946`, ink `#1A1A1A`, soft `#FAF7F2`
- Mustard: bg `#F5EFE8`, accent `#E8A33D`, ink `#1A1A1A`, soft `#FFF4E0`  
- Forest: bg `#F0EBE3`, accent `#2D6A4F`, ink `#1A1A1A`, soft `#E8E2D8`
- Navy: bg `#F5EFE8`, accent `#1E3A5F`, ink `#1A1A1A`, soft `#E8EEF4`
- Dark mode: bg `#1A1A1A`, accent `#E63946`, ink `#F5EFE8`, soft `#2A2A2A`

**Typography:**
- Body sans: Inter (400, 500, 600, 700, 800, 900)
- Accent serif italic: Instrument Serif (italic 400) for emotional emphasis
- Numerals: Inter 900 weight, tight letter-spacing, used at 200px+

**Universal slide elements:**
- Top-left: small dot + uppercase label kicker (14px, letter-spaced)
- Top-right: italic serif page number "01" through "07"
- Bottom-right: "SWIPE →" on slides 1-6, brand mark on slide 7
- Real image present on minimum 4 of 7 slides

**Writing rules:**
- Max 2 sentences per text block
- Lowercase starts allowed and encouraged
- Skip occasional periods at line ends
- Never use `—` `–` or `-` as sentence joiners
- Use "and" "but" "so" to start sentences

---

## Format 1: BRAND_STORY

**When to use:** Topic features a specific brand/company with available imagery (e.g., new product launch, company milestone, founder story).

**Image requirements:**
- Slide 1: Real product hero shot OR brand logo on cream background
- Slide 2: Product screenshot or UI capture
- Slide 4: Founder photo or product detail shot
- Slide 6: Product in use OR result graphic
- Always pull from OG image, press kit, or official product page

**Slide structure:**
```
1. Hook with product image. "X just changed how Y works" + product photo right side
2. Setup. What this is, with screenshot/UI image full-bleed top half
3. The key feature/insight. Large italic serif pull-quote, no image
4. How it works. Three short steps with small inline images
5. Real result or proof. Big number + supporting image
6. Honest take. What it does well vs what it does not (split image background)
7. CTA. Brand mark + follow button
```

**Example topics:** Claude Design launch, OpenAI Codex Mobile, any new AI tool

---

## Format 2: DATA_STORY

**When to use:** Topic is stats-driven with no specific brand to feature (e.g., industry adoption rates, solopreneur economy, market size data).

**Image requirements:**
- Slide 1: Symbolic photo or illustration (Unsplash for "lone laptop" / "empty office" / etc.)
- Slide 3: Small chart visualization
- Slide 5: Real photo of the subject (people working, products in use)
- Slide 6: Stat block with color treatment

**Slide structure:**
```
1. Hook. Giant number filling 60% of slide + thematic background photo (darkened) behind
2. The setup. Two sentences. Small inline icon. What this stat actually means
3. Stat 2 with bar/donut chart visualization. 2 sentences explanation
4. Stat 3 as italic serif pull-quote. Background tinted color block
5. The proof. Real photograph + caption. This is happening already
6. The implication. What this means for the reader. Big italic serif text
7. CTA on dark slide with brand mark
```

**Example topics:** Solopreneur economy stats, AI adoption rates, industry rankings

---

## Format 3: LISTICLE

**When to use:** Topic is naturally a numbered list of items (5 ways, 7 tools, 10 mistakes, etc.).

**Image requirements:**
- Slide 1: Hero photo or composite of the items
- Slides 2-6: Each item gets its own small icon, logo, or screenshot
- Slide 7: CTA only

**Slide structure:**
```
1. Hook. "5 [things] every [person] needs to know" + composite/hero image
2. Item 1. Number + name + 2-sentence description + small visual
3. Item 2. Same structure
4. Item 3. Same structure
5. Item 4. Same structure
6. Item 5. Same structure (or "the takeaway" if only 4 items)
7. CTA. Save and follow
```

**Example topics:** 5 AI tools for solo founders, 7 mistakes early founders make

---

## Format 4: HOW_THEY_DID_IT

**When to use:** Marketing case study, breaking down how a specific brand achieved something.

**Image requirements:**
- Slide 1: Bold brand image + result number
- Slide 2: Context image (the "before")
- Slides 3-5: One image per step
- Slide 6: Result image
- Slide 7: Brand logo + takeaway

**Slide structure:**
```
1. Hook. "How [brand] [did the thing]" + striking brand visual
2. The setup. What the brand was facing. Image of the problem context
3. Move 1. What they did first. Image showing it
4. Move 2. Next step. Image showing it
5. Move 3. Final move. Image showing it
6. The result. Big number + image of outcome
7. Takeaway. The lesson for the reader. Brand mark
```

**Example topics:** How Polsia hit $1M ARR, how a brand 10x'd revenue

---

## Format 5: HOT_TAKE

**When to use:** Contrarian opinion, myth-buster, or "X is dead" style post.

**Image requirements:**
- Slide 1: Bold image that frames the topic + provocative text
- Slide 4: Image showing evidence
- Slide 5: Real example image
- Use color contrast aggressively (dark + warm cream alternating)

**Slide structure:**
```
1. The bold claim. "[X] is dead" in massive text + provocative image
2. The conventional wisdom. What everyone says (use quote marks)
3. Why it is wrong. The flip
4. The evidence. Stat or photo as proof
5. Real example. Named person or company
6. What to do instead. The replacement playbook
7. CTA
```

**Example topics:** "Hiring is dead for solo founders", "PMF is the most misused term in startups"

---

## Format 6: MYSTERY_REVEAL

**When to use:** Story-driven posts where the punchline is best held back. Curiosity-first.

**Image requirements:**
- Slide 1: A cropped/zoomed mystery image
- Slide 2: Wider version of the same image
- Slide 3: Full reveal of the image
- Slides 4-6: Story unfolds with supporting visuals
- Always uses one strong hero photograph

**Slide structure:**
```
1. "what do you think this is?" + cropped/zoomed image
2. Pull back the camera. Wider crop + first hint
3. The reveal. Full image + brand or context name
4. The backstory. How this happened
5. The numbers. Result stat
6. The lesson
7. CTA
```

**Example topics:** "This logo earned a brand $200M", "What does this product actually sell?"

---

## Image sourcing strategy (mandatory before any carousel)

> **Sourcing images.** Clearbit's logo API and `source.unsplash.com` are both discontinued. Ask your AI client to source or generate the artwork — directly, or through an MCP server you have connected — and save it into the brief's assets directory. For brand-story carousels, the real site's `og:image` is usually the best first try. **Quality rule: if only junk stock would result, render clean typography-forward slides instead — never ship a bad photo on a brand carousel.**

### Brand-story carousels (a specific product / company / launch)
Pull the real official image from the source. Free and on-brand:
```bash
python3 fetch_carousel_image.py --source-url "$SOURCE_URL" \
  --prompt "product hero for $PRODUCT_NAME" --query "$PRODUCT_NAME" --out "$ASSETS_DIR/hero-ui.png"
```
For the logo mark, `https://unavatar.io/[brand].com` or `https://www.google.com/s2/favicons?domain=[brand].com&sz=256` work (Clearbit does not).

### Thesis / future-of-work carousels (no single source)
Generate on-brand images (best quality), else fall back to stock or typography:
```bash
python3 fetch_carousel_image.py \
  --prompt "editorial flat illustration of <concept>, warm cream bg, indigo-purple accent, no text" \
  --query "<theme keywords>" --out "$ASSETS_DIR/slide-2.jpg"
```
If the cascade prints `NONE` (no AI billing and stock too weak), render that slide **typography-forward**.

### Verify everything
```bash
for f in "$ASSETS_DIR"/*.jpg "$ASSETS_DIR"/*.png; do
  SIZE=$(wc -c < "$f")
  [ "$SIZE" -gt 10000 ] && echo "✓ $f ($SIZE bytes)" || echo "✗ $f too small"
done
```

**Hard rule:** Real product images are mandatory on brand-story carousels. On thesis carousels, on-brand AI images are preferred; **clean typography always beats bad stock.**

---

## How to use this file from the skill

In `SKILL.md` Phase 1.5 (Art Direction Brief), after parsing the topic:

1. Read this file
2. Apply the format selection decision tree
3. Pick palette based on topic mood (data → cream warm, hot take → dark contrast, brand story → match brand colors)
4. Source images per the strategy above before any HTML is written
5. Build slides following the chosen format's structure
6. Mark the format choice and palette in the Art Direction Brief header
