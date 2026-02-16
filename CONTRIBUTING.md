# Contributing

Contributions are welcome! Here's what we expect.

## Before You Start

- Open an issue first for non-trivial changes so we can discuss the approach
- Fork the repo and create a branch from `main`

## Requirements for Pull Requests

### Tests

All PRs must include tests for new or changed behavior. The business logic in `reviews.ts` is pure and should be tested with plain objects -- no mocking required.

```bash
make test
```

### Linting and Formatting

Code must pass lint and formatting checks. Run both before committing:

```bash
make pre-commit
```

This runs ESLint and the test suite. You can also run them individually:

```bash
make lint
make format
```

### Commit Messages

- Use clear, descriptive commit messages
- Focus on the "why" rather than the "what"

## Code Style

- TypeScript strict mode is enabled
- Business logic belongs in `src/reviews.ts` (pure, no I/O)
- API calls belong in `src/github.ts` (thin wrappers around `GraphQLClient`)
- `src/index.ts` is the orchestrator -- keep it minimal

## Running Locally

See [DEVELOPING.md](DEVELOPING.md) for setup instructions, project structure, and environment configuration.
