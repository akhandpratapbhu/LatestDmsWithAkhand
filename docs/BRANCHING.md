# Branch & PR workflow

## Flow

```text
feature/xyz  ──PR──►  develop  ──PR──►  main
   (your work)         (staging)       (production)
                         │                │
                         ▼                ▼
                      CI + CD           CI + CD
                     (staging)        (production)
```

| Step | What you do                                                      | What GitHub Actions does                   |
| ---- | ---------------------------------------------------------------- | ------------------------------------------ |
| 1    | Create `feature/...` from `develop`, push, open **PR → develop** | **CI** runs on the PR                      |
| 2    | Merge PR into `develop`                                          | **CI** + **CD** (staging images/deploy)    |
| 3    | Open **PR: develop → main**                                      | **CI** runs on the PR                      |
| 4    | Merge PR into `main`                                             | **CI** + **CD** (production images/deploy) |

Do **not** push directly to `main` or `develop` once branch protection is enabled. Always use PRs.

## Daily commands

```bash
# Start from latest develop
git checkout develop
git pull origin develop

# New feature branch
git checkout -b feature/my-change

# Work, commit, push
git add .
git commit -m "feat: my change"
git push -u origin feature/my-change
```

Then on GitHub:

1. **Compare & pull request** → base = `develop`, compare = `feature/my-change`
2. Wait for **CI** to go green → **Merge**
3. Later: new PR base = `main`, compare = `develop` → **Merge** for production

## Branch protection (do this once)

Repo: [LatestDmsWithAkhand](https://github.com/akhandpratapbhu/LatestDmsWithAkhand)

**Settings → Branches → Add branch protection rule**

### Rule for `develop`

- Branch name pattern: `develop`
- Require a pull request before merging
- Require status checks to pass:
  - `Build API`
  - `Build Web`
  - `CI Result`
- Do not allow bypassing (recommended)

### Rule for `main`

- Branch name pattern: `main`
- Require a pull request before merging
- Require status checks (same as above)
- Optionally: require 1 approval
- Optionally: restrict who can push

## Actions summary

| Event                                | CI  | CD               |
| ------------------------------------ | --- | ---------------- |
| PR → `develop`                       | Yes | No               |
| Merge into `develop`                 | Yes | Yes → staging    |
| PR → `main` (usually from `develop`) | Yes | No               |
| Merge into `main`                    | Yes | Yes → production |

Actions tab: https://github.com/akhandpratapbhu/LatestDmsWithAkhand/actions
//