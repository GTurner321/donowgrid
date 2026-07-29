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
    el.revealAllBtn = document.getElementById('revealAllBtn');
    el.globalStudentBtn = document.getElementById('globalStudentBtn');
    el.timerBtn = document.getElementById('timerBtn');
    el.fullscreenBtn = document.getElementById('fullscreenBtn');

    el.backBtn.addEventListener('click', backToSetup);
    el.revealAllBtn.addEventListener('click', () => Grid.revealAllShutters());
    el.globalStudentBtn.addEventListener('click', () => Grid.toggleGlobalStudents());
    el.timerBtn.addEventListener('click', onTimerClick);
    el.fullscreenBtn.addEventListener('click', toggleFullscreen);

    document.addEventListener('fullscreenchange', () => {
      // Layout dimensions change on entering/exiting fullscreen, so every
      // piece of scaled text needs reassessing against its new box size.
      requestAnimationFrame(() => Grid.autosizeAll());
    });

    Setup.init();
    Grid.init();
    Timer.init();
  }

  function showGrid(config) {
    el.setupView.hidden = true;
    el.gridView.hidden = false;
    Grid.generate(config);

    if (config.timer) {
      Timer.show(config.timer.minutes, config.timer.seconds);
    } else {
      Timer.hide();
    }
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
