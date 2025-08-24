# Upstream Sync Workflow (Fork: Logrui/Zero)

This document explains how we keep our custom `staging` branch in sync with the upstream parent repo (Mail-0/Zero) while preserving our local customizations (e.g., Gemini env/model changes and development overrides).

## Remotes

- origin = our fork: https://github.com/Logrui/Zero.git
- upstream = parent: https://github.com/Mail-0/Zero.git

Verify:
```bash
git remote -v
```

## Protected Files (keep ours during merges)

Use per-file merge strategy to auto-keep our versions when merging or rebasing:

1) In `.gitattributes` (repo root), list protected files:
```
# Keep our versions on merges/rebases
apps/server/wrangler.jsonc              merge=ours
apps/server/worker-configuration.d.ts   merge=ours
apps/mail/worker-configuration.d.ts     merge=ours
```

2) Register the merge driver (once per machine):
```bash
git config merge.ours.driver true
```

Optional: Remember conflict resolutions so repeated merges are easier:
```bash
git config rerere.enabled true
```

Notes:
- Only protect files you truly own. If upstream fixes a protected file, manually port relevant changes once.
- Do not commit secrets; prefer `.env.example` for documentation.

## Regular Sync Flow (Recommended)

We integrate upstream changes via a temporary branch `upstream-sync` created from `upstream/main`, then merge into `staging`.

1) Ensure you’re on our working branch and up to date with our fork:
```bash
git checkout staging
git pull origin staging
```

2) Fetch upstream (safe, no working tree changes):
```bash
git fetch upstream
```

3) Create a fresh integration branch from upstream main:
```bash
git checkout -B upstream-sync upstream/main
```

4) Review incoming changes (optional but recommended):
```bash
git log --oneline --decorate --graph staging..upstream-sync
git diff --name-only staging...upstream-sync
```

5) Merge upstream changes into our branch:
```bash
git checkout staging
git merge --no-ff upstream-sync
```
- Resolve any conflicts. Protected files from `.gitattributes` will auto-keep our side.
- If pre-commit hooks block due to warnings and you want to proceed, use `--no-verify` once:
  ```bash
  git commit --no-verify
  ```

6) Push our updated branch:
```bash
git push origin staging
```

## Alternatives

- Rebase (linear history):
```bash
git checkout staging
git rebase upstream/main
# resolve conflicts
git push --force-with-lease origin staging
```

- Cherry-pick specific upstream fixes (surgical):
```bash
git fetch upstream
git checkout staging
git cherry-pick <commit-sha>
```

## Handling Conflicts

- Use `git status` to see conflicted files and `git diff` to inspect changes.
- For protected files, the `merge=ours` rule should keep our versions automatically.
- After resolving conflicts, `git add <files>` then `git commit` (or `--no-verify` if hooks block).

## Local-only Overrides

- Keep `.env` and other secrets untracked. If a tracked file must be left unchanged locally, temporarily:
```bash
git update-index --skip-worktree path/to/file
```
Use sparingly; it can hide changes from you.

## Quick Commands Recap

```bash
# Update our branch with upstream changes (recommended pattern)
git checkout staging && git pull origin staging
git fetch upstream
git checkout -B upstream-sync upstream/main
# inspect
git log --oneline --decorate --graph staging..upstream-sync
# merge
git checkout staging
git merge --no-ff upstream-sync
# resolve, then
git push origin staging
```

## FAQ

- Does `git fetch upstream` overwrite our code?
  - No. It only updates remote-tracking refs (e.g., `upstream/main`). Changes apply only when you merge, rebase, or cherry-pick.

- Hooks prevent commits—what now?
  - Fix the warnings or temporarily bypass with `git commit --no-verify` for that commit.

- We need an upstream change inside a protected file.
  - Manually port it once, commit, and keep protection on for future merges.
