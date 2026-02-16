import { GraphQLClient } from "./types";
import { fetchReviewThreads, minimizeReview } from "./github";

function mockClient(
  response: unknown,
): GraphQLClient & { calls: Array<{ query: string; variables: unknown }> } {
  const calls: Array<{ query: string; variables: unknown }> = [];
  return {
    calls,
    graphql: jest.fn(async (query: string, variables?: unknown) => {
      calls.push({ query, variables });
      return response as never;
    }),
  };
}

describe("fetchReviewThreads", () => {
  it("passes owner, repo, and prNumber to the query", async () => {
    const client = mockClient({
      repository: {
        pullRequest: {
          reviewThreads: { nodes: [] },
        },
      },
    });

    await fetchReviewThreads(client, "my-org", "my-repo", 42);

    expect(client.calls).toHaveLength(1);
    expect(client.calls[0].variables).toEqual({
      owner: "my-org",
      repo: "my-repo",
      number: 42,
    });
  });

  it("returns the review thread nodes from the response", async () => {
    const threads = [
      {
        id: "t1",
        isResolved: true,
        comments: { nodes: [] },
      },
    ];

    const client = mockClient({
      repository: {
        pullRequest: {
          reviewThreads: { nodes: threads },
        },
      },
    });

    const result = await fetchReviewThreads(client, "o", "r", 1);
    expect(result).toEqual(threads);
  });
});

describe("minimizeReview", () => {
  it("sends the subject ID in the mutation", async () => {
    const client = mockClient({
      minimizeComment: { minimizedComment: { isMinimized: true } },
    });

    await minimizeReview(client, "PRR_123");

    expect(client.calls).toHaveLength(1);
    expect(client.calls[0].variables).toEqual({ subjectId: "PRR_123" });
  });

  it("includes the RESOLVED classifier in the mutation query", async () => {
    const client = mockClient({
      minimizeComment: { minimizedComment: { isMinimized: true } },
    });

    await minimizeReview(client, "PRR_123");

    expect(client.calls[0].query).toContain("classifier: RESOLVED");
  });

  it("propagates errors from the client", async () => {
    const client: GraphQLClient = {
      graphql: jest.fn(async () => {
        throw new Error("GraphQL error");
      }),
    };

    await expect(minimizeReview(client, "PRR_123")).rejects.toThrow(
      "GraphQL error",
    );
  });
});
