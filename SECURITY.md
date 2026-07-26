# Security policy

## Supported version

Security fixes are applied to the current `main` branch. Older commits and
private forks are not supported releases.

## Report a vulnerability privately

Do not open a public issue, discussion, or pull request.

1. Open the repository's **Security** tab on GitHub.
2. Select **Report a vulnerability** to start a private security advisory.
3. Include the affected component, reproduction steps, impact, and a proposed
   fix if you have one.
4. Remove secrets, personal data, and customer records from all evidence.

If private reporting is unavailable, contact the repository owner through their
GitHub profile without including exploit details in the first message.

You should receive an acknowledgement within 3 business days. The maintainers
will validate the report, agree on a disclosure timeline, prepare a fix, and
credit the reporter when desired.

## Secret exposure

If a credential is committed or pasted into GitHub:

1. Revoke or rotate it immediately at the provider.
2. Notify the repository owner privately.
3. Remove it from the working tree and Git history.
4. Review provider logs for unauthorized use.

Deleting a secret in a later commit is not sufficient because previous commits
remain accessible.

## Security expectations

- Keep the repository and all forks private.
- Use least-privilege provider credentials and separate development accounts.
- Store local secrets only in ignored environment files or a secret manager.
- Enable multi-factor authentication on GitHub and connected providers.
- Do not use real customer data in development, tests, screenshots, or issues.
- Review dependency and secret-scanning alerts before merging.
