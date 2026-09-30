---
name: Synthex Studio
description: Research typeset and pinned onto a quiet modular board; proof blue marks only what AI drafted or what you selected.
colors:
  field: "#FAFAF8"
  column-band: "#F5F5F1"
  paper: "#FFFFFF"
  ink: "#111214"
  ink-hover: "#2A2C30"
  muted: "#3D4046"
  faint: "#6B6F76"
  source-grey: "#A7AAAF"
  hairline: "#E3E3DE"
  rule-strong: "#D9D9D4"
  proof: "#1F3DFF"
  proof-text: "#2E44CC"
  proof-tint: "#EEF1FF"
typography:
  display:
    fontFamily: "Schibsted Grotesk, Helvetica Neue, Arial, sans-serif"
    fontSize: "clamp(40px, 5vw, 60px)"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.035em"
  question:
    fontFamily: "Schibsted Grotesk, Helvetica Neue, Arial, sans-serif"
    fontSize: "22px"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  idea:
    fontFamily: "Schibsted Grotesk, Helvetica Neue, Arial, sans-serif"
    fontSize: "17px"
    fontWeight: 750
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  source:
    fontFamily: "Schibsted Grotesk, Helvetica Neue, Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1.25
  lede:
    fontFamily: "Schibsted Grotesk, Helvetica Neue, Arial, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.5
  body:
    fontFamily: "Schibsted Grotesk, Helvetica Neue, Arial, sans-serif"
    fontSize: "13.5px"
    fontWeight: 400
    lineHeight: 1.5
  button:
    fontFamily: "Schibsted Grotesk, Helvetica Neue, Arial, sans-serif"
    fontSize: "13.5px"
    fontWeight: 600
  meta:
    fontFamily: "Schibsted Grotesk, Helvetica Neue, Arial, sans-serif"
    fontSize: "11.5px"
    fontWeight: 600
    fontFeature: "\"tnum\" 1"
rounded:
  corner: "2px"
  pin: "50%"
spacing:
  gutter: "40px"
  column: "280px"
  module: "320px"
  note-pad: "22px 18px 16px"
  control: "44px"
components:
  pinned-note:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.idea}"
    rounded: "{rounded.corner}"
    padding: "{spacing.note-pad}"
    width: "{spacing.column}"
  pinned-note-draft:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.proof}"
    rounded: "{rounded.corner}"
    padding: "{spacing.note-pad}"
  pin:
    backgroundColor: "{colors.ink}"
    rounded: "{rounded.pin}"
    size: "20px"
  pin-draft:
    backgroundColor: "{colors.proof}"
    rounded: "{rounded.pin}"
    size: "20px"
  button-ink:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.corner}"
    padding: "0 18px"
    height: "{spacing.control}"
  button-ink-hover:
    backgroundColor: "{colors.ink-hover}"
  button-line:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.corner}"
    padding: "0 12px"
    height: "40px"
  button-text:
    textColor: "{colors.muted}"
    typography: "{typography.button}"
    padding: "0 12px"
    height: "40px"
  composer:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.corner}"
  draft-bar:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.proof}"
    rounded: "{rounded.corner}"
    padding: "8px 8px 8px 18px"
  relation-legend:
    backgroundColor: "{colors.field}"
    textColor: "{colors.muted}"
    rounded: "{rounded.corner}"
    padding: "8px 12px"
---

# Design System: Synthex Studio

## Overview

**Creative North Star: "The Typeset Grid"**

Your thinking gets typeset and pinned, not doodled. Every idea is a sheet of white paper pinned by a round disc onto a quiet board ruled into 280px columns with 40px gutters. Hierarchy comes from type size and the weight of the rule across each note's top edge, never from coloured boxes. The board is near-colourless: ink, three greys, one hairline. The only chromatic voice is proof blue, and it has exactly two meanings, "AI drafted this" and "you selected this".

The world refuses the pastel sticky-note whiteboard and the glowing neural graph. It is calm, precise and dense enough for real research: one typeface (Schibsted Grotesk) carries everything from the 60px empty-map question to the 11.5px tabular meta line. Physicality is small and exact: a stable fraction-of-a-degree hang, a flat pin whose cast shadow alone says "pinned", and a pin that pops out before a note falls off the board.

AI never writes to the map directly, and the visual system encodes that. Drafts arrive as a separate proof-blue layer with dashed hairlines, and they only turn ink when kept.

