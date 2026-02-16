import {
  GraphQLClient,
  ReviewThread,
  PullRequestReviewNode,
} from "./types";

// -- Response types -----------------------------------------------------------

interface PageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

interface ReviewThreadsResponse {
  repository: {
    pullRequest: {
      reviewThreads: {
        pageInfo: PageInfo;
        nodes: ReviewThread[];
      };
    };
  };
}

interface ReviewsResponse {
  repository: {
    pullRequest: {
      reviews: {
        pageInfo: PageInfo;
        nodes: PullRequestReviewNode[];
      };
    };
  };
}

// -- Queries ------------------------------------------------------------------

const REVIEW_THREADS_QUERY = `
  query($owner: String!, $repo: String!, $number: Int!, $cursor: String) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        reviewThreads(first: 100, after: $cursor) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            id
            isResolved
            comments(first: 1) {
              nodes {
                author {
                  login
                }
                pullRequestReview {
                  id
                  createdAt
                  isMinimized
                }
              }
            }
          }
        }
      }
    }
  }
`;

const REVIEWS_QUERY = `
  query($owner: String!, $repo: String!, $number: Int!, $cursor: String) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        reviews(first: 100, after: $cursor) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            id
            author {
              login
            }
            createdAt
            isMinimized
          }
        }
      }
    }
  }
`;

const MINIMIZE_MUTATION = `
  mutation($subjectId: ID!) {
    minimizeComment(input: { subjectId: $subjectId, classifier: RESOLVED }) {
      minimizedComment {
        isMinimized
      }
    }
  }
`;

// -- Fetch helpers ------------------------------------------------------------

/** Fetches all review threads for a PR, paginating as needed. */
async function fetchAllReviewThreads(
  client: GraphQLClient,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<ReviewThread[]> {
  const allThreads: ReviewThread[] = [];
  let cursor: string | null = null;

  for (;;) {
    const response: ReviewThreadsResponse =
      await client.graphql<ReviewThreadsResponse>(REVIEW_THREADS_QUERY, {
        owner,
        repo,
        number: prNumber,
        cursor,
      });
    const connection = response.repository.pullRequest.reviewThreads;
    allThreads.push(...connection.nodes);
    if (!connection.pageInfo.hasNextPage) break;
    cursor = connection.pageInfo.endCursor;
  }

  return allThreads;
}

/** Fetches all reviews for a PR, paginating as needed. */
async function fetchAllReviews(
  client: GraphQLClient,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<PullRequestReviewNode[]> {
  const allReviews: PullRequestReviewNode[] = [];
  let cursor: string | null = null;

  for (;;) {
    const response: ReviewsResponse =
      await client.graphql<ReviewsResponse>(REVIEWS_QUERY, {
        owner,
        repo,
        number: prNumber,
        cursor,
      });
    const connection = response.repository.pullRequest.reviews;
    allReviews.push(...connection.nodes);
    if (!connection.pageInfo.hasNextPage) break;
    cursor = connection.pageInfo.endCursor;
  }

  return allReviews;
}

// -- Public API ---------------------------------------------------------------

/** Fetches all review threads and reviews for a PR, with full pagination. */
export async function fetchPullRequestData(
  client: GraphQLClient,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<{ threads: ReviewThread[]; reviews: PullRequestReviewNode[] }> {
  const [threads, reviews] = await Promise.all([
    fetchAllReviewThreads(client, owner, repo, prNumber),
    fetchAllReviews(client, owner, repo, prNumber),
  ]);
  return { threads, reviews };
}

/** Minimizes a review or comment by its node ID. */
export async function minimizeReview(
  client: GraphQLClient,
  subjectId: string,
): Promise<void> {
  await client.graphql(MINIMIZE_MUTATION, { subjectId });
}
