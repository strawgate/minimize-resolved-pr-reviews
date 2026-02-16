# Developing

## Prerequisites

- Node.js 20+
- Docker (for testing the container build)

## Setup

```bash
make install
```

## Project Structure

```
src/
  types.ts        # Shared interfaces (API types, business logic types, GraphQLClient)
  reviews.ts      # Pure business logic (groupThreadsByReview, findCommentsToMinimize)
  github.ts       # Thin GraphQL API wrappers (fetchReviewThreads, minimizeComment)
  index.ts        # Entry point -- reads action inputs, orchestrates the above
  reviews.test.ts # Tests for reviews.ts
  github.test.ts  # Tests for github.ts
action.yml        # GitHub Action definition (uses Docker)
Dockerfile        # Builds and runs the action in a container
```

The core logic lives in `reviews.ts` and has zero dependencies on GitHub APIs or `@actions/*`. It takes plain objects in and returns plain data out, making it trivially testable.

The API layer in `github.ts` accepts a `GraphQLClient` interface rather than a concrete Octokit instance, so tests can pass a simple mock object.

## Common Commands

All common tasks are available via `make`:

```bash
make install      # Install dependencies
make build        # Build with ncc
make test         # Run tests
make lint         # Run ESLint
make format       # Run Prettier
make docker-build # Build the Docker image locally
make pre-commit   # Run lint + test (use before committing)
make clean        # Remove build artifacts
```

Or use npm directly:

```bash
npm run build
npm test
npm run lint
npm run format
```

## How the Docker Build Works

The action runs as a Docker container on GitHub Actions. When the action is triggered:

1. GitHub builds the image from the `Dockerfile` in the repo
2. The Dockerfile installs dependencies, compiles TypeScript with `ncc`, and runs the bundled JS
3. No compiled output is committed to the repo -- `dist/` is in `.gitignore`

To test the Docker build locally:

```bash
make docker-build
```

## Environment / GitHub Token

Unit tests use mocked GraphQL clients and **do not require a GitHub token**.

If you want to manually test against a real PR (e.g. for integration testing), create a `.env` file in the project root:

```bash
GITHUB_TOKEN=ghp_your_token_here
```

This file is in `.gitignore` and will never be committed. You can generate a token at [github.com/settings/tokens](https://github.com/settings/tokens) with `repo` scope.

The action itself receives its token via the `github-token` input at runtime, so `.env` is purely for local development convenience.

## Architecture Decisions

**Why Docker instead of pre-built JS?** JavaScript GitHub Actions traditionally require committing a bundled `dist/` folder (often 30,000+ lines of compiled output). Using a Docker container means we only commit source code. The trade-off is ~10-20 seconds of container build time per run, which is negligible for a PR-event-triggered action.

**Why split reviews.ts from github.ts?** The business logic in `reviews.ts` is pure -- no I/O, no side effects. This makes it easy to test exhaustively with plain objects. The API wrappers in `github.ts` are intentionally thin so there's minimal logic to mock.
