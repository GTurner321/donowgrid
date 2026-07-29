// Question Grid — app controller
// Thin layer that owns which view is visible and the grid header
// controls (back, global student reveal, timer, fullscreen). All the
// real logic lives in Setup and Grid.

const App = (() => {
  let el = {};

  function init() {
    el.setupView = document.getElementById('setupView');
    el.gridView = document.getElementById('gridView');

    el.backBtn = document.getElementById('backBtn');
    el.globalStudentBtn = document.getElementById('globalStudentBtn');
    el.timerBtn = document.getElementById('timerBtn');
    el.fullscreenBtn = document.getElementById('fullscreenBtn');

    el.backBtn.addEventListener('click', backToSetup);
    el.globalStudentBtn.addEventListener('click', () => Grid.toggleGlobalStudents());
    el.timerBtn.addEventListener('click', onTimerClick);
    el.fullscreenBtn.addEventListener('click', toggleFullscreen);

    Grid.init();
    Timer.init();
  }

  function showGrid(config) {
    el.setupView.hidden = true;
    el.gridView.hidden = false;
    Grid.generate(config);
  }

  function backToSetup() {
    // Deliberate action only - never triggered by an accidental page
    // refresh, per design: a real reload discards everything and
    // returns here naturally, but this button is the only in-session way.
    el.gridView.hidden = true;
    el.setupView.hidden = false;
  }

  function onTimerClick() {
    Timer.toggle();
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  return { init, showGrid };
})();

document.addEventListener('DOMContentLoaded', App.init);
