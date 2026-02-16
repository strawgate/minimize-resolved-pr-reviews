#!/usr/bin/env bash
set -euo pipefail

# Smoke test: creates a real PR, adds two rounds of review, resolves the older
# one, runs the action via Docker, and verifies the right comments got minimized.
#
# Required env:
#   GITHUB_TOKEN  - token with contents:write + pull-requests:write
#   GH_TOKEN      - same token (for gh CLI)
#   GITHUB_REPOSITORY - owner/repo
#   GITHUB_RUN_ID - unique run identifier (set automatically in Actions)

REPO="${GITHUB_REPOSITORY}"
OWNER="${REPO%%/*}"
REPO_NAME="${REPO##*/}"
BRANCH="smoke-test-${GITHUB_RUN_ID:-local-$(date +%s)}"
PR_NUMBER=""

# ---------------------------------------------------------------------------
# Cleanup -- always runs, even on failure
# ---------------------------------------------------------------------------
cleanup() {
  echo ""
  echo "=== Cleanup ==="
  if [ -n "$PR_NUMBER" ]; then
    gh pr close "$PR_NUMBER" --repo "$REPO" --delete-branch 2>/dev/null || true
  fi
  git push origin --delete "$BRANCH" 2>/dev/null || true
  echo "Done."
}
trap cleanup EXIT

# ---------------------------------------------------------------------------
# 1. Create a test branch and PR
# ---------------------------------------------------------------------------
echo "=== Creating test PR ==="

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git checkout -b "$BRANCH"

cat > smoke-test-file.txt << 'CONTENT'
line 1: hello world
line 2: foo bar
line 3: baz qux
line 4: testing
line 5: smoke test
CONTENT

git add smoke-test-file.txt
git commit -m "smoke test: add test file"
git push origin "$BRANCH"

PR_URL=$(gh pr create \
  --repo "$REPO" \
  --title "[CI] Smoke Test $BRANCH" \
  --body "Automated smoke test -- cleaned up automatically." \
  --base main \
  --head "$BRANCH")

PR_NUMBER=$(gh pr view "$PR_URL" --repo "$REPO" --json number -q .number)
echo "Created PR #$PR_NUMBER"

# ---------------------------------------------------------------------------
# 2. Submit review 1 (older) with two line comments
# ---------------------------------------------------------------------------
echo ""
echo "=== Submitting review 1 (older) ==="

gh api "repos/$REPO/pulls/$PR_NUMBER/reviews" \
  --method POST \
  --input - << 'JSON'
{
  "body": "Older review",
  "event": "COMMENT",
  "comments": [
    {
      "path": "smoke-test-file.txt",
      "line": 1,
      "side": "RIGHT",
      "body": "SMOKE_OLD_COMMENT_1"
    },
    {
      "path": "smoke-test-file.txt",
      "line": 2,
      "side": "RIGHT",
      "body": "SMOKE_OLD_COMMENT_2"
    }
  ]
}
JSON

echo "Review 1 submitted."

# Ensure review 2 gets a later timestamp
sleep 3

# ---------------------------------------------------------------------------
# 3. Resolve all review threads from review 1
# ---------------------------------------------------------------------------
echo ""
echo "=== Resolving threads from review 1 ==="

THREADS_QUERY='
query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      reviewThreads(first: 100) {
        nodes {
          id
          isResolved
        }
      }
    }
  }
}'

THREAD_IDS=$(gh api graphql \
  -f query="$THREADS_QUERY" \
  -f owner="$OWNER" \
  -f repo="$REPO_NAME" \
  -F number="$PR_NUMBER" \
  --jq '.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved == false) | .id')

RESOLVED_COUNT=0
for THREAD_ID in $THREAD_IDS; do
  gh api graphql \
    -f query='mutation($id: ID!) { resolveReviewThread(input: { threadId: $id }) { thread { isResolved } } }' \
    -f id="$THREAD_ID" \
    --silent
  RESOLVED_COUNT=$((RESOLVED_COUNT + 1))
