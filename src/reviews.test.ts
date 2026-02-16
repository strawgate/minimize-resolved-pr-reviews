import { ReviewThread, ReviewInfo } from "./types";
import { groupThreadsByReview, findReviewsToMinimize } from "./reviews";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

let idCounter = 0;
function nextId(prefix = "id"): string {
  return `${prefix}_${++idCounter}`;
}

beforeEach(() => {
  idCounter = 0;
});

/** Builds a ReviewThread with sensible defaults. */
function makeThread(opts: {
  threadId?: string;
  isResolved?: boolean;
  authorLogin?: string | null;
  reviewId?: string | null;
  reviewCreatedAt?: string;
  reviewIsMinimized?: boolean;
}): ReviewThread {
  return {
    id: opts.threadId ?? nextId("thread"),
    isResolved: opts.isResolved ?? false,
    comments: {
      nodes: [
        {
          author:
            opts.authorLogin === null
              ? null
              : { login: opts.authorLogin ?? "alice" },
          pullRequestReview:
            opts.reviewId === null
              ? null
              : {
                  id: opts.reviewId ?? "review_default",
                  createdAt:
                    opts.reviewCreatedAt ?? "2025-01-01T00:00:00Z",
                  isMinimized: opts.reviewIsMinimized ?? false,
                },
        },
      ],
    },
  };
}

/** Builds a ReviewInfo with sensible defaults. */
function makeReview(opts: {
  reviewId?: string;
  author?: string;
  createdAt?: string;
  isMinimized?: boolean;
  threads?: Array<{
    threadId?: string;
    isResolved?: boolean;
  }>;
}): ReviewInfo {
  return {
    reviewId: opts.reviewId ?? nextId("review"),
    author: opts.author ?? "alice",
    createdAt: opts.createdAt ?? "2025-01-01T00:00:00Z",
    isMinimized: opts.isMinimized ?? false,
    threads: (opts.threads ?? []).map((t) => ({
      threadId: t.threadId ?? nextId("thread"),
      isResolved: t.isResolved ?? true,
    })),
  };
}

// ---------------------------------------------------------------------------
// groupThreadsByReview
// ---------------------------------------------------------------------------

