// a11yfix-action: the pure parts of the GitHub Action, for tests and reuse.

export { hunkFor, rightHunks, type LineRange } from "./diff.js";
export { GitHub, GitHubError, type GitHubOptions, type PullFile, type Review } from "./github.js";
export { globToRegExp, matchesAny, parsePatterns } from "./glob.js";
export {
  REVIEW_MARKER,
  SUGGESTION_MARKER,
  bodyOnlyPayload,
  commentBody,
  fenceFor,
  planReview,
  reviewPayload,
  type Counts,
  type ReviewComment,
  type ReviewPayload,
  type ReviewPlan,
  type RunInfo,
} from "./review.js";
export { lineStarts, placeFixes, suggestionKey, type FileReport, type FindingResult, type Suggestion, type Unplaced } from "./suggest.js";
