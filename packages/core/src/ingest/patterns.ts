/** Line patterns shared by the chunker and the exercise extractor. */

/** "Exercise 2.3", "Problem 4:" ... group 1 is the number. */
export const EXERCISE_START = /^(?:Exercise|Problem)\s+(\d+(?:\.\d+)*)\s*[.:)]?\s*/i;

/** "Solution", "Solution to Exercise 2.3:" ... group 1 is the optional number. */
export const SOLUTION_START =
  /^Solution(?:\s+(?:to|for))?(?:\s+(?:Exercise|Problem))?\s*(\d+(?:\.\d+)*)?\s*[.:)]?\s*/i;

/** Inline solution marker inside an exercise block. */
export const INLINE_SOLUTION = /\bSolution\s*[:.]\s*/i;

export const DEFINITION_START = /^(?:Definition|Def\.)\b/i;
export const EXAMPLE_START = /^Example\b/i;
