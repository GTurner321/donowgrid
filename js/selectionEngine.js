// Question Grid — selection engine
// At this stage this only covers what the setup page needs (working out
// which topics/levels are viable options for the current bank). The
// full generate-16-squares logic, refresh logic, and student round-robin
// get added here in the next build pass, once the grid view exists to
// consume them.

const SelectionEngine = (() => {

  /**
   * Returns topics with enough eligible questions to be offered in the
   * "By topic" dropdown, sorted alphabetically, each with a count so the
   * UI can optionally show it (e.g. "Fractions (12)").
   */
  function getEligibleTopics(questions) {
    const counts = {};
    questions.forEach(q => {
      const topic = (q.topic || '').trim();
      if (!topic) return;
      counts[topic] = (counts[topic] || 0) + 1;
    });

    return Object.keys(counts)
      .filter(topic => counts[topic] >= CONFIG.MIN_QUESTIONS_PER_TOPIC)
      .sort((a, b) => a.localeCompare(b))
      .map(topic => ({ topic, count: counts[topic] }));
  }

  /**
   * Whether this bank has enough level-tagged (1-4) questions to make
   * level-specific selection meaningful. Below the threshold, level
   * options should fall back to "Full random mix" only.
   */
  function bankHasUsableLevels(questions) {
    const tagged = questions.filter(q => q.level !== null && q.level >= 1 && q.level <= 4);
    return tagged.length >= CONFIG.MIN_LEVEL_TAGGED_QUESTIONS;
  }

  return { getEligibleTopics, bankHasUsableLevels };
})();
