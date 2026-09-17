# Writing rules

Portable hygiene that applies whatever you write about: voice, structure, hook rotation,
and the words and constructions that make writing read as machine-generated.

These are **defaults, not law.** Your `content/content-doctrine.md` outranks them, and
anything learned in `content/preferences.md` outranks both. Delete or change anything
here that does not suit your voice.

---

## Apply to every post

### Voice and perspective

Use the person, tone and language set in `content/content-doctrine.md`. This file does not choose a voice.

Whatever the voice, never invent a first-person fact (revenue, timelines, customer counts, personal stories). Leave a `[[marker]]` for the user to fill.

### Human realism (human-like imperfections)

To ensure the posts sound authentically human and not AI-generated:
- Mimic casual human writing habits: occasionally miss a comma or omit a full stop at the end of a line.
- Incorporate natural, conversational slang or informal transitions where appropriate (e.g., "made cash faster than" instead of "generated revenue quicker than").
- Keep the style informal and conversational, avoiding overly polished, clinical sentence structures.

Good examples of the voice (note: AI-impact lane, broad audience — not founder tactics):
- "Most people using AI at work right now are making the same quiet mistake."
- "A thread on r/Futurology this week laid out something most people are not ready to hear about their jobs."
- "The people who got ahead with AI this year all did one specific thing differently."

### Post structure (all text posts must follow this in order)

1. **Hook** — 1 or 2 lines. Makes the reader stop scrolling. Grounded in a specific number, surprising finding, or pattern.
2. **Pain point** — Name the specific frustration. Concrete and recognisable, not abstract. Use the language real people use when complaining about this problem.
3. **Actionable value** — What to do about it. Specific enough to apply within 24 hours.
4. **Dream picture** — What changes once someone actually applies this. Make it tangible: more leads, less time wasted, a specific outcome.
5. **Engagement question** — One pointed question that is easy to answer in one sentence. Never "What do you think?" — make it specific.
6. **CTA** — One only. Follow, save, or repost. Never stack more than one.

### Hook styles — rotate each time the skill runs

Pick the most fitting style for the topic:

- **Curiosity**: "The way most solo entrepreneurs approach [topic] is exactly why they stay stuck at [problem]."
- **Contrarian**: "Most people teaching [topic] online have never actually done it themselves."
- **Transformation**: "[Metric] went from [low number] to [high number] in [time period]. Here is what actually moved it."
- **Question**: "What separates the solo entrepreneurs who [succeed] from the ones still stuck at [problem] three years later?"
- **Story**: "A founder posted something on Reddit this week about [topic] that reframes the whole conversation."
- **Listicle**: "Five things nobody mentions before you start [topic]."

### Carousel hook styles — rotate each time the skill runs

The carousel slide 1 hook is the most important element. It must stop the scroll in milliseconds. Use 6 to 8 words max on the cover slide. Maintain a curiosity gap: never give the answer on slide 1.

Read `./carousel-hook-log.json` before picking a hook style. The log tracks which styles have been used recently. Apply these rotation rules:

1. The style used in the **last run** is **banned** this run
2. If any style appears **3+ times in the last 7 entries**, it is also banned this run
3. Pick the most fitting non-banned style for today's topic
4. After generating the carousel, append an entry to `./carousel-hook-log.json`

Pick the most fitting non-banned style for the carousel topic:

- **Bold Claim**: A provocative stat or statement that creates immediate tension. Keep it under 6 words. Example: "The pricing mistake costing you $50k/year."
- **Specific Result**: A concrete before-after transformation with hard numbers. Example: "0 to 40% conversion in 90 days."
- **Mistake Call-Out**: Name the exact mistake the reader is probably making. Example: "5 hiring mistakes killing your startup."
- **Myth Buster**: Challenge an accepted belief head-on. Example: "Why your morning routine is sabotaging your business."
- **Curiosity Gap**: Withhold the punchline to force the swipe. Example: "I lost a $500k deal because of one thing."
- **Number Reveal**: Promise a finite, specific list that delivers clear value. Example: "7 marketing blindspots costing you customers."
- **Before-After**: Show a dramatic contrast between problem and outcome. Example: "From $50k to $500k in 18 months."
- **Checklist Promise**: Signal immediately actionable, saveable content. Example: "The 10-point checklist for high-converting landing pages."
- **Framework Authority**: Position a proprietary structured method. Example: "The 3-step framework that doubled our leads."
- **Relatable Pain**: Agitate a specific pain point the reader feels right now. Example: "Stop doing this on LinkedIn (it kills your reach)."

#### Carousel hook log format

Each entry in `./carousel-hook-log.json` follows this structure:
```json
{
  "date": "2026-05-30",
  "hook_style": "Bold Claim",
  "hook_text": "The pricing mistake costing you $50k/year",
  "carousel_topic": "SaaS pricing strategy",
  "carousel_format": "DATA_STORY"
}
```

Keep last 30 entries. Trim older ones on each write.

### Banned vocabulary — never use any of these words or phrases

delve, underscore, vibrant, tapestry, interplay, intricate, garner, pivotal, showcase, foster, align with, landscape (used abstractly), key (as a vague adjective), leverages, encompasses, facilitates, utilized, commenced, subsequent to, prior to, in order to, stands as, serves as, is a testament to, plays a vital role, plays a significant role, plays a crucial role, enduring legacy, lasting impact, indelible mark, it's important to note, it's worth noting, no discussion would be complete without, moreover, furthermore, in addition, setting the stage for, marking a shift, evolving landscape, reflects broader trends, game-changer, supercharge, real results, real strategy, real conversations

### Banned LinkedIn-specific patterns — never use any of these

- "No X. No Y. Just Z." triple-denial hooks
- "It's not just about X. It's about Y." reframes
- "If you're serious about X, [do this]" closes
- "And here's the kicker"
- "X changed everything"
- "Enter:" followed by a framework name
- "The best part? [short answer]"
- Email sign-off language ("To your success", "To your freedom")

### Banned contrast constructions

- "This isn't about X, it's about Y"
- "Not because of X. But because of Y."
- "Rather than X, do Y" (unless substantially expanded)
- "But rather" anywhere
- "Not just X, but also Y"
- "Not only X, but Y"

### Formatting rules

- No em-dashes anywhere in any post
- Sentence case in all headings and slide labels (not Title Case)
- No bullet lists where flowing prose works better
- Specific numbers over adjectives: "grew 340% in 6 months" not "grew significantly"
- Varied sentence lengths deliberately — mix short punchy sentences with longer ones when the idea needs room
- One idea per paragraph
- Closing line lands on something new, never restates what came before
- No "-ing phrase" analysis tags: "highlighting the importance of", "underscoring its significance"
- No vague attributions like "experts say" or "many believe" without a named source

---
