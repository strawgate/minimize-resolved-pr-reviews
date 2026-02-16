import * as core from '@actions/core';
import * as github from '@actions/github';

interface ReviewThread {
  id: string;
  isResolved: boolean;
  isCollapsed: boolean;
  comments: {
    nodes: Array<{
      author: {
        login: string;
      };
      createdAt: string;
    }>;
  };
}

interface Review {
  id: string;
  author: {
    login: string;
  };
  createdAt: string;
}

interface PullRequest {
  reviewThreads: {
    nodes: ReviewThread[];
  };
  reviews: {
    nodes: Review[];
  };
}

async function run(): Promise<void> {
  try {
    // Get inputs
    const token = core.getInput('github-token', { required: true });
    const usersInput = core.getInput('users');
    const allowedUsers = usersInput
      ? usersInput.split(',').map(u => u.trim()).filter(u => u.length > 0)
      : [];

    core.info(`Allowed users: ${allowedUsers.length > 0 ? allowedUsers.join(', ') : 'all users'}`);

    // Get PR context
    const context = github.context;
    if (!context.payload.pull_request) {
      core.setFailed('This action can only be run on pull request events');
      return;
    }

    const pullRequestNumber = context.payload.pull_request.number;
    const owner = context.repo.owner;
    const repo = context.repo.repo;

    core.info(`Processing PR #${pullRequestNumber} in ${owner}/${repo}`);

    // Initialize Octokit
    const octokit = github.getOctokit(token);

    // Query PR review threads and reviews using GraphQL
    const query = `
      query($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          pullRequest(number: $number) {
            reviewThreads(first: 100) {
              nodes {
                id
                isResolved
                isCollapsed
                comments(first: 100) {
                  nodes {
                    id
                    author {
                      login
                    }
                    createdAt
                  }
                }
              }
            }
            reviews(first: 100) {
              nodes {
                id
                author {
                  login
                }
                createdAt
              }
            }
          }
        }
      }
    `;

    const response: any = await octokit.graphql(query, {
      owner,
      repo,
      number: pullRequestNumber,
    });

    const pullRequest: PullRequest = response.repository.pullRequest;
    const reviewThreads = pullRequest.reviewThreads.nodes;
    const reviews = pullRequest.reviews.nodes;

    core.info(`Found ${reviewThreads.length} review threads and ${reviews.length} reviews`);

    // Find the most recent review from each user
    const mostRecentReviewsByUser = new Map<string, string>();
    
    for (const review of reviews) {
      if (!review.author) continue;
      
      const username = review.author.login;
      const existingReview = mostRecentReviewsByUser.get(username);
      
      if (!existingReview || new Date(review.createdAt) > new Date(existingReview)) {
        mostRecentReviewsByUser.set(username, review.createdAt);
      }
    }

    core.info(`Found most recent reviews from ${mostRecentReviewsByUser.size} users`);

    // Process review threads
    let minimizedCount = 0;
    let skippedCount = 0;

    for (const thread of reviewThreads) {
      // Skip if already collapsed
      if (thread.isCollapsed) {
        core.debug(`Thread ${thread.id} is already collapsed, skipping`);
        continue;
      }

      // Skip if not resolved
      if (!thread.isResolved) {
        core.debug(`Thread ${thread.id} is not resolved, skipping`);
        continue;
      }

      // Get the thread author (first comment author)
      const firstComment = thread.comments.nodes[0];
      if (!firstComment || !firstComment.author) {
        core.debug(`Thread ${thread.id} has no valid author, skipping`);
        continue;
      }

      const threadAuthor = firstComment.author.login;

      // Check if user is in allowed list (if specified)
      if (allowedUsers.length > 0 && !allowedUsers.includes(threadAuthor)) {
        core.debug(`Thread ${thread.id} author ${threadAuthor} not in allowed list, skipping`);
        skippedCount++;
        continue;
      }

      // Check if this is the most recent review from the user
      const mostRecentReviewDate = mostRecentReviewsByUser.get(threadAuthor);
      if (!mostRecentReviewDate) {
        core.debug(`Thread ${thread.id} author ${threadAuthor} has no reviews, skipping`);
        skippedCount++;
        continue;
      }

      const threadDate = new Date(firstComment.createdAt);
      const mostRecentDate = new Date(mostRecentReviewDate);

      if (threadDate >= mostRecentDate) {
        core.info(`Thread ${thread.id} from ${threadAuthor} is the most recent review, skipping`);
        skippedCount++;
        continue;
      }

      // Minimize the thread
      core.info(`Minimizing resolved thread ${thread.id} from ${threadAuthor}`);
      
      try {
        const minimizeMutation = `
          mutation($subjectId: ID!) {
            minimizeComment(input: { subjectId: $subjectId, classifier: RESOLVED }) {
              minimizedComment {
                isMinimized
              }
            }
          }
        `;

        await octokit.graphql(minimizeMutation, {
          subjectId: thread.id,
        });

        minimizedCount++;
        core.info(`Successfully minimized thread ${thread.id}`);
      } catch (error) {
        core.warning(`Failed to minimize thread ${thread.id}: ${error}`);
      }
    }

    core.info(`Summary: Minimized ${minimizedCount} threads, skipped ${skippedCount} threads`);
    core.setOutput('minimized-count', minimizedCount);
    core.setOutput('skipped-count', skippedCount);
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unknown error occurred');
    }
  }
}

run();
