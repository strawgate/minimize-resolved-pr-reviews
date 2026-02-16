# Minimize Resolved PR Reviews

A GitHub Action that automatically minimizes resolved review threads in pull requests. This action uses the GitHub GraphQL API to identify review threads where all comments have been resolved and minimizes them, keeping your PR conversations clean and focused on unresolved issues.

## Features

- 🔍 **Smart Detection**: Identifies review threads where all comments are resolved
- 🎯 **User Filtering**: Configure specific users whose reviews should be minimized
- ⏱️ **Recent Review Protection**: Never minimizes the most recent review from each user
- 🔒 **Safe**: Only minimizes threads that are already resolved
- 📊 **Detailed Logging**: Provides clear output about what was minimized and what was skipped

## Usage

### Basic Example

```yaml
name: Minimize Resolved Reviews
on:
  pull_request_review:
    types: [submitted]
  pull_request_review_comment:
    types: [created, edited]

jobs:
  minimize:
    runs-on: ubuntu-latest
    steps:
      - name: Minimize resolved review threads
        uses: strawgate/minimize-resolved-pr-reviews@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

### With User Filtering

```yaml
name: Minimize Resolved Reviews
on:
  pull_request_review:
    types: [submitted]
  pull_request_review_comment:
    types: [created, edited]

jobs:
  minimize:
    runs-on: ubuntu-latest
    steps:
      - name: Minimize resolved review threads
        uses: strawgate/minimize-resolved-pr-reviews@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          users: 'dependabot,renovate,github-actions'
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `github-token` | GitHub token with permissions to read and write PR reviews | Yes | `${{ github.token }}` |
| `users` | Comma-separated list of usernames whose reviews should be considered for minimization. Leave empty to consider all users. | No | `''` (all users) |

## Outputs

| Output | Description |
|--------|-------------|
| `minimized-count` | Number of review threads that were minimized |
| `skipped-count` | Number of review threads that were skipped |

## Behavior

The action will:

1. Fetch all review threads and reviews for the current pull request
2. Identify threads where all comments are resolved
3. For each resolved thread:
   - Skip if already minimized
   - Skip if the thread author is not in the allowed users list (if specified)
   - Skip if it's the most recent review from that user
   - Otherwise, minimize the thread

This ensures that:
- Only resolved threads are minimized
- The most recent activity from each reviewer remains visible
- You can control which users' reviews are affected

## Permissions

The action requires the following permissions in your workflow:

```yaml
permissions:
  pull-requests: write
  contents: read
```

## Example Workflow

Here's a complete example that runs whenever a review is submitted or a review comment is created/edited:

```yaml
name: Clean Up PR Reviews

on:
  pull_request_review:
    types: [submitted]
  pull_request_review_comment:
    types: [created, edited]

permissions:
  pull-requests: write
  contents: read

jobs:
  minimize-resolved-reviews:
    runs-on: ubuntu-latest
    name: Minimize resolved review threads
    steps:
      - name: Minimize resolved threads
        uses: strawgate/minimize-resolved-pr-reviews@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          users: 'dependabot,renovate'
```

## Development

### Setup

```bash
npm install
```

### Build

```bash
npm run build
```

### Lint

```bash
npm run lint
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.