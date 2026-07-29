// Question Grid — timer
// Sits inline in the grid header rather than as a floating widget.
// Toggled visible/hidden by the timer icon; Start/Pause/Reset/+1 min
// sit beside the display rather than below it.

const Timer = (() => {
  let el = {};
  let remainingSeconds = 0;
  let intervalId = null;

  function init() {
    el.bar = document.getElementById('timerInline');
    el.display = document.getElementById('timerDisplay');
    el.minutesInput = document.getElementById('timerMinutesInput');
    el.secondsInput = document.getElementById('timerSecondsInput');
    el.startBtn = document.getElementById('timerStart');
    el.pauseBtn = document.getElementById('timerPause');
    el.resetBtn = document.getElementById('timerReset');
    el.addMinuteBtn = document.getElementById('timerAddMinute');

    el.startBtn.addEventListener('click', start);
    el.pauseBtn.addEventListener('click', pause);
    el.resetBtn.addEventListener('click', resetFromInputs);
    el.addMinuteBtn.addEventListener('click', addMinute);

    el.minutesInput.addEventListener('change', resetFromInputs);
    el.secondsInput.addEventListener('change', resetFromInputs);
  }

  function show(presetMinutes, presetSeconds) {
    if (presetMinutes !== undefined) el.minutesInput.value = presetMinutes;
    if (presetSeconds !== undefined) el.secondsInput.value = presetSeconds;
    resetFromInputs();
    el.bar.hidden = false;
  }

  function hide() {
    pause();
    el.bar.hidden = true;
  }

  function toggle(presetMinutes, presetSeconds) {
    if (el.bar.hidden) {
      show(presetMinutes, presetSeconds);
    } else {
      hide();
    }
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

  function addMinute() {
    remainingSeconds += 60;
    updateDisplay();
  }

  function updateDisplay() {
    const m = Math.floor(remainingSeconds / 60);
    const s = remainingSeconds % 60;
    el.display.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  return { init, show, hide, toggle };
})();