**Key Characteristics:**
- Paper notes on squared notebook paper: 32px squares in light notebook blue (`rgba(84,150,212,.26)`), panned and zoomed with the map. The blue is softer and cooler than proof blue so it never reads as a draft.
- One typeface, one hairline, 2px corners everywhere.
- Rule weight encodes node type: question 4px, idea/note 2px, source 1px, hypothesis dotted.
- Proof blue is reserved for drafts and selection.
- Relations speak in line grammar (solid / dashed / dotted), always labelled, with a legend.

## Colors

A monochrome ink-on-paper palette with a single printer's-proof blue.

### Primary
- **Proof Blue** (`proof`): the AI-draft layer (top rule, pin, title, meta, draft edges, draft arrowheads, draft bar border and copy), selection (2px outline offset 5px, composer target square, minimap highlight), focus rings, text selection and the starter-prompt hover. Nothing else.
- **Proof Ink** (`proof-text`): the slightly deeper blue used for a draft note's summary so body copy stays legible at 13.5px.
- **Proof Tint** (`proof-tint`): declared in the root tokens as the wash partner to proof blue; not yet applied by any shipped surface. Use it only for a draft or selection wash.

### Neutral
- **Field** (`field`): the board and the empty-map ground; also the line button's fill.
- **Column Band** (`column-band`): the 280px column stripes across the field; the 40px gutters show the field through. The pair is deliberately close (a barely-there rhythm, not a grid).
- **Paper** (`paper`): every note, the composer, the draft bar.
- **Ink** (`ink`): titles, kept pins, kept top rules, the primary button, the composer border, the 1px rules over starter prompts. **Ink Hover** (`ink-hover`) is its pressed/hover shade.
- **Muted** (`muted`): note summaries, the empty-map lede, relation labels, text buttons, legend copy.
- **Faint** (`faint`): the meta line, placeholders, starter captions, relation strokes and legend swatches; kept ideas in the minimap.
- **Source Grey** (`source-grey`): sources and links in the minimap, one step lighter than kept ideas.
- **Hairline** (`hairline`): the 1px note border and chrome borders. **Rule Strong** (`rule-strong`): line-button and select borders.

### Named Rules
**The Proof Rule.** Proof blue means only "AI drafted this" or "you selected this". If an element is neither, it is ink or grey. Kept notes in the minimap are grey, never blue.

**The No Coloured Boxes Rule.** Notes are always white paper. Type and rule weight carry hierarchy; fills never do.

## Typography

**Display Font:** Schibsted Grotesk (loaded with `next/font`, falling back to Helvetica Neue, Arial)
**Body Font:** Schibsted Grotesk
**Label/Mono Font:** none for UI; `ui-monospace` exists only for code.

**Character:** a single sturdy grotesk set tight and heavy at the top of the scale and plain at the bottom, like a well-set research sheet.

### Hierarchy
- **Display** (800, 40-60px fluid, line-height 1, -0.035em, balanced): the empty-map question "What are you trying to figure out?", flush-left.
- **Lede** (400, 18px, 1.5, max 620px): the line under the display heading.
- **Question title** (800, 22px, 1.15, -0.02em): question notes.
- **Idea title** (750, 17px, 1.25, -0.01em): ideas, notes and the default note.
- **Source title** (700, 15px): sources and links.
- **Composer input** (400, 21px centred textarea / 16px docked input).
- **Body** (400, 13.5-14.5px, 1.5): note summaries at 13.5px, the app body at 13.5-14px, draft-bar copy at 14px.
- **Buttons** (600-700, 13.5-15px): line and text buttons 13.5/600, ink buttons 15/700.
- **Meta** (600, 11.5px, tabular figures): the line under every note's text.

### Named Rules
**The Meta Line Rule.** A note's type and provenance ("Idea · From research", "Source · Draft", "Question · 3 sources") sit on one tabular 11.5px line *below* the text. Never above the title as an eyebrow or kicker.

**The One Face Rule.** Schibsted Grotesk only. Emphasis comes from weight and size, not a second family.

## Layout

The board is an infinite field ruled into a 320px module: a 280px column band and a 40px gutter, scaled with zoom so notes (default width 280px) sit in columns. Notes hang in columns on the board, not in a strict layout grid.

