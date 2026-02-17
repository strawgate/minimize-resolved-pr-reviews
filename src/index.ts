import * as core from "@actions/core";
import * as github from "@actions/github";
import { buildReviewList, findReviewsToMinimize } from "./reviews";
import { fetchPullRequestData, minimizeReview } from "./github";

async function run(): Promise<void> {
  try {
    const token = core.getInput("github-token", { required: true });
    const usersInput = core.getInput("users");
    const allowedUsers = usersInput
      ? usersInput
          .split(",")
          .map((u: string) => u.trim())
          .filter((u: string) => u.length > 0)
      : [];

    core.info(
      `Allowed users: ${allowedUsers.length > 0 ? allowedUsers.join(", ") : "all users"}`,
    );

    const context = github.context;
    const owner = context.repo.owner;
    const repo = context.repo.repo;

    // Extract PR number from whichever event triggered the action
    const prNumber =
      context.payload.pull_request?.number ??
      context.payload.issue?.number;

    if (!prNumber) {
      core.setFailed(
        "Could not determine PR number. " +
          "This action must be triggered by a pull_request, pull_request_review, " +
          "pull_request_review_comment, or issue_comment event.",
      );
      return;
    }

    core.info(`Processing PR #${prNumber} in ${owner}/${repo}`);

    const octokit = github.getOctokit(token);

    const { threads, reviews: rawReviews } = await fetchPullRequestData(
      octokit,
      owner,
      repo,
      prNumber,
    );
    core.info(
      `Found ${threads.length} review threads across ${rawReviews.length} reviews`,
    );

    const reviews = buildReviewList(threads, rawReviews);
    const authors = new Set(reviews.map((r) => r.author));
    core.info(`Found ${reviews.length} reviews from ${authors.size} users`);

    const reviewIds = findReviewsToMinimize(reviews, allowedUsers);
    core.info(`Found ${reviewIds.length} reviews to minimize`);

    let minimizedCount = 0;
    let failedCount = 0;

    for (const reviewId of reviewIds) {
      try {
        await minimizeReview(octokit, reviewId);
        minimizedCount++;
        core.debug(`Minimized review ${reviewId}`);
      } catch (error) {
        failedCount++;
        core.warning(`Failed to minimize review ${reviewId}: ${error}`);
      }
    }

    core.info(
      `Done: minimized ${minimizedCount} reviews, ${failedCount} failed`,
    );
    core.setOutput("minimized-count", minimizedCount);
    core.setOutput("failed-count", failedCount);
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed("An unknown error occurred");
    }
  }
}

run();
