// Question Grid — save quiz
// Saves just enough to reconstruct a fixed 9-question grid: the bank
// name, and each box's question identified by its "order added" value
// (or null for a blank box). Nothing else is stored - on load, the
// bank is re-fetched live and matched back up, so edits to question
// text since saving show up correctly, only the box layout is fixed.
//
// Single-browser only (localStorage), no server involved. Slots are
// named quiz1, quiz2, ... - a save reuses the first slot that's either
// empty or expired (2 days), so the numbering stays low in practice.

const SaveQuiz = (() => {
  const PREFIX = 'doNow9_quiz_';
  const EXPIRY_MS = 2 * 24 * 60 * 60 * 1000; // 2 days
  const MAX_SLOT_SCAN = 200; // safety bound, not a real limit in practice

  function readSlot(slot) {
    const raw = localStorage.getItem(PREFIX + slot);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null; // corrupt entry, treat as empty
    }
  }

  function isExpired(data) {
    return !data || (Date.now() - data.savedAt) >= EXPIRY_MS;
  }

  /**
   * Returns all currently valid (non-expired) saved quizzes, each as
   * { slot, bank, order, savedAt }, sorted by slot number.
   */
  function listValid() {
    const results = [];
    for (let slot = 1; slot <= MAX_SLOT_SCAN; slot++) {
      const data = readSlot(slot);
      if (data && !isExpired(data)) {
        results.push({ slot, bank: data.bank, order: data.order, savedAt: data.savedAt });
      }
    }
    return results;
  }

  function findSlotToSave() {
    for (let slot = 1; slot <= MAX_SLOT_SCAN; slot++) {
      const data = readSlot(slot);
      if (!data || isExpired(data)) return slot;
    }
    return MAX_SLOT_SCAN; // extremely unlikely fallback
  }

  /**
   * Saves the current 9-box layout. orderList is an array of 9 values,
   * each the question's "order added" value or null for a blank box.
   * Returns the slot name used, e.g. "quiz3".
   */
  function save(bankName, orderList) {
    const slot = findSlotToSave();
    const data = { bank: bankName, order: orderList, savedAt: Date.now() };
    localStorage.setItem(PREFIX + slot, JSON.stringify(data));
    return 'quiz' + slot;
  }

  function relativeTime(savedAt) {
    const diffMs = Date.now() - savedAt;
    const hours = Math.floor(diffMs / (60 * 60 * 1000));
    if (hours < 1) return 'saved just now';
    if (hours === 1) return 'saved 1 hour ago';
    if (hours < 24) return `saved ${hours} hours ago`;
    const days = Math.floor(hours / 24);
    return days === 1 ? 'saved 1 day ago' : `saved ${days} days ago`;
  }

  return { listValid, save, relativeTime };
})();
