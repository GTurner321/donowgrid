// Question Grid — timer
// A countdown built into the grid header. Starts at 00:00; use +1/-1
// to set a target duration before pressing start, which then counts
// down to zero. At zero, an alarm sounds and the pause button becomes
// a stop button (to silence it early) - it also auto-stops after 10
// seconds regardless.

const Timer = (() => {
  let el = {};
  let remainingSeconds = 0;
  let intervalId = null;
  let alarmIntervalId = null;
  let alarmTimeoutId = null;
  let alarmActive = false;

  function init() {
    el.display = document.getElementById('timerDisplay');
    el.startBtn = document.getElementById('timerStart');
    el.pauseBtn = document.getElementById('timerPause');
    el.addMinuteBtn = document.getElementById('timerAddMinute');
    el.subMinuteBtn = document.getElementById('timerSubMinute');

    el.startBtn.addEventListener('click', start);
    el.pauseBtn.addEventListener('click', onPauseOrStopClick);
    el.addMinuteBtn.addEventListener('click', () => adjust(60));
    el.subMinuteBtn.addEventListener('click', () => adjust(-60));

    reset();
  }

  function reset() {
    pause();
    stopAlarm();
    remainingSeconds = 0;
    updateDisplay();
  }

  function start() {
    if (intervalId || remainingSeconds <= 0) return;
    stopAlarm();
    intervalId = setInterval(() => {
      remainingSeconds--;
      updateDisplay();
      if (remainingSeconds <= 0) {
        clearInterval(intervalId);
        intervalId = null;
        triggerAlarm();
      }
    }, 1000);
  }

  function pause() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function onPauseOrStopClick() {
    if (alarmActive) {
      stopAlarm();
    } else {
      pause();
    }
  }

  function adjust(deltaSeconds) {
    if (alarmActive) stopAlarm();
    remainingSeconds = Math.max(0, remainingSeconds + deltaSeconds);
    updateDisplay();
  }

  function triggerAlarm() {
    alarmActive = true;
    el.pauseBtn.textContent = '■';
    el.pauseBtn.title = 'Stop sound';
    Sound.playTimerEnd();
    alarmIntervalId = setInterval(() => Sound.playTimerEnd(), 1200);
    alarmTimeoutId = setTimeout(stopAlarm, 10000);
  }

  function stopAlarm() {
    if (alarmIntervalId) { clearInterval(alarmIntervalId); alarmIntervalId = null; }
    if (alarmTimeoutId) { clearTimeout(alarmTimeoutId); alarmTimeoutId = null; }
    alarmActive = false;
    el.pauseBtn.textContent = '⏸';
    el.pauseBtn.title = 'Pause';
  }

  function updateDisplay() {
    const m = Math.floor(remainingSeconds / 60);
    const s = remainingSeconds % 60;
    el.display.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  return { init, reset };
})();
