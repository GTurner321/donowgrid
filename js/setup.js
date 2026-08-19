// Question Grid — setup view controller
// Owns everything on the landing page: loading the two CSVs, the
// three-way selection method (Pearson book / Dr Frost skill numbers /
// saved starter), the student paste-in box, and building the config
// object that Generate hands off to the grid.

const Setup = (() => {

  let currentMethod = 'pearsonBook'; // 'pearsonBook' | 'dfRefs' | 'saved'

  let practiceSet = [];          // full practice set, loaded once
  let pearsonBooks = [];         // full Pearson books map, loaded once
  let books = [];                 // unique book names, in sheet order
  let currentBook = null;
  let currentChapters = [];       // chapter names available for currentBook
  let currentSubtopicRows = [];   // Pearson-books rows available for the selected chapters

  let students = [];             // parsed, deduped student names
  let savedQuizzes = [];         // valid (non-expired) saved starters
  let savedGroups = [];          // saved class lists (group1..group10)

  const el = {}; // populated in init() once the DOM exists

  function init() {
    cacheElements();
    bindChecklistSelectAll(el.chapterChecklist);
    bindChecklistSelectAll(el.subtopicChecklist);
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
    el.subtopicChecklist = document.getElementById('subtopicChecklist');
    el.subtopicHelp = document.getElementById('subtopicHelp');

    el.dfRefsInput = document.getElementById('dfRefsInput');
    el.dfRefsLookupLink = document.getElementById('dfRefsLookupLink');

    el.savedQuizSelect = document.getElementById('savedQuizSelect');
    el.savedQuizHint = document.getElementById('savedQuizHint');

    el.levelSelect = document.getElementById('levelSelect');
    el.levelCountHint = document.getElementById('levelCountHint');

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
    el.chapterChecklist.addEventListener('change', onChapterChecklistChange);
    el.subtopicChecklist.addEventListener('change', onSelectionChanged);
    el.dfRefsInput.addEventListener('input', onSelectionChanged);
    el.savedQuizSelect.addEventListener('change', onSavedQuizChange);
    el.savedGroupSelect.addEventListener('change', onSavedGroupChange);
    el.levelSelect.addEventListener('change', updateLevelCount);

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
    onSelectionChanged();
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
    onSelectionChanged();
  }

  // ---------------- Reusable checklist-with-select-all ----------------

  /**
   * Renders a checklist of checkboxes into `container`, with a
   * "select all" master row at the top that both drives and reflects
   * the state of every item below it. `items` is an array of
   * { label } - the caller reads back which *indices* ended up
   * checked via readCheckedIndices(container).
   */
  function renderChecklist(container, items, selectAllLabel, defaultChecked) {
    container.innerHTML = '';

    if (!items.length) {
      return;
    }

    const selectAllRow = document.createElement('label');
    selectAllRow.className = 'checklist-select-all';
    selectAllRow.innerHTML = `<input type="checkbox" data-role="select-all"><span>${escapeHtml(selectAllLabel)}</span>`;
    container.appendChild(selectAllRow);

    items.forEach((item, idx) => {
      const label = document.createElement('label');
      label.innerHTML = `
        <input type="checkbox" data-index="${idx}">
        <span>${escapeHtml(item.label)}</span>
      `;
      container.appendChild(label);
    });

    const selectAllCb = container.querySelector('[data-role="select-all"]');
    const itemCbs = Array.from(container.querySelectorAll('input[data-index]'));
    itemCbs.forEach(cb => { cb.checked = defaultChecked; });
    selectAllCb.checked = defaultChecked;
  }

  function bindChecklistSelectAll(container) {
    container.addEventListener('change', e => {
      const target = e.target;
      if (!(target instanceof HTMLInputElement)) return;

      const itemCbs = Array.from(container.querySelectorAll('input[data-index]'));
      const selectAllCb = container.querySelector('[data-role="select-all"]');

      if (target.dataset.role === 'select-all') {
        itemCbs.forEach(cb => { cb.checked = target.checked; });
      } else {
        selectAllCb.checked = itemCbs.length > 0 && itemCbs.every(cb => cb.checked);
      }
    });
  }

  function readCheckedIndices(container) {
    return Array.from(container.querySelectorAll('input[data-index]:checked'))
      .map(cb => Number(cb.dataset.index));
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

    const items = currentChapters.map(chapter => ({ label: chapter }));
    renderChecklist(el.chapterChecklist, items, 'Select all', false);

    if (!currentChapters.length) {
      el.chapterChecklist.innerHTML = '<p class="hint">No chapters found for this book.</p>';
    }
    el.chapterHelp.hidden = true;

    onChapterChecklistChange();
  }

  function getSelectedChapters() {
    return readCheckedIndices(el.chapterChecklist).map(idx => currentChapters[idx]);
  }

  function onChapterChecklistChange() {
    const chapters = getSelectedChapters();
    currentSubtopicRows = PoolBuilder.getSubtopicRows(pearsonBooks, currentBook, chapters);

    // A sub-topic name occasionally repeats under two different
    // chapters with different DF refs attached - disambiguate those
    // with the chapter name, but only when it's actually ambiguous.
    const nameCounts = {};
    currentSubtopicRows.forEach(row => { nameCounts[row.subTopic] = (nameCounts[row.subTopic] || 0) + 1; });

    const items = currentSubtopicRows.map(row => ({
      label: nameCounts[row.subTopic] > 1 ? `${row.subTopic} (${row.chapter})` : row.subTopic
    }));

    renderChecklist(el.subtopicChecklist, items, 'Select all', true);

    if (!currentSubtopicRows.length) {
      el.subtopicChecklist.innerHTML = '<p class="hint">No sub-topics — choose at least one chapter above.</p>';
    }
    el.subtopicHelp.hidden = true;

    onSelectionChanged();
  }

  function getSelectedSubtopicRows() {
    return readCheckedIndices(el.subtopicChecklist).map(idx => currentSubtopicRows[idx]);
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
    onSelectionChanged();
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

  // ---------------- Pool / level count / generate availability ----------------

  /**
   * The pool for whichever method is currently active, before any
   * level filtering. Returns [] for the saved-starter tab (that path
   * doesn't build a pool live - it's reconstructed on load instead).
   */
  function getCurrentPool() {
    if (currentMethod === 'pearsonBook') {
      return PoolBuilder.fromSubtopicRows(practiceSet, getSelectedSubtopicRows());
    }
    if (currentMethod === 'dfRefs') {
      return PoolBuilder.fromDfRefs(practiceSet, parseDfRefsInput());
    }
    return [];
  }

  /**
   * How many questions in `pool` match the given level-select value.
   * Progressive/mix draw from any level, so they report the whole pool.
   */
  function countForLevelMode(pool, levelMode) {
    if (levelMode === '1') return pool.filter(q => q.level === 1).length;
    if (levelMode === '2') return pool.filter(q => q.level === 2).length;
    if (levelMode === '3') return pool.filter(q => q.level === 3).length;
    if (levelMode === 'levels12') return pool.filter(q => q.level === 1 || q.level === 2).length;
    if (levelMode === 'levels23') return pool.filter(q => q.level === 2 || q.level === 3).length;
    return pool.length;
  }

  function onSelectionChanged() {
    updateGenerateAvailability();
    updateLevelCount();
  }

  function updateLevelCount() {
    if (currentMethod === 'saved') {
      el.levelCountHint.hidden = true;
      return;
    }
    const pool = getCurrentPool();
    const count = countForLevelMode(pool, el.levelSelect.value);
    el.levelCountHint.textContent = `${count} question${count === 1 ? '' : 's'} available for this selection.`;
    el.levelCountHint.hidden = false;
  }

  function updateGenerateAvailability() {
    if (currentMethod === 'pearsonBook') {
      el.generateBtn.disabled = getSelectedSubtopicRows().length === 0 || getCurrentPool().length === 0;
    } else if (currentMethod === 'dfRefs') {
      el.generateBtn.disabled = parseDfRefsInput().length === 0 || getCurrentPool().length === 0;
    } else {
      el.generateBtn.disabled = !getSelectedSavedQuiz();
    }
  }

  // ---------------- Generate / Load ----------------

  function buildConfig() {
    let pool, source;

    if (currentMethod === 'pearsonBook') {
      const chapters = getSelectedChapters();
      const subtopicRows = getSelectedSubtopicRows();
      pool = PoolBuilder.fromSubtopicRows(practiceSet, subtopicRows);
      source = {
        method: 'pearsonBook',
        book: currentBook,
        chapters,
        subtopics: subtopicRows.map(row => ({ chapter: row.chapter, subTopic: row.subTopic }))
      };
    } else {
      const dfRefs = parseDfRefsInput();
      pool = PoolBuilder.fromDfRefs(practiceSet, dfRefs);
      source = { method: 'dfRefs', dfRefs };
    }

    // "Levels 1 and 2" / "Levels 2 and 3" aren't understood by
    // SelectionEngine directly - pre-filter the pool to just those
    // levels and hand it "mix" instead, which then just draws from
    // whatever's left.
    let questions = pool;
    let levelMode = el.levelSelect.value;
    if (levelMode === 'levels12') {
      questions = pool.filter(q => q.level === 1 || q.level === 2);
      levelMode = 'mix';
    } else if (levelMode === 'levels23') {
      questions = pool.filter(q => q.level === 2 || q.level === 3);
      levelMode = 'mix';
    }

    return {
      source,
      questions,
      topics: [],
      method: 'mix', // selection-method dropdown removed - full mix is the only mode
      levelMode,
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
