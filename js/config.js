// Question Grid — central configuration
// Update APPS_SCRIPT_URL if the Apps Script deployment is ever recreated
// (a "New version" deploy keeps the same URL and needs no change here).

const CONFIG = {
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbyDn-6v0PmCbp421QJidFpQhKbh5qPCpg8LhJM2uki7TWcTqzBy0WzjVY2CmWsrFGV6/exec',

  // Minimum number of eligible questions a topic needs to appear in the
  // "By topic" dropdown at all.
  MIN_QUESTIONS_PER_TOPIC: 1,

  // Minimum number of level-tagged questions (level 1-4) a bank needs
  // before level-specific selection options are offered. Below this,
  // the level dropdown falls back to "Full random mix" only.
  MIN_LEVEL_TAGGED_QUESTIONS: 4
};
