import { GraphQLClient, ReviewThread } from "./types";

interface ReviewThreadsResponse {
  repository: {
    pullRequest: {
      reviewThreads: {
        nodes: ReviewThread[];
      };
    };
  };
}

const REVIEW_THREADS_QUERY = `
  query($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        reviewThreads(first: 100) {
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

const MINIMIZE_MUTATION = `
  mutation($subjectId: ID!) {
    minimizeComment(input: { subjectId: $subjectId, classifier: RESOLVED }) {
      minimizedComment {
        isMinimized
      }
    }
  }
`;

/** Fetches all review threads for a PR. */
export async function fetchReviewThreads(
  client: GraphQLClient,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<ReviewThread[]> {
  const response = await client.graphql<ReviewThreadsResponse>(
    REVIEW_THREADS_QUERY,
    { owner, repo, number: prNumber },
  );
  return response.repository.pullRequest.reviewThreads.nodes;
}

/** Minimizes a review or comment by its node ID. */
export async function minimizeReview(
  client: GraphQLClient,
  subjectId: string,
): Promise<void> {
  await client.graphql(MINIMIZE_MUTATION, { subjectId });
}
