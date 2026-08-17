// Question Grid — setup view controller
// Owns everything on the landing page: loading the two CSVs, the
// three-way selection method (Pearson book / Dr Frost skill numbers /
// saved starter), the student paste-in box, and building the config
// object that Generate hands off to the grid.

const Setup = (() => {

  let currentMethod = 'pearsonBook'; // 'pearsonBook' | 'dfRefs' | 'saved'

  let practiceSet = [];         // full practice set, loaded once
  let pearsonBooks = [];        // full Pearson books map, loaded once
  let books = [];                // unique book names, in sheet order
  let currentBook = null;
  let currentChapters = [];      // chapter names available for currentBook

  let students = [];            // parsed, deduped student names
  let savedQuizzes = [];        // valid (non-expired) saved starters
  let savedGroups = [];         // saved class lists (group1..group10)

  const el = {}; // populated in init() once the DOM exists

  function init() {
    cacheElements();
    bindEvents();
    loadData();
    loadSavedQuizzes();
    loadSavedGroups();
    setupDfRefsLink();
    switchMethod('pearsonBook');
  }

  function cacheElements() {
    el.methodTabs = document.getElementById('methodTabs');

    el.panelPearsonBook = document.getElementById('panelPearsonBook');
    el.panelDfRefs = document.getElementById('panelDfRefs');
    el.panelSaved = document.getElementById('panelSaved');
    el.commonQuizFields = document.getElementById('commonQuizFields');

    el.bookSelect = document.getElementById('bookSelect');
    el.chapterChecklist = document.getElementById('chapterChecklist');
    el.chapterHelp = document.getElementById('chapterHelp');

    el.dfRefsInput = document.getElementById('dfRefsInput');
    el.dfRefsLookupLink = document.getElementById('dfRefsLookupLink');

    el.savedQuizSelect = document.getElementById('savedQuizSelect');
    el.savedQuizHint = document.getElementById('savedQuizHint');

    el.methodSelect = document.getElementById('methodSelect');
    el.levelSelect = document.getElementById('levelSelect');

    el.savedGroupField = document.getElementById('savedGroupField');
    el.savedGroupSelect = document.getElementById('savedGroupSelect');
    el.studentsNormalFields = document.getElementById('studentsNormalFields');
    el.studentsInput = document.getElementById('studentsInput');
    el.addStudentsBtn = document.getElementById('addStudentsBtn');
    el.saveClassListBtn = document.getElementById('saveClassListBtn');
    el.studentsSummary = document.getElementById('studentsSummary');

    el.generateBtn = document.getElementById('generateBtn');
    el.statusMessage = document.getElementById('statusMessage');
  }

  function bindEvents() {
    el.methodTabs.addEventListener('click', onMethodTabClick);

    el.bookSelect.addEventListener('change', onBookChange);
    el.chapterChecklist.addEventListener('change', updateGenerateAvailability);
    el.dfRefsInput.addEventListener('input', updateGenerateAvailability);
    el.savedQuizSelect.addEventListener('change', onSavedQuizChange);
    el.savedGroupSelect.addEventListener('change', onSavedGroupChange);

    el.addStudentsBtn.addEventListener('click', onAddStudents);
    el.saveClassListBtn.addEventListener('click', onSaveClassList);

    el.generateBtn.addEventListener('click', onGenerate);
  }

  function setupDfRefsLink() {
    if (CONFIG.DF_REFS_SHEET_URL) {
      el.dfRefsLookupLink.href = CONFIG.DF_REFS_SHEET_URL;
      el.dfRefsLookupLink.hidden = false;
    } else {
      el.dfRefsLookupLink.hidden = true;
    }
  }

  // ---------------- Method tabs ----------------

  function onMethodTabClick(e) {
    const btn = e.target.closest('.method-tab');
    if (!btn) return;
    switchMethod(btn.dataset.method);
  }

  function switchMethod(method) {
    currentMethod = method;

    Array.from(el.methodTabs.querySelectorAll('.method-tab')).forEach(btn => {
      btn.classList.toggle('method-tab--active', btn.dataset.method === method);
    });

    el.panelPearsonBook.hidden = method !== 'pearsonBook';
    el.panelDfRefs.hidden = method !== 'dfRefs';
    el.panelSaved.hidden = method !== 'saved';
    el.commonQuizFields.hidden = method === 'saved';

    el.generateBtn.textContent = method === 'saved' ? 'Load saved starter' : 'Generate';
    setStatus('');
    updateGenerateAvailability();
  }

  // ---------------- Data loading ----------------

  async function loadData() {
    setStatus('Loading question data…', 'info');
    try {
      const [practice, pearson] = await Promise.all([
        DataService.loadPracticeSet(),
        DataService.loadPearsonBooks()
      ]);
      practiceSet = practice;
      pearsonBooks = pearson;

      books = [];
      pearson.forEach(row => { if (!books.includes(row.book)) books.push(row.book); });

      el.bookSelect.innerHTML = '<option value="" disabled selected>Choose a book…</option>';
      books.forEach(book => {
        const opt = document.createElement('option');
        opt.value = book;
        opt.textContent = book;
        el.bookSelect.appendChild(opt);
      });
      el.bookSelect.disabled = false;

      setStatus('');
    } catch (err) {
      setStatus(`Couldn't load question data: ${err.message}`, 'error');
    }
    updateGenerateAvailability();
  }

  // ---------------- Pearson book flow ----------------

  function onBookChange() {
    currentBook = el.bookSelect.value;
    currentChapters = [];
    pearsonBooks.forEach(row => {
      if (row.book === currentBook && !currentChapters.includes(row.chapter)) {
        currentChapters.push(row.chapter);
      }
    });

    el.chapterChecklist.innerHTML = '';
    if (!currentChapters.length) {
      el.chapterChecklist.innerHTML = '<p class="hint">No chapters found for this book.</p>';
    } else {
      currentChapters.forEach(chapter => {
        const id = 'chapter-' + chapter.replace(/\s+/g, '-').toLowerCase();
        const label = document.createElement('label');
        label.innerHTML = `
          <input type="checkbox" id="${id}" value="${escapeHtml(chapter)}">
          <span>${escapeHtml(chapter)}</span>
        `;
        el.chapterChecklist.appendChild(label);
      });
    }
    el.chapterHelp.hidden = true;
    updateGenerateAvailability();
  }

  function getSelectedChapters() {
    return Array.from(el.chapterChecklist.querySelectorAll('input[type="checkbox"]:checked'))
      .map(cb => cb.value);
  }

  // ---------------- Dr Frost skill numbers flow ----------------

  function parseDfRefsInput() {
    return el.dfRefsInput.value
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .map(Number)
      .filter(n => !isNaN(n));
  }

  // ---------------- Saved starters ----------------

  function loadSavedQuizzes() {
    savedQuizzes = SaveQuiz.listValid();
    el.savedQuizSelect.innerHTML = '<option value="none">None saved yet</option>';
    savedQuizzes.forEach(sq => {
      const opt = document.createElement('option');
      opt.value = String(sq.slot);
      opt.textContent = `quiz${sq.slot} — ${PoolBuilder.describeDescriptor(sq.descriptor)} (${SaveQuiz.relativeTime(sq.savedAt)})`;
      el.savedQuizSelect.appendChild(opt);
    });
  }

  function onSavedQuizChange() {
    const usingSaved = el.savedQuizSelect.value !== 'none';
    el.savedQuizHint.hidden = !usingSaved;
    updateGenerateAvailability();
  }

  function getSelectedSavedQuiz() {
    const val = el.savedQuizSelect.value;
    if (val === 'none') return null;
    return savedQuizzes.find(q => String(q.slot) === val) || null;
  }

  // ---------------- Saved class lists (groups) ----------------

  function loadSavedGroups() {
    savedGroups = SaveClass.listValid();
    if (!savedGroups.length) {
      el.savedGroupField.hidden = true;
      return;
    }

    el.savedGroupSelect.innerHTML = '<option value="none">None (start fresh)</option>';
    savedGroups.forEach(g => {
      const opt = document.createElement('option');
      opt.value = String(g.slot);
      opt.textContent = `group${g.slot} — ${g.students.length} student${g.students.length === 1 ? '' : 's'} (${SaveQuiz.relativeTime(g.savedAt)})`;
      el.savedGroupSelect.appendChild(opt);
    });
    el.savedGroupField.hidden = false;
  }

  function onSavedGroupChange() {
    const val = el.savedGroupSelect.value;
    const usingSaved = val !== 'none';
    el.studentsNormalFields.hidden = usingSaved;

    if (usingSaved) {
      const group = savedGroups.find(g => String(g.slot) === val);
      if (group) {
        students = group.students.slice();
        el.studentsSummary.textContent =
          `${students.length} student${students.length === 1 ? '' : 's'} loaded from group${group.slot} (${SaveQuiz.relativeTime(group.savedAt)}).`;
      }
    } else {
      students = [];
      el.studentsSummary.textContent = 'No students added yet — question squares will show no student banner.';
    }
  }

  // ---------------- Students ----------------

  function parseStudentsFromTextarea() {
    const raw = el.studentsInput.value;
    const parsed = raw
      .split(/[\n,\t]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const seen = new Set();
    return parsed.filter(name => {
      const key = name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function flashSummarySaved() {
    el.studentsSummary.classList.add('hint-box--saved');
    setTimeout(() => el.studentsSummary.classList.remove('hint-box--saved'), 2200);
  }

  function onAddStudents() {
    students = parseStudentsFromTextarea();
    el.studentsSummary.textContent = students.length
      ? `${students.length} student${students.length === 1 ? '' : 's'} added, assigned randomly to questions.`
      : 'No students added yet — question squares will show no student banner.';
    flashSummarySaved();
  }

  function onSaveClassList() {
    const parsed = parseStudentsFromTextarea();
    if (!parsed.length) {
      el.studentsSummary.textContent = 'Paste at least one name before saving a class list.';
      el.studentsSummary.classList.remove('hint-box--saved');
      return;
    }
    students = parsed;
    const slotName = SaveClass.save(students);
    el.studentsSummary.textContent = `${students.length} student${students.length === 1 ? '' : 's'} saved as ${slotName} in local storage.`;
    flashSummarySaved();
    loadSavedGroups();
  }

  // ---------------- Generate availability ----------------

  function updateGenerateAvailability() {
    if (currentMethod === 'pearsonBook') {
      el.generateBtn.disabled = !currentBook || getSelectedChapters().length === 0;
    } else if (currentMethod === 'dfRefs') {
      el.generateBtn.disabled = parseDfRefsInput().length === 0;
    } else {
      el.generateBtn.disabled = !getSelectedSavedQuiz();
    }
  }

  // ---------------- Generate / Load ----------------

  function buildConfig() {
    let pool, source;

    if (currentMethod === 'pearsonBook') {
      const chapters = getSelectedChapters();
      pool = PoolBuilder.fromPearsonBook(practiceSet, pearsonBooks, currentBook, chapters);
      source = { method: 'pearsonBook', book: currentBook, chapters };
    } else {
      const dfRefs = parseDfRefsInput();
      pool = PoolBuilder.fromDfRefs(practiceSet, dfRefs);
      source = { method: 'dfRefs', dfRefs };
    }

    return {
      source,
      questions: pool,
      topics: [],
      method: el.methodSelect.value,
      levelMode: el.levelSelect.value,
      students: students.slice()
    };
  }

  function onGenerate() {
    if (currentMethod === 'saved') {
      const savedQuiz = getSelectedSavedQuiz();
      if (savedQuiz) loadSavedStarter(savedQuiz);
      return;
    }

    const config = buildConfig();

    if (config.questions.length === 0) {
      setStatus("No questions found for that selection — this Dr Frost skill hasn't been written into the practice set yet.", 'error');
      return;
    }

    App.showGrid(config);
  }

  function loadSavedStarter(savedQuiz) {
    const pool = PoolBuilder.fromDescriptor(practiceSet, pearsonBooks, savedQuiz.descriptor);

    if (pool.length === 0) {
      setStatus("Couldn't rebuild this saved starter — none of its questions are in the practice set anymore.", 'error');
      return;
    }

    const config = {
      source: savedQuiz.descriptor,
      questions: pool,
      topics: [],
      method: 'mix',
      levelMode: 'mix',
      students: students.slice()
    };

    App.showGridFromSaved(config, savedQuiz.order);
  }

  function setStatus(message, kind) {
    el.statusMessage.textContent = message;
    el.statusMessage.className = 'status' + (kind ? ` status--${kind}` : '');
    el.statusMessage.hidden = !message;
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  return { init };
})();
