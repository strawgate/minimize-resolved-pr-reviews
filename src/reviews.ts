import { ReviewThread, ReviewInfo, PullRequestReviewNode } from "./types";

/**
 * Groups raw review threads by their parent review.
 *
 * Each thread's first comment carries a `pullRequestReview` reference that
 * tells us which review it belongs to. Threads with no author or no review
 * link are skipped (orphaned data).
 */
export function groupThreadsByReview(threads: ReviewThread[]): ReviewInfo[] {
  const reviewMap = new Map<string, ReviewInfo>();

  for (const thread of threads) {
    const firstComment = thread.comments.nodes[0];
    if (!firstComment?.author || !firstComment.pullRequestReview) continue;

    const review = firstComment.pullRequestReview;

    if (!reviewMap.has(review.id)) {
      reviewMap.set(review.id, {
        reviewId: review.id,
        author: firstComment.author.login,
        createdAt: review.createdAt,
        isMinimized: review.isMinimized,
        threads: [],
      });
    }

    reviewMap.get(review.id)!.threads.push({
      threadId: thread.id,
      isResolved: thread.isResolved,
    });
  }

  return Array.from(reviewMap.values());
}

/**
 * Builds the complete list of reviews by merging thread-grouped data with
 * the full reviews list from the PR.
 *
 * Reviews discovered through threads already have their thread data populated.
 * Reviews from the `reviews` connection that have no threads (e.g. bare
 * approvals, comment-only reviews) are added with an empty thread array.
 *
 * Reviews with no author (deleted users) are skipped.
 */
export function buildReviewList(
  threads: ReviewThread[],
  allReviews: PullRequestReviewNode[],
): ReviewInfo[] {
  const reviewMap = new Map<string, ReviewInfo>();

  // First pass: populate from threads (gives us thread data)
  for (const info of groupThreadsByReview(threads)) {
    reviewMap.set(info.reviewId, info);
  }

  // Second pass: add any reviews not discovered through threads
  for (const review of allReviews) {
    if (!review.author) continue;
    if (reviewMap.has(review.id)) continue;

    reviewMap.set(review.id, {
      reviewId: review.id,
      author: review.author.login,
      createdAt: review.createdAt,
      isMinimized: review.isMinimized,
      threads: [],
    });
  }

  return Array.from(reviewMap.values());
}

/**
 * Determines which reviews should be minimized.
 *
 * Rules:
 * 1. Only consider reviews from authors in `allowedUsers` (or all if empty).
 * 2. For each author, the most recent review is always kept visible.
 * 3. Older reviews are minimized only if ALL their threads are resolved
 *    (the entire review has been addressed).
 * 4. Already-minimized reviews are skipped.
 *
 * Returns the review IDs to minimize.
 */
export function findReviewsToMinimize(
  reviews: ReviewInfo[],
  allowedUsers: string[],
): string[] {
  const byAuthor = new Map<string, ReviewInfo[]>();
  for (const review of reviews) {
    if (!byAuthor.has(review.author)) {
      byAuthor.set(review.author, []);
    }
    byAuthor.get(review.author)!.push(review);
  }

  const reviewIds: string[] = [];

  for (const [author, authorReviews] of byAuthor) {
    if (allowedUsers.length > 0 && !allowedUsers.includes(author)) continue;

    // Most recent first
    const sorted = [...authorReviews].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    // Always keep the most recent review; check the rest
    for (const review of sorted.slice(1)) {
      if (review.isMinimized) continue;

      const allThreadsResolved = review.threads.every((t) => t.isResolved);
      if (!allThreadsResolved) continue;

      reviewIds.push(review.reviewId);
    }
  }

  return reviewIds;
}
