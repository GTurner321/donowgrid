// Question Grid — pool builder
// Turns whichever selection method the user picked (Pearson book +
// chapters, or a raw list of Dr Frost skill numbers) into a filtered
// pool of practice-set questions. Kept separate from setup.js so the
// same logic can be reused to rebuild a pool when loading a saved
// starter, without re-deriving it from live form state.

const PoolBuilder = (() => {

  /**
   * Unions the DF ref numbers of every Pearson-books row (i.e. every
   * sub-topic) belonging to the given book + selected chapters, then
   * filters the practice set down to questions tagged with any of
   * those refs.
   */
  function fromPearsonBook(practiceSet, pearsonRows, book, chapters) {
    const chapterSet = new Set(chapters);
    const refSet = new Set();

    pearsonRows.forEach(row => {
      if (row.book === book && chapterSet.has(row.chapter)) {
        row.refs.forEach(r => refSet.add(r));
      }
    });

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
   * stores alongside a saved starter's box layout.
   */
  function fromDescriptor(practiceSet, pearsonRows, descriptor) {
    if (descriptor.method === 'pearsonBook') {
      return fromPearsonBook(practiceSet, pearsonRows, descriptor.book, descriptor.chapters);
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

  return { fromPearsonBook, fromDfRefs, fromDescriptor, describeDescriptor };
})();