done
echo "Resolved $RESOLVED_COUNT threads."

# ---------------------------------------------------------------------------
# 4. Submit review 2 (newer) -- should be kept visible
# ---------------------------------------------------------------------------
echo ""
echo "=== Submitting review 2 (newer) ==="

gh api "repos/$REPO/pulls/$PR_NUMBER/reviews" \
  --method POST \
  --input - << 'JSON'
{
  "body": "Newer review",
  "event": "COMMENT",
  "comments": [
    {
      "path": "smoke-test-file.txt",
      "line": 4,
      "side": "RIGHT",
      "body": "SMOKE_NEW_COMMENT"
    }
  ]
}
JSON

echo "Review 2 submitted."

# ---------------------------------------------------------------------------
# 5. Run the action via Docker
# ---------------------------------------------------------------------------
echo ""
echo "=== Running action via Docker ==="

EVENT_FILE=$(mktemp)
cat > "$EVENT_FILE" << EOF
{"pull_request": {"number": $PR_NUMBER}}
EOF

docker run --rm \
  -e "INPUT_GITHUB-TOKEN=$GITHUB_TOKEN" \
  -e "GITHUB_REPOSITORY=$REPO" \
  -e "GITHUB_EVENT_NAME=pull_request" \
  -e "GITHUB_EVENT_PATH=/github/event.json" \
  -v "$EVENT_FILE:/github/event.json:ro" \
  minimize-resolved-pr-reviews

# ---------------------------------------------------------------------------
# 6. Verify results
# ---------------------------------------------------------------------------
echo ""
echo "=== Verifying results ==="

VERIFY_QUERY='
query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      reviews(first: 100) {
        nodes {
          id
          body
          isMinimized
          minimizedReason
        }
      }
    }
  }
}'

RESULT=$(gh api graphql \
  -f query="$VERIFY_QUERY" \
  -f owner="$OWNER" \
  -f repo="$REPO_NAME" \
  -F number="$PR_NUMBER")

REVIEWS_JSON='.data.repository.pullRequest.reviews.nodes[]'

# Count reviews to guard against vacuous-truth passes
OLD_COUNT=$(echo "$RESULT" | jq "[${REVIEWS_JSON} | select(.body == \"Older review\")] | length")
NEW_COUNT=$(echo "$RESULT" | jq "[${REVIEWS_JSON} | select(.body == \"Newer review\")] | length")

echo "Found $OLD_COUNT old reviews, $NEW_COUNT new reviews"

if [ "$OLD_COUNT" -lt 1 ]; then
  echo "FAIL: Expected at least 1 old review, found $OLD_COUNT"
  echo "$RESULT" | jq '.data.repository.pullRequest.reviews'
  exit 1
fi

if [ "$NEW_COUNT" -lt 1 ]; then
  echo "FAIL: Expected at least 1 new review, found $NEW_COUNT"
  echo "$RESULT" | jq '.data.repository.pullRequest.reviews'
  exit 1
fi

# Verify old review is minimized
OLD_MINIMIZED=$(echo "$RESULT" | jq "
  [${REVIEWS_JSON}
   | select(.body == \"Older review\")
   | .isMinimized] | all")

# Verify new review is NOT minimized
NEW_KEPT=$(echo "$RESULT" | jq "
  [${REVIEWS_JSON}
   | select(.body == \"Newer review\")
   | .isMinimized] | map(. == false) | all")

echo "Old review minimized: $OLD_MINIMIZED"
echo "New review kept visible: $NEW_KEPT"

if [ "$OLD_MINIMIZED" != "true" ]; then
  echo "FAIL: Old review should be minimized"
  echo "$RESULT" | jq '.data.repository.pullRequest.reviews'
  exit 1
fi

if [ "$NEW_KEPT" != "true" ]; then
  echo "FAIL: New review should NOT be minimized"
  echo "$RESULT" | jq '.data.repository.pullRequest.reviews'
  exit 1
fi

echo ""
echo "=== PASS ==="
