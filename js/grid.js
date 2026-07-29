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

  function init() {
    el.container = document.getElementById('gridContainer');
    el.container.addEventListener('click', onGridClick);
  }

  function generate(cfg) {
    config = cfg;
    cachedBasePool = null;
    const result = SelectionEngine.generate(config);
    squares = result.squares;

    const hasStudents = config.students.length > 0;
    studentQueue = hasStudents ? StudentPicker.createQueue(config.students) : null;

    squareStates = squares.map(square => {
      if (!square) return null;
      return {
        activePanel: null,           // null | 'answer' | 'choices' | 'hint' | 'explain'
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
        <div class="square__question" ${state.activePanel && !isSplit ? 'hidden' : ''}>${escapeHtml(q.question)}</div>
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
        state.choiceResolved = false;
      }
      return `<div class="choices">${state.choiceOrder.map((c, i) => {
        let cls = 'choice-btn';
        let mark = '';
        if (state.choiceResolved) {
          cls += c.correct ? ' choice-btn--correct' : ' choice-btn--wrong';
          mark = c.correct ? ' ✓' : ' ✕';
        }
        return `<button class="${cls}" data-choice-index="${i}" ${state.choiceResolved ? 'disabled' : ''}><span class="choice-btn__label">${escapeHtml(c.text)}${mark}</span></button>`;
      }).join('')}</div>`;
    }

    let text = '';
    if (state.activePanel === 'answer') text = q.answer;
    if (state.activePanel === 'hint') text = q.hint;
    if (state.activePanel === 'explain') text = q.workedAnswer;
    return `<div class="square__panel-full"><div class="panel-text">${escapeHtml(text)}</div></div>`;
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
    if (choiceBtn && !state.choiceResolved) {
      const chosen = state.choiceOrder[Number(choiceBtn.dataset.choiceIndex)];
      state.choiceResolved = true;
      chosen.correct ? Sound.playCorrect() : Sound.playIncorrect();
      rerenderSquare(index);
      return;
    }
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

  return { init, generate, toggleGlobalStudents, revealAllShutters, autosizeAll };
})();
