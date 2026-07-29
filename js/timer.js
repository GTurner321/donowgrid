// Question Grid — timer
// A simple stopwatch built into the grid header: starts at 0:00, counts
// up while running, +1/-1 adjust the displayed time by a minute at any
// point (running or paused), start/pause control ticking. No preset
// duration or setup-page configuration - it's always available, always
// starts fresh at 0:00 when a new grid is generated.

const Timer = (() => {
  let el = {};
  let elapsedSeconds = 0;
  let intervalId = null;

  function init() {
    el.display = document.getElementById('timerDisplay');
    el.startBtn = document.getElementById('timerStart');
    el.pauseBtn = document.getElementById('timerPause');
    el.addMinuteBtn = document.getElementById('timerAddMinute');
    el.subMinuteBtn = document.getElementById('timerSubMinute');

    el.startBtn.addEventListener('click', start);
    el.pauseBtn.addEventListener('click', pause);
    el.addMinuteBtn.addEventListener('click', () => adjust(60));
    el.subMinuteBtn.addEventListener('click', () => adjust(-60));

    reset();
  }

  function reset() {
    pause();
    elapsedSeconds = 0;
    updateDisplay();
  }

  function start() {
    if (intervalId) return;
    intervalId = setInterval(() => {
      elapsedSeconds++;
      updateDisplay();
    }, 1000);
  }

  function pause() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function adjust(deltaSeconds) {
    elapsedSeconds = Math.max(0, elapsedSeconds + deltaSeconds);
    updateDisplay();
  }

  function updateDisplay() {
    const m = Math.floor(elapsedSeconds / 60);
    const s = elapsedSeconds % 60;
    el.display.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  return { init, reset };
})();
