// Question Grid — grid view controller
// Owns the 9 squares once Generate has been pressed: rendering,
// shutters, answer/hint/choices/explanation panels (one open at a time
// per square, hint/answer/explain replace the question entirely,
// choices split top/bottom), student assignment and reveal, and
// refresh - all operating on data already fetched, so it keeps working
// through a connection drop.

const Grid = (() => {
  let el = {};
  let config = null;
  let squares = [];          // 9 entries: { question, levelTarget } | null
  let squareStates = [];     // per-square UI state, parallel to squares
  let studentQueue = null;   // round-robin queue for initial assignment
  let globalRevealed = false;
  let cachedBasePool = null;

  // Pastel palette: background + a darker shade of the same hue for
  // text, so each square reads clearly without needing a separate
  // contrast check per colour.
  const PALETTE = [
    { bg: '#FCE4E4', text: '#8B3A3A' },
    { bg: '#FDF0D5', text: '#8A6A1E' },
    { bg: '#FBF3C8', text: '#8A7A1E' },
    { bg: '#E3F3E3', text: '#2E6B2E' },
    { bg: '#E1F0F5', text: '#235C73' },
    { bg: '#E9E3F5', text: '#4B3B7A' },
    { bg: '#F5E3EF', text: '#7A3B63' },
    { bg: '#F0E9DD', text: '#6B5A3E' }
  ];

  // ---------------- Math markup ----------------
  // Plain-text question data can embed a small, unambiguous markup for
  // the handful of maths constructs that turn up in GCSE/A-level "do
  // now" questions. Deliberately not relying on Unicode fraction/
  // superscript glyphs - font support is patchy and they render too
  // small on a projector - so each construct is rendered as real HTML/
  // CSS instead, which scales cleanly with the existing autosize logic.
  //
  //   {num/den}        ->  stacked fraction (num/den can be anything,
  //                         e.g. {3/4} or {(3x+2)/(x-2)}; a leading
  //                         whole number like 1{3/4} makes a mixed
  //                         number for free, since it's just adjacent
  //                         text)
  //   base^exp          ->  superscript; use base^{expr} for anything
  //                         longer than one character, e.g. 5^2 or
  //                         (x+1)^{2}
  //   sqrt{expr}         ->  square root with an overline spanning expr
  //   cbrt{expr}         ->  cube root with an overline spanning expr
  //
  // Constructs don't nest inside each other's braces (no fraction
  // inside a root, etc.) - rare enough at this level to leave out
  // rather than write a recursive parser for it.

  function renderMath(rawText) {
    let text = escapeHtml(rawText == null ? '' : String(rawText));

    // Roots first, since they also consume a {...} span.
    text = text.replace(/sqrt\{([^{}]+)\}/g, (m, inner) =>
      `<span class="radical"><span class="radical__sym">√</span><span class="radical__body">${inner}</span></span>`);
    text = text.replace(/cbrt\{([^{}]+)\}/g, (m, inner) =>
      `<span class="radical radical--cube"><span class="radical__sym">∛</span><span class="radical__body">${inner}</span></span>`);

    // Any {...} left with a slash inside is a fraction.
    text = text.replace(/\{([^{}]+)\}/g, (m, inner) => {
      const slashIndex = inner.indexOf('/');
      if (slashIndex === -1) return m; // no slash - leave the braces as literal text
      const num = inner.slice(0, slashIndex);
      const den = inner.slice(slashIndex + 1);
      return `<span class="frac"><span class="frac__num">${num}</span><span class="frac__den">${den}</span></span>`;
    });

    // Exponents last, so ^{...} doesn't collide with fraction braces.
    text = text.replace(/\^(\{[^{}]+\}|-?[A-Za-z0-9])/g, (m, exp) =>
      `<sup>${exp.startsWith('{') ? exp.slice(1, -1) : exp}</sup>`);

    return text;
  }

  function init() {
    el.container = document.getElementById('gridContainer');
    el.container.addEventListener('click', onGridClick);
  }



  function generate(cfg) {
    config = cfg;
    cachedBasePool = null;
    const result = SelectionEngine.generate(config);
    squares = result.squares;
    buildStatesAndRender();
  }

  function generateFromSaved(cfg, orderList) {
    config = cfg;
    cachedBasePool = null;

    squares = orderList.map(orderVal => {
      if (orderVal === null || orderVal === undefined) return null;
      const found = config.questions.find(q => String(q.orderAdded) === String(orderVal));
      return found ? { question: found, levelTarget: found.level } : null;
    });

    buildStatesAndRender();
  }

  /**
   * Returns { bank, order } describing the current 9-box layout, ready
   * to hand to SaveQuiz.save(). order[i] is the question's orderAdded
   * value, or null for a blank box.
   */
  function getSaveData() {
    if (!config) return null;
    return {
      bank: config.bank,
      order: squares.map(s => s ? s.question.orderAdded : null)
    };
  }

  function buildStatesAndRender() {
    const hasStudents = config.students.length > 0;
    studentQueue = hasStudents ? StudentPicker.createQueue(config.students) : null;

    squareStates = squares.map(square => {
      if (!square) return null;
      return {
        activePanel: null,
        choiceOrder: null,
        choiceResolved: false,
        studentName: hasStudents ? StudentPicker.next(studentQueue) : null,
        studentRevealed: false,
        shuttered: true,
        color: PALETTE[Math.floor(Math.random() * PALETTE.length)]
      };
    });

    globalRevealed = false;
    render();
  }

  function render() {
    el.container.innerHTML = '';
    squares.forEach((square, i) => {
      el.container.appendChild(renderSquare(square, squareStates[i], i));
    });
    requestAnimationFrame(autosizeAll);
  }

  // ---------------- Rendering ----------------

  function renderSquare(square, state, index) {
    const wrap = document.createElement('div');
    wrap.className = 'square';
    wrap.dataset.index = String(index);

    if (!square) {
      wrap.classList.add('square--blank');
      return wrap;
    }

    wrap.style.background = state.color.bg;
    wrap.style.setProperty('--square-text', state.color.text);

    const q = square.question;
    const hasChoices = q.wrong1 && q.wrong2;
    const hasHint = !!q.hint;
    const hasExplain = !!q.workedAnswer;
    const hasStudents = config.students.length > 0;
    const isSplit = state.activePanel === 'choices';

    wrap.innerHTML = `
      <div class="square__content ${isSplit ? 'square__content--split' : ''}">
        <div class="square__question" ${state.activePanel && !isSplit ? 'hidden' : ''}>${renderMath(q.question)}</div>
        ${state.activePanel ? renderPanel(q, state) : ''}
      </div>
      <div class="square__footer">
        <div class="square__icons">
          <button class="icon" data-action="answer" title="Show answer" aria-pressed="${state.activePanel === 'answer'}">✓</button>
          ${hasChoices ? `<button class="icon" data-action="choices" title="Show answer choices" aria-pressed="${state.activePanel === 'choices'}">☰</button>` : ''}
          ${hasHint ? `<button class="icon" data-action="hint" title="Show hint" aria-pressed="${state.activePanel === 'hint'}">?</button>` : ''}
          ${hasExplain ? `<button class="icon" data-action="explain" title="Show explanation" aria-pressed="${state.activePanel === 'explain'}">i</button>` : ''}
          <button class="icon" data-action="refresh" title="Choose a different question">↻</button>
        </div>
        ${hasStudents ? renderStudentChip(state) : ''}
      </div>
      ${state.shuttered ? '<div class="square__shutter" data-shutter="true"></div>' : ''}
    `;

    return wrap;
  }

  function renderPanel(q, state) {
    if (state.activePanel === 'choices') {
      if (!state.choiceOrder) {
        state.choiceOrder = shuffle([
          { text: q.answer, correct: true },
          { text: q.wrong1, correct: false },
          { text: q.wrong2, correct: false }
        ]);
        state.choiceStatuses = state.choiceOrder.map(() => 'active');
        state.choiceResolved = false;
        state.correctWasClicked = false;
      }

      const buttonsHtml = state.choiceOrder.map((c, i) => {
        const status = state.choiceStatuses[i];

        let cls = 'choice-btn';
        let mark = '';
        let disabled = state.choiceResolved;

        if (status === 'wrong-shown' || status === 'fading' || status === 'removed') {
          cls += ' choice-btn--wrong';
          mark = ' ✕';
          disabled = true;
        }
        // 'removed' looks identical to 'fading' (fully faded) - it just
        // never leaves the DOM, so its flex slot keeps the gap instead
        // of the other buttons expanding to fill the space.
        if (status === 'fading' || status === 'removed') cls += ' choice-btn--fading';

        if (c.correct && state.choiceResolved) {
          cls += ' choice-btn--correct';
          mark = state.correctWasClicked ? ' ✓' : '';
        }

        return `<button class="${cls}" data-choice-index="${i}" ${disabled ? 'disabled' : ''}><span class="choice-btn__label">${renderMath(c.text)}${mark}</span></button>`;
      }).join('');

      return `<div class="choices">${buttonsHtml}</div>`;
    }

    if (state.activePanel === 'answer') {
      // Same visual language as the revealed-correct choice button
      // (green box, centered, bold) - just delivered as a single box
      // rather than picked from three, since there's nothing to choose.
      // The box itself shrink-wraps to the answer text (answer-box-wrap
      // centers it within the full panel area) rather than stretching
      // the border edge-to-edge regardless of how short the answer is.
      return `<div class="square__panel-full answer-box-wrap"><div class="answer-box">${renderMath(q.answer)}</div></div>`;
    }

    let text = '';
    if (state.activePanel === 'hint') text = q.hint;
    if (state.activePanel === 'explain') text = q.workedAnswer;
    return `<div class="square__panel-full"><div class="panel-text">${renderMath(text)}</div></div>`;
  }

  function renderStudentChip(state) {
    const revealed = state.studentRevealed;
    return `
      <div class="square__studentchip ${revealed ? 'square__studentchip--revealed' : ''}">
        <span class="student-name">${revealed ? escapeHtml(state.studentName || '') : ''}</span>
        <button class="student-icon" data-action="student" title="${revealed ? 'Pick a different student' : 'Reveal student'}">${revealed ? '↻' : '👤'}</button>
      </div>
    `;
  }

  // ---------------- Interaction ----------------

  function onGridClick(e) {
    const squareEl = e.target.closest('.square');
    if (!squareEl) return;
    const index = Number(squareEl.dataset.index);
    const square = squares[index];
    if (!square) return;
    const state = squareStates[index];

    // A shutter intercepts every click while present - nothing beneath
    // it is reachable until it's removed (one-way, no re-covering).
    const shutter = e.target.closest('.square__shutter');
    if (shutter) {
      state.shuttered = false;
      rerenderSquare(index);
      return;
    }

    const panelBtn = e.target.closest('.icon[data-action]');
    if (panelBtn) {
      const action = panelBtn.dataset.action;
      if (action === 'refresh') {
        handleRefreshQuestion(index);
      } else {
        state.activePanel = (state.activePanel === action) ? null : action;
        rerenderSquare(index);
      }
      return;
    }

    const studentBtn = e.target.closest('.student-icon');
    if (studentBtn) {
      handleStudentIconClick(index);
      return;
    }

    const choiceBtn = e.target.closest('.choice-btn[data-choice-index]');
    if (choiceBtn) {
      handleChoiceClick(index, Number(choiceBtn.dataset.choiceIndex));
      return;
    }
  }

  function handleChoiceClick(squareIndex, choiceIndex) {
    const state = squareStates[squareIndex];
    if (!state || state.choiceResolved) return;
    if (state.choiceStatuses[choiceIndex] !== 'active') return;

    const chosen = state.choiceOrder[choiceIndex];

    if (chosen.correct) {
      resolveWithCorrectClicked(state, squareIndex);
      return;
    }

    // Wrong answer clicked.
    state.wrongClickedIndices = state.wrongClickedIndices || [];
    if (!state.wrongClickedIndices.includes(choiceIndex)) {
      state.wrongClickedIndices.push(choiceIndex);
    }
    state.choiceStatuses[choiceIndex] = 'wrong-shown';
    Sound.playIncorrect();

    if (state.wrongClickedIndices.length >= 2) {
      // Second distinct wrong option: auto-reveal the correct answer
      // (green, no tick - it wasn't chosen), freeze everything, no
      // further fading or removal from here on. The first wrong option
      // is left exactly as it already was (mid-fade, fully removed, or
      // still shown if the second click came in fast) - it must never
      // pop back into view. In the steady-state case that leaves just
      // two items visible: the correct answer and this last wrong pick.
      state.choiceResolved = true;
      state.correctWasClicked = false;
      rerenderSquare(squareIndex);
      return;
    }

    // First wrong click: show it, then fade + leave a gap after a
    // couple of seconds. The other two stay live for another attempt.
    // This timeline runs to completion even if a second wrong click
    // resolves the square in the meantime (checked below via
    // state.choiceStatuses, not state.choiceResolved) - a fast double
    // wrong-click shouldn't rob the first pick of its fade-out.
    rerenderSquare(squareIndex);
    setTimeout(() => {
      if (squareStates[squareIndex] !== state) return;
      if (state.choiceStatuses[choiceIndex] !== 'wrong-shown') return;
      state.choiceStatuses[choiceIndex] = 'fading';
      rerenderSquare(squareIndex);

      setTimeout(() => {
        if (squareStates[squareIndex] !== state) return;
        if (state.choiceStatuses[choiceIndex] !== 'fading') return;
        state.choiceStatuses[choiceIndex] = 'removed';
        rerenderSquare(squareIndex);
      }, 1000);
    }, 2000);
  }

  function resolveWithCorrectClicked(state, squareIndex) {
    state.choiceResolved = true;
    state.correctWasClicked = true;
    Sound.playCorrect();

    // Both wrong options show red/cross immediately (un-fading either
    // if one was already mid-fade from an earlier wrong click).
    state.choiceStatuses = state.choiceOrder.map((c, i) => (c.correct ? state.choiceStatuses[i] : 'wrong-shown'));
    rerenderSquare(squareIndex);

    // After a pause, both wrongs fade together and leave a gap - the
    // correct answer stays green+ticked permanently, no rearranging.
    setTimeout(() => {
      if (squareStates[squareIndex] !== state) return;
      state.choiceStatuses = state.choiceOrder.map((c, i) => (c.correct ? state.choiceStatuses[i] : 'fading'));
      rerenderSquare(squareIndex);

      setTimeout(() => {
        if (squareStates[squareIndex] !== state) return;
        state.choiceStatuses = state.choiceOrder.map((c, i) => (c.correct ? state.choiceStatuses[i] : 'removed'));
        rerenderSquare(squareIndex);
      }, 1000);
    }, 2000);
  }

  function handleRefreshQuestion(index) {
    const currentlyDisplayed = new Set(
      squares
        .filter((s, i) => s && i !== index)
        .map(s => s.question)
    );
    const levelTarget = squares[index].levelTarget;
    const replacement = SelectionEngine.refreshSlot(
      getBasePoolForRefresh(),
      levelTarget,
      config.method,
      currentlyDisplayed
    );

    if (!replacement) {
      flashNoAlternative(index);
      return;
    }

    squares[index] = { question: replacement, levelTarget };
    squareStates[index] = {
      activePanel: null,
      choiceOrder: null,
      choiceResolved: false,
      studentName: squareStates[index].studentName,
      studentRevealed: squareStates[index].studentRevealed,
      shuttered: false, // a square already interacted with (refreshed) stays unshuttered
      color: squareStates[index].color
    };
    rerenderSquare(index);
  }

  function getBasePoolForRefresh() {
    if (cachedBasePool) return cachedBasePool;
    cachedBasePool = (config.topics && config.topics.length)
      ? config.questions.filter(q => config.topics.includes(q.topic))
      : config.questions.slice();
    return cachedBasePool;
  }

  function handleStudentIconClick(index) {
    const state = squareStates[index];
    if (!state.studentRevealed) {
      state.studentRevealed = true;
    } else {
      const shownElsewhere = new Set(
        squareStates
          .filter((s, i) => s && s.studentRevealed && i !== index)
          .map(s => s.studentName)
      );
      shownElsewhere.add(state.studentName);
      const replacement = StudentPicker.randomExcluding(config.students, shownElsewhere);
      if (replacement) state.studentName = replacement;
    }
    rerenderSquare(index);
  }

  function toggleGlobalStudents() {
    if (config.students.length === 0) return;
    globalRevealed = !globalRevealed;
    squareStates.forEach(state => {
      if (state) state.studentRevealed = globalRevealed;
    });
    render();
  }

  function hideAllShutters() {
    squareStates.forEach(state => {
      if (state) state.shuttered = true;
    });
    render();
  }

  function revealAllShutters() {
    squareStates.forEach(state => {
      if (state) state.shuttered = false;
    });
    render();
  }

  function flashNoAlternative(index) {
    const squareEl = el.container.querySelector(`.square[data-index="${index}"]`);
    if (!squareEl) return;
    squareEl.classList.add('square--noalt');
    setTimeout(() => squareEl.classList.remove('square--noalt'), 400);
  }

  function rerenderSquare(index) {
    const oldEl = el.container.querySelector(`.square[data-index="${index}"]`);
    const newEl = renderSquare(squares[index], squareStates[index], index);
    oldEl.replaceWith(newEl);
    autosizeSquare(newEl);
  }

  // ---------------- Text autosizing ----------------
  // Applies to question text, full-replace panel text (hint/answer/
  // explain), and choice button labels - anything whose container size
  // is fixed and must never scroll. Re-run on fullscreen toggle too,
  // since the boxes' pixel dimensions change.

  function autosizeAll() {
    el.container.querySelectorAll('.square').forEach(autosizeSquare);
  }

  function autosizeSquare(squareEl) {
    if (!squareEl) return;
    const question = squareEl.querySelector('.square__question:not([hidden])');
    if (question) autosizeElement(question, 1.3, 0.7);

    const panelText = squareEl.querySelector('.panel-text');
    if (panelText) autosizeElement(panelText, 1.15, 0.65);

    const answerBox = squareEl.querySelector('.answer-box');
    if (answerBox) autosizeElement(answerBox, 1.15, 0.65);

    squareEl.querySelectorAll('.choice-btn__label').forEach(label => {
      autosizeElement(label, 0.95, 0.6);
    });
  }

  function autosizeElement(el, maxRem, minRem) {
    const container = el.parentElement;
    let size = maxRem;
    el.style.fontSize = size + 'rem';
    let guard = 0;
    while (
      (el.scrollHeight > container.clientHeight || el.scrollWidth > container.clientWidth) &&
      size > minRem &&
      guard < 40
    ) {
      size -= 0.03;
      el.style.fontSize = size + 'rem';
      guard++;
    }
  }

  // ---------------- Utilities ----------------

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str == null ? '' : String(str);
    return d.innerHTML;
  }

  return { init, generate, generateFromSaved, getSaveData, toggleGlobalStudents, hideAllShutters, revealAllShutters, autosizeAll };
})();
