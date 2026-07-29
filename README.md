# Question Grid

## Getting this onto GitHub Pages (all via the browser, no downloads needed)

1. On github.com, create a new **public** repository (e.g. `question-grid`).
2. On the repo page, use **Add file → Upload files**, and drag in:
   - `index.html`
   - the `css` folder (with `styles.css` inside)
   - the `js` folder (with all the `.js` files inside)
   - If GitHub flattens folders on upload, create files individually instead via **Add file → Create new file** and type the path (e.g. `css/styles.css`) into the filename box — GitHub creates the folder automatically.
3. Commit the files.
4. Go to **Settings → Pages**.
5. Source: **Deploy from a branch**, Branch: `main`, folder: `/ (root)` → **Save**.
6. GitHub gives you a URL, usually `https://<yourusername>.github.io/question-grid/` — allow a minute or two the first time.

## Current status

**Both the setup page and the 16-square grid are built and wired together.**

Setup page:
- Loads live question banks from the Apps Script backend
- Multi-select topic checklist (only shown if "Choose by topic" is ticked)
- Question level dropdown (full mix / progressive / single level), auto-disabled if the bank lacks enough level-tagged questions
- Pasted student list, deduped
- Timer preset (minutes/seconds)
- Generate hands everything off to the grid

Grid view:
- 16 squares, filled from the fetched bank only (no further network calls - survives a dropped connection)
- Never duplicates a question across the grid; blank squares appear only if the pool genuinely runs short
- "Level 1-4 progressive" mode puts level 1 on the top row through level 4 on the bottom row; if a row+topic combo runs short, it fills the rest of that row from any level in the same topic
- Per-square icons: ✓ answer, ☰ answer choices, ? hint, i explanation - each only appears if that data exists for the question; only one panel open at a time
- Answer choices: click one, correct highlights green, both wrong ones show red with a strike-through, with a short correct/incorrect tone
- ↻ refresh picks a different question for that square only, never duplicating what's showing elsewhere
- Student banner (only shown if a class list was pasted): first reveal uses a fair round-robin so everyone's used once before anyone repeats; the icon becomes a refresh after reveal for a genuinely random re-pick (never clashing with names currently shown elsewhere)
- Header: back to setup, global student show/hide-all, timer (draggable, adjustable panel), fullscreen
- Question text auto-shrinks to fit its square

## File overview

```
index.html               Setup view + grid view + timer widget markup
css/styles.css            All styling
js/config.js               Apps Script URL + tunable thresholds
js/dataService.js          Talks to the Apps Script backend
js/selectionEngine.js      Question picking: recency methods, level/topic rules, duplicate-free refresh
js/studentPicker.js        Fair round-robin (Generate) + random-excluding (refresh)
js/audio.js                 Synthesized correct/incorrect/timer tones
js/timer.js                 Draggable, adjustable countdown widget
js/grid.js                  Renders and manages the 16 squares
js/setup.js                 Setup page controller
js/app.js                   View switching + grid header controls
```

## Worth testing once it's live

- A bank with genuinely fewer than 16 eligible questions (confirms blank squares, no crash)
- "Level 1-4 progressive" on a bank with only a little level data (confirms the fallback fills rows sensibly)
- Ticking two topics together
- A question missing a hint or worked answer (confirms that icon simply doesn't appear)
- Refreshing the same square repeatedly near the end of a small pool (confirms it stops changing gracefully rather than erroring, once no alternative remains)
- Fullscreen and the draggable timer on the actual device/browser you'll use in class