- **Empty map:** a centred block up to 846px wide: display heading, lede, the composer, a composer note, then starter prompts in a two-column grid (24px column gap) on 1px ink rules.
- **Map with ideas:** composer docked bottom-centre (20px from the bottom, `min(720px, 100% - 560px)`, min 420px); draft bar top-centre (76px from the top) when drafts exist; relation legend bottom-right (24px / 28px); minimap bottom-left; tool rail left. When the 380px side drawer opens, composer and draft bar re-centre in the visible board and the legend hides.
- **Toasts** sit above the docked composer (150px), never on it.
- **Fit to view:** zoom capped at 0.85; floor 0.2 on desktop.
- **Phones (≤760px CSS, <600px fit logic):** minimap and legend hidden; the tool rail becomes one horizontal row 88px above the bottom; composer and draft bar go full-width minus 24px and wrap; starter prompts stack. Fit reserves 250px at the top for the draft bar and 170px at the bottom for tools and composer, with a readable minimum zoom of 0.6 (people pan rather than squint).

## Elevation & Depth

Paper on a board. Depth is a single soft, downward-offset cast shadow under each sheet plus the pin's own tiny cast shadow. There are no glows and no stacked layers. Chrome that floats over the board (composer, draft bar, tool dock) uses the same soft drop, tinted blue only for the draft bar.

### Shadow Vocabulary
- **Note at rest** (`0 1px 0 rgba(17,18,20,.04), 0 16px 22px -18px rgba(17,18,20,.42)`): every pinned note.
- **Note lifted** (`0 1px 0 rgba(17,18,20,.05), 0 22px 28px -18px rgba(17,18,20,.5)`): hover and selection.
- **Pin cast** (`0 2px 0 -.5px rgba(17,18,20,.25), 1px 5px 5px -2px rgba(17,18,20,.4)`): the flat pin disc; while a note is grabbed the pin rises 2px and its shadow lengthens.
- **Composer** (`0 18px 40px -18px rgba(17,18,20,.3)`).
- **Draft bar** (`0 14px 30px -20px rgba(31,61,255,.55)`): the only blue shadow.
- **Floating chrome** (`0 10px 24px -18px rgba(17,18,20,.45)`): tool dock and top bar.

### Named Rules
**The Flat Pin Rule.** The pin is a flat disc; its cast shadow alone says "pinned". No gradients, highlights or 3D bevels on pins.

## Shapes

Everything is 2px-cornered: notes, composer, buttons, selects, draft bar, legend, minimap. The only round form is the 20px pin, centred on the note's top edge (11px above it). Notes hang from the pin (`transform-origin: 50% 0`) with a stable per-note tilt between -0.6° and +0.6°, derived from the note id so it never jitters between renders. Borders are 1px hairlines; the ink composer takes 1.5px; the proof draft bar takes 1.5px blue.

## Components

### Pinned Note
The signature component: a white sheet pinned to the board.
- **Shape:** 2px corners, 1px hairline border, ink top rule, padding 22px 18px 16px, 280px default width.
- **Rule weight by type:** question 4px, idea/note 2px, source and link 1px, hypothesis 2px dotted.
- **Pin:** 20px ink disc, top-centre.
- **Content:** title (type-scaled), muted summary, meta line.
- **Hover:** shadow deepens.
- **Selected (unpinned):** no outline. The pin pops up and away (translate 10px -22px, -40°, fades, 260ms) and the sheet lifts 12px and swings -0.8° onto a longer, softer shadow, as if flying free of the board; deselecting reverses it (320ms). Resize handles are 9px proof squares.
- **Grabbed:** scales 1.035, lifts 4px, tilts with the drag; pin rises.
- **Colour:** chosen in the editor (Plain paper, red, orange, green, blue, purple, pink). A coloured note gets a 9% paper tint, its top rule and pin in the colour; titles stay ink. Drafts always stay proof blue. Stored as a hex `node.color`; legacy named colours render as plain.
- **Edit tab:** selecting one note or cluster never opens a panel. An ink "Edit" tab rises from behind the lifted sheet's top edge (260ms, 140ms after the lift); Enter does the same.

### Draft Note (AI draft layer)
- **Style:** dashed hairline sides and bottom, solid proof top rule, proof pin, proof title and meta, proof-ink summary, meta reads "… · Draft". Draft edges and arrowheads render in proof blue.
- **Arrival:** the note lands from 14px above over 420ms (`cubic-bezier(.16,1,.3,1)`); the pin then presses in from 12px above at 1.5x scale over 260ms, starting at 300ms.
- Drafts are read-only until kept.

