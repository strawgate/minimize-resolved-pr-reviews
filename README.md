# Minimize Resolved PR Reviews

A GitHub Action that automatically minimizes resolved review comments in pull requests. When a reviewer submits multiple rounds of review, older reviews where every thread has been resolved are minimized, keeping your PR conversations focused on what still needs attention.

## How It Works

1. Fetches all review threads for the pull request
2. Groups threads by their parent review
3. For each reviewer, identifies their most recent review and always keeps it visible
4. Older reviews where **all** threads are resolved are minimized (the entire review has been addressed)
5. Older reviews with any unresolved threads are left alone

## Usage

### Basic

```yaml
name: Minimize Resolved Reviews
on:
  pull_request_review:
    types: [submitted]
  pull_request_review_comment:
    types: [created, edited]

permissions:
  pull-requests: write

jobs:
  minimize:
    runs-on: ubuntu-latest
    steps:
      - name: Minimize resolved review threads
        uses: strawgate/minimize-resolved-pr-reviews@v0
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

### With `/tidy` Comment Trigger

Allow maintainers to manually trigger minimization by commenting `/tidy` on a PR:

```yaml
name: Minimize Resolved Reviews
on:
  pull_request_review:
    types: [submitted]
  pull_request_review_comment:
    types: [created, edited]
  issue_comment:
    types: [created]

permissions:
  pull-requests: write

jobs:
  minimize:
    runs-on: ubuntu-latest
    if: >-
      github.event_name != 'issue_comment' || (
        contains(github.event.comment.body, '/tidy') &&
        github.event.issue.pull_request &&
        contains(fromJSON('["OWNER","MEMBER","COLLABORATOR"]'), github.event.comment.author_association)
      )
    steps:
      - name: Minimize resolved review threads
        uses: strawgate/minimize-resolved-pr-reviews@v0
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

### With User Filtering

Only minimize reviews from specific users (e.g. bots):

```yaml
      - name: Minimize resolved review threads
        uses: strawgate/minimize-resolved-pr-reviews@v0
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
| `minimized-count` | Number of reviews that were minimized |
| `failed-count` | Number of reviews that failed to minimize |

## Permissions

```yaml
permissions:
  pull-requests: write
```

## License

MIT
