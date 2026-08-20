# Production branch protection

Protect `main` in GitHub before treating it as a release branch. Repository files cannot enforce these host settings, so an owner must configure them in GitHub and retain a settings readback or screenshot.

Require pull requests, at least one approving review, dismissal of stale approvals after new commits, resolution of review conversations, linear history, and the branch to be current before merge. Apply the rules to administrators, disallow force pushes and deletion, and do not permit bypass except a documented break-glass owner path. Keep direct pushes unavailable because a merge to `main` may deploy automatically.

Require these exact GitHub Actions check names from `.github/workflows/verify.yml`:

- `Verify application`
- `Release security and API contracts`
- `Native journey manifests`
- `Resident browser journeys`
- `Verify council console`
- `Council console browser journeys`

The `Native journey manifests` check proves only committed YAML/schema integrity. Native release approval additionally requires a successful manually dispatched EAS `Native proof journeys` workflow and the physical-device checks listed in `docs/testing/NATIVE-JOURNEYS.md`.

After configuration, open a test pull request and verify that GitHub blocks merge when any required check is missing, pending or failed. Record the branch-rule readback in the release evidence pack; do not infer protection from the workflow file alone.