describe("groupThreadsByReview", () => {
  it("groups threads by their parent review ID", () => {
    const threads = [
      makeThread({ threadId: "t1", reviewId: "r1" }),
      makeThread({ threadId: "t2", reviewId: "r1" }),
      makeThread({
        threadId: "t3",
        reviewId: "r2",
        reviewCreatedAt: "2025-01-02T00:00:00Z",
      }),
    ];

    const reviews = groupThreadsByReview(threads);

    expect(reviews).toHaveLength(2);

    const r1 = reviews.find((r) => r.reviewId === "r1")!;
    expect(r1.threads).toHaveLength(2);
    expect(r1.threads.map((t) => t.threadId)).toEqual(["t1", "t2"]);

    const r2 = reviews.find((r) => r.reviewId === "r2")!;
    expect(r2.threads).toHaveLength(1);
    expect(r2.threads[0].threadId).toBe("t3");
  });

  it("extracts author and createdAt from the first comment", () => {
    const threads = [
      makeThread({
        authorLogin: "bob",
        reviewId: "r1",
        reviewCreatedAt: "2025-06-15T12:00:00Z",
      }),
    ];

    const reviews = groupThreadsByReview(threads);

    expect(reviews).toHaveLength(1);
    expect(reviews[0].author).toBe("bob");
    expect(reviews[0].createdAt).toBe("2025-06-15T12:00:00Z");
  });

  it("extracts isMinimized from the review", () => {
    const threads = [
      makeThread({ reviewId: "r1", reviewIsMinimized: true }),
    ];

    const reviews = groupThreadsByReview(threads);
    expect(reviews[0].isMinimized).toBe(true);
  });

  it("skips threads with no author on the first comment", () => {
    const threads = [makeThread({ authorLogin: null, reviewId: "r1" })];
    expect(groupThreadsByReview(threads)).toEqual([]);
  });

  it("skips threads with no pullRequestReview on the first comment", () => {
    const threads = [makeThread({ authorLogin: "alice", reviewId: null })];
    expect(groupThreadsByReview(threads)).toEqual([]);
  });

  it("skips threads with an empty comments array", () => {
    const thread: ReviewThread = {
      id: "t1",
      isResolved: true,
      comments: { nodes: [] },
    };
    expect(groupThreadsByReview([thread])).toEqual([]);
  });

  it("preserves isResolved on thread info", () => {
    const threads = [
      makeThread({ isResolved: true, reviewId: "r1" }),
    ];

    const reviews = groupThreadsByReview(threads);
    expect(reviews[0].threads[0].isResolved).toBe(true);
  });

  it("returns empty array for empty input", () => {
    expect(groupThreadsByReview([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// findReviewsToMinimize
// ---------------------------------------------------------------------------

describe("findReviewsToMinimize", () => {
  it("minimizes older fully-resolved reviews, keeps the most recent", () => {
    const reviews = [
      makeReview({
        reviewId: "r1",
        createdAt: "2025-01-01T00:00:00Z",
        threads: [{ isResolved: true }],
      }),
      makeReview({
        reviewId: "r2",
        createdAt: "2025-01-02T00:00:00Z",
        threads: [{ isResolved: false }],
      }),
    ];

    expect(findReviewsToMinimize(reviews, [])).toEqual(["r1"]);
  });

  it("does not minimize the most recent review even if fully resolved", () => {
    const reviews = [
      makeReview({
        reviewId: "r1",
        createdAt: "2025-01-01T00:00:00Z",
        threads: [{ isResolved: true }],
      }),
    ];

    expect(findReviewsToMinimize(reviews, [])).toEqual([]);
  });

  it("does not minimize older reviews that have unresolved threads", () => {
    const reviews = [
      makeReview({
        reviewId: "r1",
        createdAt: "2025-01-01T00:00:00Z",
        threads: [{ isResolved: true }, { isResolved: false }],
      }),
      makeReview({
        reviewId: "r2",
        createdAt: "2025-01-02T00:00:00Z",
        threads: [{ isResolved: true }],
      }),
    ];

    expect(findReviewsToMinimize(reviews, [])).toEqual([]);
  });

  it("skips already-minimized reviews", () => {
    const reviews = [
      makeReview({
        reviewId: "r1",
        createdAt: "2025-01-01T00:00:00Z",
        isMinimized: true,
        threads: [{ isResolved: true }],
      }),
      makeReview({
        reviewId: "r2",
        createdAt: "2025-01-02T00:00:00Z",
        threads: [{ isResolved: false }],
      }),
    ];

    expect(findReviewsToMinimize(reviews, [])).toEqual([]);
  });

  it("handles multiple authors independently", () => {
    const reviews = [
      makeReview({
        reviewId: "alice_r1",
        author: "alice",
        createdAt: "2025-01-01T00:00:00Z",
        threads: [{ isResolved: true }],
      }),
      makeReview({
        reviewId: "alice_r2",
        author: "alice",
        createdAt: "2025-01-02T00:00:00Z",
        threads: [{ isResolved: false }],
      }),
      makeReview({
        reviewId: "bob_r1",
        author: "bob",
        createdAt: "2025-01-01T00:00:00Z",
        threads: [{ isResolved: true }],
      }),
      makeReview({
        reviewId: "bob_r2",
        author: "bob",
        createdAt: "2025-01-02T00:00:00Z",
        threads: [{ isResolved: true }],
      }),
    ];

    const result = findReviewsToMinimize(reviews, []);

    expect(result).toContain("alice_r1");
    expect(result).toContain("bob_r1");
    expect(result).not.toContain("alice_r2");
    expect(result).not.toContain("bob_r2");
  });

  it("respects allowedUsers filter", () => {
    const reviews = [
      makeReview({
        reviewId: "alice_r1",
        author: "alice",
        createdAt: "2025-01-01T00:00:00Z",
        threads: [{ isResolved: true }],
      }),
      makeReview({
        reviewId: "alice_r2",
        author: "alice",
        createdAt: "2025-01-02T00:00:00Z",
        threads: [],
      }),
      makeReview({
        reviewId: "bob_r1",
        author: "bob",
        createdAt: "2025-01-01T00:00:00Z",
        threads: [{ isResolved: true }],
      }),
      makeReview({
        reviewId: "bob_r2",
        author: "bob",
        createdAt: "2025-01-02T00:00:00Z",
        threads: [],
      }),
    ];

    const result = findReviewsToMinimize(reviews, ["alice"]);

    expect(result).toContain("alice_r1");
    expect(result).not.toContain("bob_r1");
  });

  it("treats empty allowedUsers as all users", () => {
    const reviews = [
      makeReview({
        reviewId: "r1",
        createdAt: "2025-01-01T00:00:00Z",
        threads: [{ isResolved: true }],
      }),
      makeReview({
        reviewId: "r2",
        createdAt: "2025-01-02T00:00:00Z",
        threads: [],
      }),
    ];

    expect(findReviewsToMinimize(reviews, [])).toEqual(["r1"]);
  });

  it("handles three reviews: minimizes oldest two if resolved", () => {
    const reviews = [
      makeReview({
        reviewId: "r1",
        createdAt: "2025-01-01T00:00:00Z",
        threads: [{ isResolved: true }],
      }),
      makeReview({
        reviewId: "r2",
        createdAt: "2025-01-02T00:00:00Z",
        threads: [{ isResolved: true }],
      }),
      makeReview({
        reviewId: "r3",
        createdAt: "2025-01-03T00:00:00Z",
        threads: [{ isResolved: false }],
      }),
    ];

    const result = findReviewsToMinimize(reviews, []);

    expect(result).toContain("r1");
    expect(result).toContain("r2");
    expect(result).not.toContain("r3");
  });

  it("returns empty array when no reviews are provided", () => {
    expect(findReviewsToMinimize([], [])).toEqual([]);
  });
});
