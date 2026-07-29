// Question Grid — grid view controller
// Owns the 16 squares once Generate has been pressed: rendering,
// answer/hint/choices/explanation panels (one open at a time per
// square), student assignment and reveal, and refresh (question and
// student) - all operating on data already fetched, so it keeps
// working through a connection drop.

const Grid = (() => {
  let el = {};
  let config = null;
  let squares = [];          // 16 entries: { question, levelTarget } | null
  let squareStates = [];     // per-square UI state, parallel to squares
  let studentQueue = null;   // round-robin queue for initial assignment
  let globalRevealed = false;

  function init() {
    el.container = document.getElementById('gridContainer');
    el.container.addEventListener('click', onGridClick);
  }

  function generate(cfg) {
    config = cfg;
    const result = SelectionEngine.generate(config);
    squares = result.squares;

    const hasStudents = config.students.length > 0;
    studentQueue = hasStudents ? StudentPicker.createQueue(config.students) : null;

    squareStates = squares.map(square => {
      if (!square) return null;
      return {
        activePanel: null,           // null | 'answer' | 'choices' | 'hint' | 'explain'
        choiceOrder: null,           // shuffled [text, isCorrect] pairs, built when opened
        choiceResolved: false,
        studentName: hasStudents ? StudentPicker.next(studentQueue) : null,
        studentRevealed: false
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
    requestAnimationFrame(autosizeAllQuestions);
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

    const q = square.question;
    const hasChoices = q.wrong1 && q.wrong2;
    const hasHint = !!q.hint;
    const hasExplain = !!q.workedAnswer;
    const hasStudents = config.students.length > 0;

    if (state.activePanel) wrap.classList.add('square--panelOpen');

    wrap.innerHTML = `
      <div class="square__content">
        <div class="square__question">${escapeHtml(q.question)}</div>
        <div class="square__panel" ${state.activePanel ? '' : 'hidden'}>${renderPanel(q, state)}</div>
      </div>
      ${hasStudents ? renderStudentBar(state) : ''}
      <div class="square__icons">
        <button class="icon" data-action="answer" title="Show answer" aria-pressed="${state.activePanel === 'answer'}">✓</button>
        ${hasChoices ? `<button class="icon" data-action="choices" title="Show answer choices" aria-pressed="${state.activePanel === 'choices'}">☰</button>` : ''}
        ${hasHint ? `<button class="icon" data-action="hint" title="Show hint" aria-pressed="${state.activePanel === 'hint'}">?</button>` : ''}
        ${hasExplain ? `<button class="icon" data-action="explain" title="Show explanation" aria-pressed="${state.activePanel === 'explain'}">i</button>` : ''}
        <button class="icon" data-action="refresh" title="Choose a different question">↻</button>
      </div>
    `;

    return wrap;
  }

  function renderPanel(q, state) {
    if (state.activePanel === 'answer') {
      return `<div class="panel-text panel-text--answer">${escapeHtml(q.answer)}</div>`;
    }
    if (state.activePanel === 'hint') {
      return `<div class="panel-text">${escapeHtml(q.hint)}</div>`;
    }
    if (state.activePanel === 'explain') {
      return `<div class="panel-text">${escapeHtml(q.workedAnswer)}</div>`;
    }
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
        return `<button class="${cls}" data-choice-index="${i}" ${state.choiceResolved ? 'disabled' : ''}>${escapeHtml(c.text)}${mark}</button>`;
      }).join('')}</div>`;
    }
    return '';
  }

  function renderStudentBar(state) {
    const revealed = state.studentRevealed;
    return `
      <div class="square__studentbar ${revealed ? 'square__studentbar--revealed' : ''}">
        <button class="student-icon" data-action="student" title="${revealed ? 'Pick a different student' : 'Reveal student'}">${revealed ? '↻' : '👤'}</button>
        <span class="student-name">${revealed ? escapeHtml(state.studentName || '') : ''}</span>
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
      studentRevealed: squareStates[index].studentRevealed
    };
    rerenderSquare(index);
  }

  // basePool isn't stored on generate() return by reference in this
  // module yet - recomputed here to keep refresh self-contained.
  let cachedBasePool = null;
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
    autosizeQuestion(newEl);
  }

  // ---------------- Text autosizing ----------------

  function autosizeAllQuestions() {
    el.container.querySelectorAll('.square__question').forEach(q => autosizeQuestion(q.closest('.square')));
  }

  function autosizeQuestion(squareEl) {
    const q = squareEl && squareEl.querySelector('.square__question');
    if (!q) return;
    let size = 1.3;
    q.style.fontSize = size + 'rem';
    while (q.scrollHeight > q.clientHeight && size > 0.75) {
      size -= 0.05;
      q.style.fontSize = size + 'rem';
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

  return { init, generate, toggleGlobalStudents };
})();
