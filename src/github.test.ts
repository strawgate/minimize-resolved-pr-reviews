import { GraphQLClient } from "./types";
import { fetchPullRequestData, minimizeReview } from "./github";

/** Creates a mock client that returns responses in sequence. */
function mockClient(
  ...responses: unknown[]
): GraphQLClient & { calls: Array<{ query: string; variables: unknown }> } {
  const calls: Array<{ query: string; variables: unknown }> = [];
  let callIndex = 0;
  return {
    calls,
    graphql: jest.fn(async (query: string, variables?: unknown) => {
      calls.push({ query, variables });
      const response = responses[callIndex] ?? responses[responses.length - 1];
      callIndex++;
      return response as never;
    }),
  };
}

// Helpers to build paginated response shapes
const noMorePages = { hasNextPage: false, endCursor: null as string | null };
const morePagesAfter = (cursor: string) => ({
  hasNextPage: true,
  endCursor: cursor as string | null,
});

function threadsResponse(
  nodes: unknown[],
  pageInfo = noMorePages,
) {
  return {
    repository: {
      pullRequest: {
        reviewThreads: { pageInfo, nodes },
      },
    },
  };
}

function reviewsResponse(
  nodes: unknown[],
  pageInfo = noMorePages,
) {
  return {
    repository: {
      pullRequest: {
        reviews: { pageInfo, nodes },
      },
    },
  };
}

describe("fetchPullRequestData", () => {
  it("passes owner, repo, and prNumber to both queries", async () => {
    const client = mockClient(
      threadsResponse([]),
      reviewsResponse([]),
    );

    await fetchPullRequestData(client, "my-org", "my-repo", 42);

    // Two parallel calls: one for threads, one for reviews
    expect(client.calls).toHaveLength(2);
    for (const call of client.calls) {
      expect(call.variables).toMatchObject({
        owner: "my-org",
        repo: "my-repo",
        number: 42,
      });
    }
  });

  it("returns both threads and reviews from a single page", async () => {
    const threads = [
      { id: "t1", isResolved: true, comments: { nodes: [] } },
    ];
    const reviews = [
      {
        id: "r1",
        author: { login: "alice" },
        createdAt: "2025-01-01T00:00:00Z",
        isMinimized: false,
      },
    ];

    const client = mockClient(
      threadsResponse(threads),
      reviewsResponse(reviews),
    );

    const result = await fetchPullRequestData(client, "o", "r", 1);
    expect(result.threads).toEqual(threads);
    expect(result.reviews).toEqual(reviews);
  });

  it("paginates review threads across multiple pages", async () => {
    const calls: Array<{ query: string; variables: unknown }> = [];
    let callIndex = 0;

    // The mock needs to distinguish between the threads query and reviews query
    const responses = [
      // First threads page
      threadsResponse(
        [{ id: "t1", isResolved: true, comments: { nodes: [] } }],
        morePagesAfter("cursor1"),
      ),
      // Reviews (single page, runs in parallel with first threads call)
      reviewsResponse([
        {
          id: "r1",
          author: { login: "alice" },
          createdAt: "2025-01-01T00:00:00Z",
          isMinimized: false,
        },
      ]),
      // Second threads page
      threadsResponse([
        { id: "t2", isResolved: false, comments: { nodes: [] } },
      ]),
    ];

    const client: GraphQLClient & {
      calls: Array<{ query: string; variables: unknown }>;
    } = {
      calls,
      graphql: jest.fn(async (query: string, variables?: unknown) => {
        calls.push({ query, variables });
        const resp = responses[callIndex++];
        return resp as never;
      }),
    };

    const result = await fetchPullRequestData(client, "o", "r", 1);

    expect(result.threads).toHaveLength(2);
    expect(result.threads.map((t) => t.id)).toEqual(["t1", "t2"]);
    expect(result.reviews).toHaveLength(1);

    // Third call should have the cursor from page 1
    const threadCalls = calls.filter((c) =>
      c.query.includes("reviewThreads"),
    );
    expect(threadCalls).toHaveLength(2);
    expect(threadCalls[0].variables).toMatchObject({ cursor: null });
    expect(threadCalls[1].variables).toMatchObject({ cursor: "cursor1" });
  });

  it("paginates reviews across multiple pages", async () => {
    const calls: Array<{ query: string; variables: unknown }> = [];
    let callIndex = 0;

    const responses = [
      // Threads (single page)
      threadsResponse([]),
      // First reviews page
      reviewsResponse(
        [
          {
            id: "r1",
            author: { login: "alice" },
            createdAt: "2025-01-01T00:00:00Z",
            isMinimized: false,
          },
        ],
        morePagesAfter("rcursor1"),
      ),
      // Second reviews page
      reviewsResponse([
        {
          id: "r2",
          author: { login: "bob" },
          createdAt: "2025-01-02T00:00:00Z",
          isMinimized: false,
        },
      ]),
    ];

    const client: GraphQLClient & {
      calls: Array<{ query: string; variables: unknown }>;
    } = {
      calls,
      graphql: jest.fn(async (query: string, variables?: unknown) => {
        calls.push({ query, variables });
        return responses[callIndex++] as never;
      }),
    };

    const result = await fetchPullRequestData(client, "o", "r", 1);

    expect(result.threads).toHaveLength(0);
    expect(result.reviews).toHaveLength(2);
    expect(result.reviews.map((r) => r.id)).toEqual(["r1", "r2"]);

    const reviewCalls = calls.filter((c) =>
      c.query.includes("reviews("),
    );
    expect(reviewCalls).toHaveLength(2);
    expect(reviewCalls[0].variables).toMatchObject({ cursor: null });
    expect(reviewCalls[1].variables).toMatchObject({ cursor: "rcursor1" });
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