### Removal (pin detach)
The pin pops up and away (300ms, rotating to -48°), then the note drops 90px and tilts to 11° as it fades (440ms, `cubic-bezier(.5,0,.75,.3)`, 130ms delay). The node is removed from the graph at 580ms. Reduced motion skips both the arrival and the detach and removes immediately.

### Draft Bar
Top-centre, paper with a 1.5px proof border. Proof tabular copy ("2 ideas and 1 source drafted · nothing joins your map until you keep it") and three actions in rising commitment: **Discard** (text button), **Review one by one** (line button, ink border on white), **Keep all** (ink button).

### Composer
- **Centred (empty map):** 1.5px ink border, 2px corners, a 21px textarea, then a row with "Write a note instead" (line button), a Quick/Deep select (44px) and the ink "Build map" button.
- **Docked (map has ideas):** a single 16px input and a 44px square ink send button. With a selection, a context row appears above the input: a proof square and the target "On "…"" in proof, then contextual line buttons **Expand**, **Find sources** and **Challenge it**.
- **Researching:** the status replaces the input, with a blinking 8px proof square (1.1s steps) and tabular copy.

### Buttons
- **Ink** (primary): ink fill, white 15/700 text, 44px tall, 2px corners; hover `ink-hover`; disabled 35% opacity.
- **Line** (secondary): field fill, 1px strong-rule border turning ink on hover, 13.5/600, 40px.
- **Text** (tertiary): no chrome, muted 13.5/600 turning ink on hover.
- **Focus:** 2px proof outline, 2px offset, on every control.

### Starter Prompts
Full-width text rows under a 1px ink rule: 16/700 ink title and 13/500 faint caption. On hover the title turns proof blue.

### Relations
Curved connectors with labels in plain 12/500 muted type on a field-coloured backing (no pills). Line grammar: **solid supports, dashed challenges (8 8), dotted asks**. Kept strokes are grey/ink and drafts are proof. A bottom-right legend shows the three strokes with their names.

### Minimap
190px wide, 2px corners, field ground. Kept ideas are faint grey, sources lighter, and only drafts and selection are proof blue. The viewport lens is an ink stroke over a 6% ink wash.

## Do's and Don'ts

### Do:
- **Do** keep every note white paper with a 1px hairline and an ink top rule, and signal type only through rule weight (4 / 2 / 1px / dotted) and title size (22 / 17 / 15px).
- **Do** reserve proof blue for AI drafts and selection (plus focus rings and text selection).
- **Do** put type and provenance on the 11.5px tabular meta line under the text.
- **Do** keep the hang tilt stable per note and within ±0.6°.
- **Do** label every relation and draw it in the solid / dashed / dotted grammar, with the legend visible on desktop.
- **Do** honour reduced motion: skip draft arrival, pin detach and the status blink.
- **Do** keep 2px corners on every rectangle; the pin is the only circle.

### Don't:
- **Don't** fill notes with colour or use tinted cards for hierarchy.
- **Don't** use proof blue for decoration, brand, links, counts or status that isn't a draft or a selection.
- **Don't** place a type label or kicker above a note title.
- **Don't** give pins gradients, highlights or bevels.
- **Don't** add a second typeface.
- **Don't** let the composer, draft bar or toasts overlap each other; toasts sit above the docked composer.

### Known gaps (shipped, not yet resolved)
- Relation labels render beneath notes, so a label whose edge midpoint falls under a note is hidden.
- Line pattern is stored per edge. Choosing a relation preset now derives the pattern from the label (`strokeForLabel`) unless the pattern was already set by hand, but research-created edges still default to solid.
- Menus and popovers that unmount when closed (views, share, map switcher, dock menus) have no 120ms exit; only the drawer, trash bar and toast animate out.
- SVG/PNG export (`src/lib/canvas-export.ts`) still uses its own coloured palette and one emoji; it is outside this system until that module is restyled.

## Logo

Two overlapping squares in an 18×18 box: an **ink square 12×12 at (0,0)** and a **proof-blue square 10×10 at (8,8)**, read as "a note pinned onto the grid, your thinking plus the AI's draft". The wordmark "Synthex" is Schibsted Grotesk 800, −0.02em, ink.

