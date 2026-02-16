/** A comment within a review thread, as returned by the GraphQL API. */
export interface ReviewComment {
  author: { login: string } | null;
  pullRequestReview: {
    id: string;
    createdAt: string;
    isMinimized: boolean;
  } | null;
}

/** A review thread on a PR, as returned by the GraphQL API. */
export interface ReviewThread {
  id: string;
  isResolved: boolean;
  comments: {
    nodes: ReviewComment[];
  };
}

/** Summary of a single thread within a review, used by the business logic. */
export interface ThreadInfo {
  threadId: string;
  isResolved: boolean;
}

/** A review grouped from its threads, used by the business logic. */
export interface ReviewInfo {
  reviewId: string;
  author: string;
  createdAt: string;
  isMinimized: boolean;
  threads: ThreadInfo[];
}

/** Minimal interface for making GraphQL calls. Easy to mock in tests. */
export interface GraphQLClient {
  graphql: <T = unknown>(
    query: string,
    variables?: Record<string, unknown>,
  ) => Promise<T>;
}
