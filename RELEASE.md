# Releasing

## Quick Release

```bash
make release-patch   # v0.1.0 -> v0.1.1
make release-minor   # v0.1.1 -> v0.2.0
make release-major   # v0.2.0 -> v1.0.0
```

Each command bumps the version in `package.json`, creates a commit and git tag, then pushes both. The [release workflow](.github/workflows/release.yml) takes over from there.

## What Happens Automatically

When a semver tag (`v0.1.0`) is pushed, the release workflow:

1. Creates a GitHub Release with auto-generated release notes
2. Updates the floating major tag (`v0`) to point to the new release
3. Updates the floating minor tag (`v0.1`) to point to the new release

## How Users Reference the Action

```yaml
# Floating major -- gets all updates (recommended)
uses: strawgate/minimize-resolved-pr-reviews@v0

# Floating minor -- gets patches only
uses: strawgate/minimize-resolved-pr-reviews@v0.1

# Pinned -- exact version, never changes
uses: strawgate/minimize-resolved-pr-reviews@v0.1.0
```

## When to Use Each Bump

- **patch**: Bug fixes, documentation changes, internal refactoring
- **minor**: New features, new inputs/outputs (backwards compatible)
- **major**: Breaking changes to inputs, outputs, or behavior

## Pre-Release Checklist

1. Make sure you're on `main` with a clean working tree
2. Run `make pre-commit` to verify lint, format, and tests pass
3. Run `make release-patch` (or `minor`/`major`)