- `SynthexLogo` renders inline SVG (`size`, `withWordmark` default true); `SynthexMark` is the mark alone for the footer and collapsed states.
- Top bar: 18px mark beside a 17px wordmark, no box around it.
- Icons come from file conventions: `src/app/icon.svg` (transparent, vector, any size) and `src/app/apple-icon.tsx` (180px, `ImageResponse`, field `#FAFAF8` behind the mark).
- The only motion: on hover in a nav or the top bar, the blue square shifts 1px down-right over 160ms (the pin presses).

## Motion grammar

- **Easing:** out `cubic-bezier(.16,1,.3,1)`; in, for things leaving, `cubic-bezier(.5,0,.75,.3)`. No bounce, elastic or overshoot.
- **Durations:** 120ms state changes; 160–200ms popovers, tabs, drawer, dialogs; 300–440ms the note moments. Nothing over 600ms except the one-time landing demo.
- **Authored note moments:** draft arrival (`note-land` 420ms, `pin-in` at +300ms); removal (`pin-pop` 300ms, `note-drop` 440ms after 130ms, node removed at 580ms); the research status blink on the proof square.
- **Keep:** kept drafts get `.is-kept` for 400ms after `saveReview` succeeds. The pin goes proof → ink over 200ms with a 1px press (`pin-press` 160ms); title, summary and meta colour follow over 200ms. Nothing else moves.
- **Popovers and menus:** enter with opacity 0→1 and `translate: 0 -4px → 0`, 160ms (`pop-in`). No scale.
- **Drawer:** `translate: 16px → 0` plus fade, 200ms out-easing; closes in 160ms in-easing.
- **Layout switch:** the document pane slides in from 24px (`doc-in`, 220ms); the map resizes without animation.
- **Selection:** the proof outline appears instantly; the document's highlighted block fades its background in 160ms.
- **Buttons:** hover changes colour only (120ms); `:active` presses `translate: 0 1px`. No hover lift or scale anywhere; notes deepen their shadow only.
- **Toast:** `translate: 0 8px → 0` plus fade, 200ms; leaves in 160ms at the end of its 3.6s life.
- **FAQ chevron:** rotates 180° in 160ms.
- **Removed:** marching dashes and dots on relations (the `animated` field is kept but never rendered), pulse glows, rotating rings, hover lifts, the trash-bin bounce.
- **Reduced motion:** every animation above is off; state changes are instant and removal skips straight to removal.

## More components

### Right drawer (Properties / Ask AI)
White paper, hairline, 2px corners, the float shadow. Underline tabs at 14/600: muted, the active tab ink with a 2px ink underline; the selection count is plain "(2)". Ask AI opens with one meta line, "Answers use only what's on your map", has "Audit my map" as its only tool, and speaks in plain paragraphs: your line 14/600 ink, the answer 14.5 body, references as a meta line ("Cites 3 ideas"). Its compose box reuses the composer (1.5px ink border, 44px ink send button) with the cost as meta text ("1 credit"). Research steps are a numbered list; only the running step carries the proof square.

