# Branch & PR flow (required setup)

## Desired flow

```text
1) git push origin feature/xyz
2) GitHub PR: feature/xyz → develop
      └─ CI checks run (Build API, Build Web, CI Result, Branch flow)
      └─ ❌ fail = Merge button blocked
      └─ ✅ pass = Merge into develop only

3) GitHub PR: develop → main
      └─ CI checks run again
      └─ ✅ pass = Merge into main

❌ feature/* → main   (blocked by Action + branch protection)
❌ direct push to develop / main (blocked by branch protection)
```

Repo: https://github.com/akhandpratapbhu/LatestDmsWithAkhand

---

## Part A — Code already in repo (Actions)

| Workflow                                    | What it does                               |
| ------------------------------------------- | ------------------------------------------ |
| `.github/workflows/ci.yml`                  | On PR/push: build `apps/api` + `apps/web`  |
| `.github/workflows/enforce-branch-flow.yml` | Fails if someone opens PR `feature → main` |

Actions alone **show** red/green. Merge **block** tab ke liye Part B zaroori hai.

---

## Part B — GitHub pe branch protection (ek baar)

Ye setting **UI se** karni padti hai (Actions file se merge lock nahi hota).

### 1) `develop` protect karo

1. Open: https://github.com/akhandpratapbhu/LatestDmsWithAkhand/settings/branches
2. **Add branch protection rule** (ya **Add ruleset** → Branch)
3. Branch name pattern: `develop`
4. Enable:
   - ✅ **Require a pull request before merging**
   - ✅ **Require status checks to pass before merging**
   - Search & select required checks:
     - `Build API`
     - `Build Web`
     - `CI Result`
     - `Branch flow`
   - ✅ **Do not allow bypassing the above settings** (agar option dikhe)
5. Save

Ab:

- Seedha `develop` pe push fail / blocked
- PR me CI fail → **Merge** disable
- CI pass → feature → `develop` merge allowed

### 2) `main` protect karo

1. Same page → naya rule
2. Branch name pattern: `main`
3. Same options as develop:
   - ✅ Require pull request
   - ✅ Require status checks: `Build API`, `Build Web`, `CI Result`, `Branch flow`
   - ✅ Do not allow bypassing
4. Save

`Branch flow` check ensure karega: **sirf `develop` → `main`** allowed.  
Agar koi `feature/xyz` → `main` PR banaye → check ❌ → merge nahi hoga.

> Pehli baar checks list me dikhne ke liye ek PR chalana pad sakta hai. Agar naam search me na aaye, pehle koi test PR open karke CI run karo, phir rule me checks select karo.

---
////block any branch to direct merge in main branch only develop do this.
## Daily commands

```bash
git checkout develop
git pull origin develop
git checkout -b feature/my-change

# work + commit
git push -u origin feature/my-change
```

Phir GitHub:

1. **New Pull Request** → base: `develop` ← compare: `feature/my-change`
2. Wait for green checks → **Merge pull request**
3. Release time: **New Pull Request** → base: `main` ← compare: `develop` → Merge

---

## Checklist

- [ ] `develop` branch protection ON + required checks
- [ ] `main` branch protection ON + required checks
- [ ] Test: feature PR → develop (CI must run)
- [ ] Test: feature PR → main (must fail **Branch flow**)
- [ ] Test: develop PR → main (must be allowed when CI green)
