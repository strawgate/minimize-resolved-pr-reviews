# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |

## Known Issues

### Moderate Vulnerability in Undici (Transitive Dependency)

**Status**: Acknowledged - Waiting for upstream fix

**Description**: The action uses `@actions/core` and `@actions/github` packages from GitHub, which depend on `undici` < 6.23.0. This version has a known moderate severity vulnerability (GHSA-g9mf-h72j-4rw9) related to unbounded decompression chains in HTTP responses.

**Impact**: The vulnerability could lead to resource exhaustion through specially crafted HTTP responses. However:
- This action runs in GitHub Actions environments with resource limits
- The action only communicates with the GitHub GraphQL API using authenticated requests
- The risk is minimal in the intended use case

**Resolution**: This will be automatically resolved when GitHub updates their action packages to use newer versions of undici. We're tracking updates to `@actions/core` and `@actions/github` packages.

**Reference**: https://github.com/advisories/GHSA-g9mf-h72j-4rw9

## Reporting a Vulnerability

If you discover a security vulnerability, please report it by creating a private security advisory on GitHub:

1. Go to the repository's Security tab
2. Click "Report a vulnerability"
3. Provide a detailed description of the vulnerability
4. Include steps to reproduce if possible

We will respond to security reports within 48 hours and will work to release a fix as quickly as possible.
