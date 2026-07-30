// Question Grid — setup view controller
// Owns everything on the landing page: loading banks, reacting to
// dropdown changes, the student paste-in box, the saved-quiz picker,
// the saved-class-list picker, and building the config object that
// Generate hands off to the grid.

const Setup = (() => {

  let currentBank = null;       // name of the selected bank
  let currentQuestions = [];    // full question array for that bank
  let students = [];            // parsed, deduped student names
  let savedQuizzes = [];        // valid (non-expired) saved quizzes
  let savedGroups = [];         // saved class lists (group1..group10)

  const el = {}; // populated in init() once the DOM exists

  function init() {
    cacheElements();
    bindEvents();
    loadBanks();
    loadSavedQuizzes();
    loadSavedGroups();
  }

  function cacheElements() {
    el.savedQuizField = document.getElementById('savedQuizField');
    el.savedQuizSelect = document.getElementById('savedQuizSelect');
    el.savedQuizHint = document.getElementById('savedQuizHint');
    el.quizNormalFields = document.getElementById('quizNormalFields');

    el.bankSelect = document.getElementById('bankSelect');
    el.topicToggle = document.getElementById('topicToggle');
    el.topicHelp = document.getElementById('topicHelp');
    el.topicChecklist = document.getElementById('topicChecklist');
    el.methodSelect = document.getElementById('methodSelect');
    el.levelSelect = document.getElementById('levelSelect');
    el.levelHint = document.getElementById('levelHint');

    el.savedGroupField = document.getElementById('savedGroupField');
    el.savedGroupSelect = document.getElementById('savedGroupSelect');
    el.studentsNormalFields = document.getElementById('studentsNormalFields');
    el.studentsPanel = document.getElementById('studentsPanel');
    el.studentsInput = document.getElementById('studentsInput');
    el.addStudentsBtn = document.getElementById('addStudentsBtn');
    el.saveClassListBtn = document.getElementById('saveClassListBtn');
    el.studentsSummary = document.getElementById('studentsSummary');

    el.generateBtn = document.getElementById('generateBtn');
    el.statusMessage = document.getElementById('statusMessage');
  }

  function bindEvents() {
    el.savedQuizSelect.addEventListener('change', onSavedQuizChange);
    el.savedGroupSelect.addEventListener('change', onSavedGroupChange);

    el.bankSelect.addEventListener('change', onBankChange);
    el.topicToggle.addEventListener('change', onTopicToggle);

    el.addStudentsBtn.addEventListener('click', onAddStudents);
    el.saveClassListBtn.addEventListener('click', onSaveClassList);

    el.generateBtn.addEventListener('click', onGenerate);
  }

  // ---------------- Saved quizzes ----------------

  function loadSavedQuizzes() {
    savedQuizzes = SaveQuiz.listValid();
    if (!savedQuizzes.length) {
      el.savedQuizField.hidden = true;
      return;
    }

    el.savedQuizSelect.innerHTML = '<option value="none">None (start fresh)</option>';
    savedQuizzes.forEach(q => {
      const opt = document.createElement('option');
      opt.value = String(q.slot);
      opt.textContent = `quiz${q.slot} — ${q.bank} (${SaveQuiz.relativeTime(q.savedAt)})`;
      el.savedQuizSelect.appendChild(opt);
    });
    el.savedQuizField.hidden = false;
  }

  function onSavedQuizChange() {
    const usingSaved = el.savedQuizSelect.value !== 'none';
    el.quizNormalFields.hidden = usingSaved;
    el.savedQuizHint.hidden = !usingSaved;
    el.generateBtn.textContent = usingSaved ? 'Load saved quiz' : 'Generate';

    // A saved quiz doesn't need a bank picked separately, but Generate
    // is disabled by default until a bank load enables it - re-enable
    // here since the saved quiz already has its own valid bank.
    if (usingSaved) el.generateBtn.disabled = false;
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

  // ---------------- Normal bank flow ----------------

  async function loadBanks() {
    setStatus('Loading question banks…', 'info');
    try {
      const banks = await DataService.listBanks();
      el.bankSelect.innerHTML = '<option value="" disabled selected>Choose a question bank…</option>';
      banks.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        el.bankSelect.appendChild(opt);
      });
      el.bankSelect.disabled = false;
      setStatus(banks.length ? '' : 'No question banks found — check the spreadsheet has at least one tab with the correct headers.', banks.length ? '' : 'warn');
    } catch (err) {
      setStatus(`Couldn't load question banks: ${err.message}`, 'error');
    }
  }

  async function onBankChange() {
    currentBank = el.bankSelect.value;
    el.generateBtn.disabled = true;
    setStatus('Loading questions…', 'info');

    try {
      currentQuestions = await DataService.getBank(currentBank);

      if (!currentQuestions.length) {
        setStatus(`"${currentBank}" has no eligible questions (check the select-column gating).`, 'warn');
      } else {
        setStatus(`${currentQuestions.length} eligible question${currentQuestions.length === 1 ? '' : 's'} loaded from "${currentBank}".`, 'success');
      }

      populateTopics();
      populateLevelAvailability();
      el.generateBtn.disabled = currentQuestions.length === 0;
    } catch (err) {
      setStatus(`Couldn't load "${currentBank}": ${err.message}`, 'error');
      currentQuestions = [];
    }
  }

  function populateTopics() {
    const topics = SelectionEngine.getEligibleTopics(currentQuestions);
    el.topicChecklist.innerHTML = '';

    if (!topics.length) {
      el.topicChecklist.innerHTML = '<p class="hint">No topics available for this bank.</p>';
    } else {
      topics.forEach(({ topic, count }) => {
        const id = 'topic-' + topic.replace(/\s+/g, '-').toLowerCase();
        const label = document.createElement('label');
        label.innerHTML = `
          <input type="checkbox" id="${id}" value="${escapeHtml(topic)}">
          <span>${escapeHtml(topic)}</span>
          <span class="count">${count}</span>
        `;
        el.topicChecklist.appendChild(label);
      });
    }

    // Keep checklist visibility consistent with the current toggle state
    el.topicChecklist.hidden = !el.topicToggle.checked;
  }

  function onTopicToggle() {
    const checked = el.topicToggle.checked;
    el.topicChecklist.hidden = !checked;
    el.topicHelp.textContent = checked
      ? 'Tick one or more — questions will be drawn from all ticked topics combined.'
      : 'Questions will be chosen from the entire set.';
  }

  function getSelectedTopics() {
    return Array.from(el.topicChecklist.querySelectorAll('input[type="checkbox"]:checked'))
      .map(cb => cb.value);
  }

  function populateLevelAvailability() {
    const usable = SelectionEngine.bankHasUsableLevels(currentQuestions);
    const restrictedOptions = el.levelSelect.querySelectorAll('option[data-requires-levels]');

    restrictedOptions.forEach(opt => { opt.disabled = !usable; });

    if (!usable) {
      el.levelSelect.value = 'mix';
      el.levelHint.textContent = 'This bank doesn\'t have enough level-tagged questions — level selection is unavailable.';
      el.levelHint.hidden = false;
    } else {
      el.levelHint.hidden = true;
    }
  }

  // ---------------- Students ----------------

  function parseStudentsFromTextarea() {
    const raw = el.studentsInput.value;
    const parsed = raw
      .split(/[\n,\t]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    // Dedupe while preserving first-seen order
    const seen = new Set();
    return parsed.filter(name => {
      const key = name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function flashSummarySaved() {
    // Visible confirmation that the action actually registered - the box
    // switches from its default pale-yellow to pale-green briefly.
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

  // ---------------- Generate / Load ----------------

  function buildConfig() {
    const method = el.methodSelect.value;
    return {
      bank: currentBank,
      questions: currentQuestions,
      method,
      topics: el.topicToggle.checked ? getSelectedTopics() : [],
      levelMode: el.levelSelect.value,
      students: students.slice()
    };
  }

  async function onGenerate() {
    const savedQuiz = getSelectedSavedQuiz();

    if (savedQuiz) {
      await loadSavedQuiz(savedQuiz);
      return;
    }

    const config = buildConfig();

    if (el.topicToggle.checked && config.topics.length === 0) {
      setStatus('Tick at least one topic, or turn off "Choose by topic".', 'error');
      return;
    }

    App.showGrid(config);
  }

  async function loadSavedQuiz(savedQuiz) {
    setStatus(`Loading "${savedQuiz.bank}"…`, 'info');
    el.generateBtn.disabled = true;
    try {
      const questions = await DataService.getBank(savedQuiz.bank);
      const config = {
        bank: savedQuiz.bank,
        questions,
        method: 'mix',
        topics: [],
        levelMode: 'mix',
        students: students.slice()
      };
      App.showGridFromSaved(config, savedQuiz.order);
    } catch (err) {
      setStatus(`Couldn't load saved quiz: ${err.message}`, 'error');
      el.generateBtn.disabled = false;
    }
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
