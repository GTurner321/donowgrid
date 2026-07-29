// Question Grid — app controller
// Thin layer that owns which view is visible and the grid header
// controls (back, reveal-all, global student reveal, save, fullscreen).
// All the real logic lives in Setup, Grid, Timer and SaveQuiz.

const App = (() => {
  let el = {};

  function init() {
    el.setupView = document.getElementById('setupView');
    el.gridView = document.getElementById('gridView');

    el.backBtn = document.getElementById('backBtn');
    el.hideAllBtn = document.getElementById('hideAllBtn');
    el.globalStudentBtn = document.getElementById('globalStudentBtn');
    el.saveBtn = document.getElementById('saveBtn');
    el.fullscreenBtn = document.getElementById('fullscreenBtn');
    el.saveConfirm = document.getElementById('saveConfirm');

    el.backBtn.addEventListener('click', backToSetup);
    el.hideAllBtn.addEventListener('click', () => Grid.hideAllShutters());
    el.globalStudentBtn.addEventListener('click', () => Grid.toggleGlobalStudents());
    el.saveBtn.addEventListener('click', onSaveClick);
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
    Timer.reset();
  }

  function showGridFromSaved(config, orderList) {
    el.setupView.hidden = true;
    el.gridView.hidden = false;
    Grid.generateFromSaved(config, orderList);
    Timer.reset();
  }

  function backToSetup() {
    // Deliberate action only - never triggered by an accidental page
    // refresh, per design: a real reload discards everything and
    // returns here naturally, but this button is the only in-session way.
    el.gridView.hidden = true;
    el.setupView.hidden = false;
  }

  function onSaveClick() {
    const data = Grid.getSaveData();
    if (!data) return;
    const slotName = SaveQuiz.save(data.bank, data.order);
    el.saveConfirm.textContent = `Saved as ${slotName} — expires in 2 days, only visible in this browser.`;
    el.saveConfirm.hidden = false;
    setTimeout(() => { el.saveConfirm.hidden = true; }, 5000);
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  return { init, showGrid, showGridFromSaved };
})();

document.addEventListener('DOMContentLoaded', App.init);