### Properties form
Labels 12.5/600 muted; inputs and selects 44px, 1px `rule-strong`, 2px corners, 15px text. Type offers Idea, Question, Claim, Hypothesis, Note, Source. Origin and relations sit on one meta line. "Remove from map" is a red (#B42318) text button and plays the pin-detach.

### Tool dock
White paper, float shadow, 44px buttons; the active tool is an ink fill with a white icon. Tooltips are 12.5px on paper with the shortcut in a plain `<kbd>` set as meta. The add and tidy menus are text rows (14/700 name, one meta line). Note-size locking lives in More views.

### Clusters
Open: a hand-drawn pen loop round its notes (two wobbly strokes, 1.6px ink at 70% and 1px at 40%, seeded by the cluster id so it never jitters, starting past the corner and overshooting its end), with no fill so the grid shows through. The title (15/800) and meta sit on a strip of masking tape (`rgba(234,232,223,.95)`, torn ends, -1.4°) across the top-left of the loop; "Fold / Unfold" is a text button at top-right. Selected: the pen line turns proof blue. Folded: a white sheet taped to the board by the same tape, lifting like a note when selected. Both stay resizable. In Properties a cluster takes a colour (ink, red, orange, green, blue, purple, pink: the pen line, a 22% tint of the tape and, when folded, the sheet's top rule) and a line width on a slider (1–6px), stored in `node.color` and `metadata.penWidth` (older S/M/L values still read as 1.2 / 1.8 / 3px). A coloured cluster keeps its colour when selected; its tape gets the proof underline.

### Pen, marker and eraser
Dock tools P (pen), B (marker) and E (eraser) draw on the board only: marks never enter the graph, the document or AI context, and are saved per map in the viewer's browser. While the pen or marker is active, a flyout beside the dock offers a width slider with a live stroke preview (pen 1–10px, marker 6–40px) and six colours. Pen colours are inks (ink, red, green, blue, purple, orange); marker colours are highlighters (yellow, green, pink, orange, blue, grey) drawn at 50% with multiply. These are the user's own marks, so they may use colour; proof blue is deliberately not offered. The last size and colour per tool are remembered. The eraser removes a whole stroke on click or drag. Strokes drawn before colours existed keep their original ink look. "Clear drawings" sits in More views.

### Canvas chrome
Trash bar: white, hairline, "Drop to remove"; over it, ink fill and white text. Connect hint: the draft bar's shape in ink. Marquee: 1px proof border over a 6% proof wash, square corners. Relation options: a views-menu popover of text-row presets plus three segmented controls (line, pattern, arrow); relations are grey, drafts are proof.

### Views
A 960px column on the field with white paper sections. Heading 30/800 plus one tabular meta line; no icon tiles. Tables have hairline rows, 14px text, tabular numbers and a sticky 12.5/700 muted header. Claim status is text with a leading glyph: ● supported (ink), ◐ weakly supported, disputed or contradicted (muted), ○ unverified, open or outdated (faint); the word is always shown. Research runs waiting on the map say "Drafts waiting on the map" in proof.

### Dialogs and popovers
Map switcher: a popover listing maps as rows with a "New map" form (Name, Empty map / Guided example, "Create map"). Review drafts: the query as title, a meta line, each draft under a 2px proof top rule with 44px "Keep" (ink) and "Discard" (text), footer "Keep all" and "Save decisions". Search: a command palette with an 18px input and rows (15/700 title, meta "Idea · 2 sources"). Credits and plans: columns separated by 1px rules, the recommended plan under a 4px ink rule with the ink button, numbers 40/800. Credits in the top bar are a 12.5/600 muted text button.

### Landing page
The same world, louder: a 72px sticky nav on the field; a hero on a 12-column grid (80px margins, 24px gutters, `column-band` stripes) with an 88px/800 headline and one ink CTA; a demo board built from the real note classes that plays once (the question types, three drafts land 120ms apart, "Keep all" presses, pins turn ink) and holds, showing the final state under reduced motion; three numbered steps on rules; alternating feature rows with real interface crops; plan columns on white paper; a `<details>` FAQ; a final composer-shaped link to sign-up. Prices, plan names and credit numbers come from `src/lib/plans.ts`.

### Sign in / sign up
Split layout: the logo and one 60px line on the field, Clerk on white. Clerk is styled only through `appearance` (ink primary and text, white background, 2px radius, the UI font).

### Full-screen editor
Opened from the Edit tab or Enter. The board stays visible behind a 14px blur over a 42% field wash; the editor is white paper (max 1180 × 820, the float shadow) that rises 16px as it fades in. The left half is a piece of the squared board where the note lands and re-pins itself as a live preview of every change; the right half is the Properties form (title, type, colour, text, sources, "Remove from map"). Changes save as you type; "Done", × , Esc or a click on the blur closes it and focus returns to where it was. Tab stays inside the dialog, and while it is open canvas shortcuts are off. On phones it fills the screen with the preview above the form.

### Placement
- **Notes never overlap.** Notes keep at least 8px of board between them (clusters are areas, not obstacles). While a dragged or resized note sits on another, it shows a red "No room here" tab and a red dashed outline; dropping there snaps everything that moved back to where it started (a resize reverts to its old size).
- **New items spawn unpinned.** An item added from the dock or a shortcut appears in the middle of the visible board with no pin, lifted and dashed, under an ink "Drag me to an empty spot" tab. As soon as it sits on free board (straight away if the centre was empty) the pin presses in and it becomes an ordinary note.
- **Cluster corners:** on hover or selection each corner shows a 3px pen bracket (cluster colour, proof when selected and uncoloured) with a 44px grab area; edges are invisible strips you can drag too.
- **Folded clusters** list every member title on its own dotted row (30px each) and grow to fit; the header row (Edit, open, Unfold) sits under the tape.
- **Clusters resize from what you see:** handles start from the loop's on-screen bounds (it is stretched round its notes), so a drag answers at once; a cluster can't shrink smaller than its notes.
