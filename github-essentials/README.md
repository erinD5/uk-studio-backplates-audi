# GitHub Essentials Pack

Drop this folder's contents into the root of any repository.

Included:
- `.github/workflows/ci.yml` - basic CI for Node projects
- `.github/pull_request_template.md` - PR checklist template
- `.github/ISSUE_TEMPLATE/bug_report.md` - bug report template
- `.github/ISSUE_TEMPLATE/feature_request.md` - feature request template
- `.github/ISSUE_TEMPLATE/config.yml` - disables blank issues and adds links
- `CODEOWNERS` - default code ownership file
- `CONTRIBUTING.md` - contributor workflow guide
- `SECURITY.md` - security reporting policy

## How to use
1. Copy all files/folders from `github-essentials` into your target repo root.
2. Update:
   - `CODEOWNERS` usernames/teams
   - security contact in `SECURITY.md`
   - any team-specific contribution rules in `CONTRIBUTING.md`
3. Commit and push.

## Notes
- The CI workflow is intentionally minimal and uses:
  - `npm ci`
  - `npm run lint --if-present`
  - `npm run build --if-present`
  - `npm test --if-present`
