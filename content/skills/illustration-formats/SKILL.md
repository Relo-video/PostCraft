---
name: illustration-formats
description: Five distinct infographic/illustration formats inspired by Mad Over Marketing's editorial style. Picks the right visual format for any dataset and renders a 1080x1080 LinkedIn-ready PNG. Use this for any single-image data visual (not multi-slide carousels).
---

# Illustration format library

Five infographic formats. The routine selects one based on the shape of the data, then renders the HTML and screenshots a 1080x1080 PNG.

> **Content doctrine gate (`content-doctrine.md` wins).** The dataset must be a "this is the shift" stat about AI's impact on work, income, skills, or the future — something an ambitious non-builder feels in their gut. Out: SaaS metrics (churn, CAC, MRR), developer surveys, raw code stats, startup-ops benchmarks. In: how AI is changing jobs, what skills pay now, what work looks like next, where AI is creating money and opportunity. Run the doctrine topic filter on the dataset before building.

## Format selection rules

Apply this decision tree before generating any infographic HTML:

```
1. Is the data a RANKED LIST with 6-10 items (percentages, dollar amounts, counts)?
   YES → RANKED_BARS
   NO  → continue

2. Is the data a PARTS_OF_A_WHOLE breakdown (market share, allocation, distribution)?
   YES → DONUT_BREAKDOWN
   NO  → continue

3. Is the data a CHANGE_OVER_TIME (year-over-year, growth curve, trend)?
   YES → TIMELINE_SHIFT
   NO  → continue

4. Is the data a HEAD_TO_HEAD comparison (A vs B with multiple dimensions)?
   YES → COMPARISON_SPLIT
   NO  → continue

5. Is the data a SINGLE_BIG_STAT with supporting context (one hero number)?
   YES → HERO_NUMBER
   NO  → default to RANKED_BARS
```

## Shared design system

All five formats share the visual language so they read as one brand:

**Palette (default warm cream):**
- Background: `#F5EFE8`
- Accent primary: `#E63946` (coral red)
- Accent secondary: `#1A1A1A` (ink)
- Soft accent: `#C5392E` (deep coral)
- Tertiary: `#E8A33D` (mustard, used sparingly)
- Text body: `#1A1A1A`
- Text muted: `#5A5A5A`

**Alt palette (dark mode, for hot-take data):**
- Background: `#1A1A1A`
- Accent: `#E63946`
- Text body: `#F5EFE8`
- Soft: `#2A2A2A`

**Typography:**
- Sans: Inter (400, 500, 600, 700, 800, 900)
- Serif italic: Instrument Serif (italic 400) for accent words and rank numerals
- Mono: rarely, only for source attribution lines

**Universal elements:**
- Top bar: dot + uppercase kicker (left), italic serif date or brand (right)
- Title: 64-72px, sentence case, italic serif accent word in coral
- Subtitle: 18-22px, soft muted text
- Footer: 1px divider, source attribution left, handle right
- Always include `@yourhandle` in the bottom-right footer
- 1080 x 1080 canvas

**Writing rules:**
- Title is one short sentence with one italic serif emphasis word
- Subtitle is max 2 sentences, conversational, lowercase starts allowed
- No em-dashes anywhere
- Stats are bold sans, never serif
- Source line is plain mono or sans, never bold

---

## Format 1: RANKED_BARS

Use for: ranked lists of 6-10 categories. The example we already built (AI adoption by industry).

**Layout:**
- Title block top (about 220px high)
- 10 rows of horizontal bars filling middle
- Footer with source

**Visual recipe:**
- Italic serif numeral rank (01, 02, etc.) at left
- Category label in bold sans
- Bar with rounded ends, three color tiers (top 3 = coral, middle = soft coral, bottom = ink/dark)
- Value at far right in bold sans
- Bars are proportional to max value (scale max to 100%)

Reference HTML lives at: `templates/ranked-bars.html`

---

## Format 2: DONUT_BREAKDOWN

Use for: parts-of-a-whole breakdowns (market share by company, time allocation, budget split).

**Layout:**
- Title block top
- Donut chart center-left (~500px diameter)
- Legend with percentages and labels right side
- Bottom: one italic serif takeaway sentence
- Footer

**Visual recipe:**
- Donut built with conic-gradient or SVG circles
- 5-7 segments max (combine smaller into "Other")
- Top segment in coral, second in deep coral, third in mustard, others in ink shades
- Center of donut: total or hero number
- Legend rows: color dot + label + bold percentage

Reference HTML: `templates/donut-breakdown.html`

---

## Format 3: TIMELINE_SHIFT

Use for: change over time (2019 vs 2025, growth curve, adoption trend).

**Layout:**
- Title block top
- Two-or-three large bars or columns showing each time point
- Big arrow or "+X%" callout between them
- Bottom: 2-sentence story behind the shift
- Footer

**Visual recipe:**
- Each time point gets a vertical bar with the year as italic serif label on top
- First year in ink/dark, latest year in coral (the "winner" color)
- Italic serif arrow "→" or "+X%" between bars
- Stat callouts at the top of each bar

Reference HTML: `templates/timeline-shift.html`

---

## Format 4: COMPARISON_SPLIT

Use for: A vs B comparisons across multiple dimensions (old way vs new way, brand A vs brand B).

**Layout:**
- Title block top with "vs" centered
- Two-column split, full bleed left and right
- Left column = one option (often shown in ink/dark)
- Right column = other option (often shown in coral)
- 3-4 comparison rows stacked vertically
- Footer

**Visual recipe:**
- Each row has a small label on a center divider, then the value on each side
- Coral side wins by visual weight (bigger number, bolder, etc.)
- Title says "A vs B" with italic serif "vs"

Reference HTML: `templates/comparison-split.html`

---

## Format 5: HERO_NUMBER

Use for: a single huge stat with 3-4 mini-stats supporting it.

**Layout:**
- Top kicker
- Massive number filling center (300px+)
- One-line italic serif sentence below
- 3-4 mini-stat boxes at bottom in a row
- Footer

**Visual recipe:**
- Background can be cream or full-bleed coral
- The big number is the only thing that matters
- Mini-stats are small (40-50px values, 14px labels)
- Each mini-stat sits in a soft-tinted card

Reference HTML: `templates/hero-number.html`

---

## Image sourcing for infographics

Most infographics are typography-only. But formats 3, 4, and 5 can optionally include one small thematic image (an icon or symbolic photo). Pull from:

- Unsplash Source: `https://source.unsplash.com/600x600/?[theme-keyword]`
- Brand favicons: `https://logo.clearbit.com/[brand].com` (for brand comparisons)
- Save to a temp directory and reference via relative path in the HTML

Hard rule: never embed photographs across the full infographic. Mad Over Marketing infographics are clean and editorial, not photo-heavy.

---

## How the scheduled-task uses this

In Step 2 of the daily routine (Research infographic data), the prompt should be amended to:

1. Find the data (existing behavior)
2. Look at the data's shape (ranked / breakdown / over-time / comparison / single-stat)
3. Pick the matching format from this file
4. Build the HTML using that format's template
5. Save to `./linkedin-infographic.html`
6. Screenshot at 1080x1080

The screenshot step in the routine is unchanged. Only the HTML generation logic changes.
