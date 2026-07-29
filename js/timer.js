// Question Grid — timer widget
// A small draggable panel with an adjustable countdown. Built custom
// rather than an embedded third-party widget, so it can be freely
// repositioned, restyled, and hooked up to the app's own sound effects.

const Timer = (() => {
  let el = {};
  let remainingSeconds = 0;
  let intervalId = null;
  let dragState = null;

  function init() {
    el.widget = document.getElementById('timerWidget');
    el.handle = document.getElementById('timerHandle');
    el.display = document.getElementById('timerDisplay');
    el.minutesInput = document.getElementById('timerMinutesInput');
    el.secondsInput = document.getElementById('timerSecondsInput');
    el.startBtn = document.getElementById('timerStart');
    el.pauseBtn = document.getElementById('timerPause');
    el.resetBtn = document.getElementById('timerReset');
    el.closeBtn = document.getElementById('timerClose');

    el.startBtn.addEventListener('click', start);
    el.pauseBtn.addEventListener('click', pause);
    el.resetBtn.addEventListener('click', resetFromInputs);
    el.closeBtn.addEventListener('click', hide);

    el.minutesInput.addEventListener('change', resetFromInputs);
    el.secondsInput.addEventListener('change', resetFromInputs);

    el.handle.addEventListener('pointerdown', onDragStart);
    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', onDragEnd);
  }

  function show(presetMinutes, presetSeconds) {
    if (presetMinutes !== undefined) el.minutesInput.value = presetMinutes;
    if (presetSeconds !== undefined) el.secondsInput.value = presetSeconds;
    resetFromInputs();
    el.widget.hidden = false;
  }

  function toggle(presetMinutes, presetSeconds) {
    if (el.widget.hidden) {
      show(presetMinutes, presetSeconds);
    } else {
      hide();
    }
  }

  function hide() {
    pause();
    el.widget.hidden = true;
  }

  function resetFromInputs() {
    pause();
    const mins = Math.max(0, Number(el.minutesInput.value) || 0);
    const secs = Math.max(0, Math.min(59, Number(el.secondsInput.value) || 0));
    remainingSeconds = mins * 60 + secs;
    updateDisplay();
  }

  function start() {
    if (intervalId || remainingSeconds <= 0) return;
    intervalId = setInterval(() => {
      remainingSeconds--;
      updateDisplay();
      if (remainingSeconds <= 0) {
        pause();
        Sound.playTimerEnd();
      }
    }, 1000);
  }

  function pause() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function updateDisplay() {
    const m = Math.floor(remainingSeconds / 60);
    const s = remainingSeconds % 60;
    el.display.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  // ---- Dragging ----

  function onDragStart(e) {
    const rect = el.widget.getBoundingClientRect();
    dragState = {
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top
    };
    el.widget.setPointerCapture(e.pointerId);
  }

  function onDragMove(e) {
    if (!dragState) return;
    const x = e.clientX - dragState.offsetX;
    const y = e.clientY - dragState.offsetY;
    el.widget.style.left = `${Math.max(0, x)}px`;
    el.widget.style.top = `${Math.max(0, y)}px`;
    el.widget.style.right = 'auto';
  }

  function onDragEnd() {
    dragState = null;
  }

  return { init, show, toggle, hide };
})();
