// Question Grid — setup view controller
// Owns everything on the landing page: loading banks, reacting to
// dropdown changes, the student paste-in box, and building the config
// object that Generate hands off to the grid view.

const Setup = (() => {

  let currentBank = null;       // name of the selected bank
  let currentQuestions = [];    // full question array for that bank
  let students = [];            // parsed, deduped student names

  const el = {}; // populated in init() once the DOM exists

  function init() {
    cacheElements();
    bindEvents();
    loadBanks();
  }

  function cacheElements() {
    el.bankSelect = document.getElementById('bankSelect');
    el.topicWrap = document.getElementById('topicWrap');
    el.topicChecklist = document.getElementById('topicChecklist');
    el.methodSelect = document.getElementById('methodSelect');
    el.levelSelect = document.getElementById('levelSelect');
    el.levelHint = document.getElementById('levelHint');

    el.addStudentsBtn = document.getElementById('addStudentsBtn');
    el.studentsPanel = document.getElementById('studentsPanel');
    el.studentsInput = document.getElementById('studentsInput');
    el.saveStudentsBtn = document.getElementById('saveStudentsBtn');
    el.studentsSummary = document.getElementById('studentsSummary');

    el.timerEnabled = document.getElementById('timerEnabled');
    el.timerMinutes = document.getElementById('timerMinutes');
    el.timerSeconds = document.getElementById('timerSeconds');

    el.generateBtn = document.getElementById('generateBtn');
    el.statusMessage = document.getElementById('statusMessage');
    el.previewPanel = document.getElementById('previewPanel');
  }

  function bindEvents() {
    el.bankSelect.addEventListener('change', onBankChange);
    el.methodSelect.addEventListener('change', onMethodChange);

    el.addStudentsBtn.addEventListener('click', () => {
      el.studentsPanel.hidden = !el.studentsPanel.hidden;
      if (!el.studentsPanel.hidden) el.studentsInput.focus();
    });

    el.saveStudentsBtn.addEventListener('click', onSaveStudents);

    el.timerEnabled.addEventListener('change', () => {
      const on = el.timerEnabled.checked;
      el.timerMinutes.disabled = !on;
      el.timerSeconds.disabled = !on;
    });

    el.generateBtn.addEventListener('click', onGenerate);
  }

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

    // Re-apply visibility in case "By topic" was already selected
    onMethodChange();
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

  function onMethodChange() {
    const isTopic = el.methodSelect.value === 'topic';
    el.topicWrap.hidden = !isTopic;
  }

  function onSaveStudents() {
    const raw = el.studentsInput.value;
    const parsed = raw
      .split(/[\n,\t]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    // Dedupe while preserving first-seen order
    const seen = new Set();
    students = parsed.filter(name => {
      const key = name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    el.studentsSummary.textContent = students.length
      ? `${students.length} student${students.length === 1 ? '' : 's'} added.`
      : 'No students added yet — question squares will show no student banner.';

    el.studentsPanel.hidden = true;
  }

  function buildConfig() {
    const method = el.methodSelect.value;
    return {
      bank: currentBank,
      questions: currentQuestions,
      method,
      topics: method === 'topic' ? getSelectedTopics() : [],
      levelMode: el.levelSelect.value,
      students: students.slice(),
      timer: el.timerEnabled.checked
        ? {
            minutes: Number(el.timerMinutes.value) || 0,
            seconds: Number(el.timerSeconds.value) || 0
          }
        : null
    };
  }

  function onGenerate() {
    const config = buildConfig();

    if (config.method === 'topic' && config.topics.length === 0) {
      setStatus('Tick at least one topic before generating (Selection method is set to "By topic").', 'error');
      return;
    }

    // TEMPORARY: the grid view isn't built yet, so this just proves the
    // full setup pipeline works end-to-end. This gets replaced with
    // Grid.generate(config) in the next build pass.
    renderPreview(config);
  }

  function renderPreview(config) {
    el.previewPanel.hidden = false;
    el.previewPanel.innerHTML = `
      <h2>Setup captured ✓</h2>
      <p>This is a temporary preview — the actual 16-square grid is the next piece to build.</p>
      <dl>
        <dt>Bank</dt><dd>${escapeHtml(config.bank)} (${config.questions.length} eligible questions)</dd>
        <dt>Selection method</dt><dd>${escapeHtml(config.method)}</dd>
        <dt>Topics</dt><dd>${config.topics.length ? escapeHtml(config.topics.join(', ')) : '—'}</dd>
        <dt>Question level mode</dt><dd>${escapeHtml(config.levelMode)}</dd>
        <dt>Students</dt><dd>${config.students.length ? escapeHtml(config.students.join(', ')) : 'None added'}</dd>
        <dt>Timer</dt><dd>${config.timer ? `${config.timer.minutes}m ${config.timer.seconds}s` : 'Off'}</dd>
      </dl>
    `;
    el.previewPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

document.addEventListener('DOMContentLoaded', Setup.init);
