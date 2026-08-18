// Question Grid — pool builder
// Turns whichever selection method the user picked into a filtered
// pool of practice-set questions. Kept separate from setup.js so the
// same logic can be reused to rebuild a pool when loading a saved
// starter, without re-deriving it from live form state.
//
// The Pearson-book path now works at sub-topic granularity: chapters
// narrow down which sub-topic rows are on offer, but the actual pool
// is built from whichever individual sub-topics are still ticked.

const PoolBuilder = (() => {

  /**
   * Every Pearson-books row (i.e. every sub-topic) belonging to the
   * given book + selected chapters - the full candidate list a
   * sub-topic checklist should be populated from.
   */
  function getSubtopicRows(pearsonRows, book, chapters) {
    const chapterSet = new Set(chapters);
    return pearsonRows.filter(row => row.book === book && chapterSet.has(row.chapter));
  }

  /**
   * Unions the DF ref numbers of the given sub-topic rows, then
   * filters the practice set down to questions tagged with any of
   * those refs.
   */
  function fromSubtopicRows(practiceSet, subtopicRows) {
    const refSet = new Set();
    subtopicRows.forEach(row => row.refs.forEach(r => refSet.add(r)));
    return practiceSet.filter(q => refSet.has(q.dfRefNum));
  }

  /**
   * Filters the practice set directly against a hand-typed list of
   * Dr Frost skill numbers - no Pearson-books lookup involved.
   */
  function fromDfRefs(practiceSet, dfRefs) {
    const refSet = new Set(dfRefs);
    return practiceSet.filter(q => refSet.has(q.dfRefNum));
  }

  /**
   * Rebuilds a pool from a saved descriptor - the same shape SaveQuiz
   * stores alongside a saved starter's box layout. For the Pearson-book
   * method, the descriptor records the exact chapter+sub-topic pairs
   * that were ticked (not just the chapters), since sub-topics can be
   * individually deselected.
   */
  function fromDescriptor(practiceSet, pearsonRows, descriptor) {
    if (descriptor.method === 'pearsonBook') {
      const wanted = new Set(descriptor.subtopics.map(s => s.chapter + '\u0000' + s.subTopic));
      const rows = pearsonRows.filter(row =>
        row.book === descriptor.book && wanted.has(row.chapter + '\u0000' + row.subTopic)
      );
      return fromSubtopicRows(practiceSet, rows);
    }
    if (descriptor.method === 'dfRefs') {
      return fromDfRefs(practiceSet, descriptor.dfRefs);
    }
    return [];
  }

  function describeDescriptor(descriptor) {
    if (descriptor.method === 'pearsonBook') {
      return `${descriptor.book}: ${descriptor.chapters.join(', ')}`;
    }
    if (descriptor.method === 'dfRefs') {
      return `DF refs ${descriptor.dfRefs.join(', ')}`;
    }
    return 'Unknown selection';
  }

  return { getSubtopicRows, fromSubtopicRows, fromDfRefs, fromDescriptor, describeDescriptor };
})();
