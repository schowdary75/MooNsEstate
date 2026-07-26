# Contributing to MooNsEstate

Thank you for helping improve MooNsEstate. Repository access is private and must
not be shared with anyone who has not been explicitly authorized.

## Before you start

1. Search existing issues and pull requests.
2. Open an issue for a bug, security-neutral proposal, or sizable change.
3. For a vulnerability, stop and follow [SECURITY.md](SECURITY.md).
4. Fork privately or create a branch in your authorized clone.

## Local workflow

```bash
./start.sh
git switch -c fix/short-description
```

Make a focused change, then run:

```bash
npm run build
npm test --workspaces --if-present
npm run prisma:validate --workspace moonestates-server
```

Use conventional, imperative commit messages such as:

```text
fix: prevent duplicate lead imports
feat: add property availability filter
docs: clarify private fork setup
```

## Pull requests

- Explain the problem and the chosen solution.
- Link the related issue.
- Include tests for changed behavior.
- Add sanitized screenshots for visual changes.
- Note database migrations and breaking changes.
- Keep generated output and local runtime files out of the commit.
- Complete every item in the pull request template.

At least one authorized maintainer review and a passing CI run are required
before merge. Prefer squash merging to keep the default branch readable.

## Handling data safely

Use fabricated names and `example.com` addresses in tests and screenshots.
Never commit `.env` files, database exports, access tokens, private keys,
production logs, customer messages, phone numbers, financial records, or
provider payloads. If sensitive data enters Git history, do not merely delete
the file in a later commit—notify the maintainer immediately so the credential
can be revoked and the history cleaned.
