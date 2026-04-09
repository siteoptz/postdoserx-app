# Save and restore versions with GitHub

Use Git to snapshot your work after you finish a chunk of progress on a page (or any files), push those snapshots to GitHub, and jump back to an older snapshot when you need to.

## Prerequisites

- Git installed locally.
- This repo connected to GitHub (`git remote -v` should show `origin`).
- You are authenticated with GitHub (HTTPS credential helper, SSH key, or GitHub CLI).

---

## Save progress to GitHub (after you finish work)

Do this when a page or feature is in a good stopping point—not necessarily after every keystroke, but often enough that you never lose much work.

### 1. See what changed

```bash
git status
```

### 2. Stage the files you want in this snapshot

Stage everything that belongs together in one commit:

```bash
git add .
```

Or stage specific paths only:

```bash
git add login.html js/auth-init.js
```

### 3. Commit with a clear message

```bash
git commit -m "Describe what you finished (e.g. login page validation)"
```

If Git says there is nothing to commit, either there are no changes or you forgot `git add`.

### 4. Push to GitHub

```bash
git push origin main
```

If your default branch is not `main`, replace it with your branch name (e.g. `master` or `develop`).

After a successful push, that version exists on GitHub and is backed up for you and anyone else with repo access.

### Optional: commit often, push when stable

- **Commit** locally after each logical step (small, focused messages).
- **Push** when you are ready to share or back up to GitHub (end of session or after a few commits).

---

## Retrieve a previous version

You can inspect old code, restore one file, or move the whole project back to an earlier commit. Pick the approach that matches what you need.

### A. Browse history on GitHub

1. Open the repository on GitHub.
2. Click **Commits** (or open a file and use **History**).
3. Click a commit to see the diff. You can copy old file contents from the tree view if you only need a snippet.

This is read-only in the browser; use Git locally to apply changes.

### B. See history locally

```bash
git log --oneline
```

Note the **commit hash** (short form is enough, e.g. `a1b2c3d`) for the version you want.

### C. Restore a single file from an older commit (common for “undo this page”)

Replace `COMMIT` with a hash from `git log` and `path/to/file` with your file:

```bash
git checkout COMMIT -- path/to/file
```

Then commit and push:

```bash
git commit -m "Restore login.html from before experiment"
git push origin main
```

### D. View the whole project as it was (temporary, no changes yet)

Detached HEAD—good for comparing or copying; switch back when done:

```bash
git checkout COMMIT
```

To return to your latest branch:

```bash
git checkout main
```

### E. Start a branch from an old commit (safe way to “go back” without erasing `main`)

```bash
git checkout -b fix-from-old COMMIT
```

Work there, test, then merge or open a pull request into `main` on GitHub when ready.

### F. Undo the last commit but keep your file edits

```bash
git reset --soft HEAD~1
```

Your changes stay staged; you can edit further and commit again. **Do not** use this on commits you have already pushed unless you understand rewriting shared history (see below).

### G. Revert a bad commit (keeps history; good for already-pushed commits)

```bash
git revert COMMIT
```

Git creates a new commit that undoes that one. Push as usual:

```bash
git push origin main
```

---

## If you already pushed and need to “remove” a commit

- Prefer **`git revert`** (adds an undo commit) so everyone’s history stays compatible.
- **`git reset --hard`** and a **force push** rewrite history and can confuse collaborators; avoid on shared branches unless the team agrees.

---

## Quick reference

| Goal | Command idea |
|------|----------------|
| Save snapshot | `git add` → `git commit` → `git push` |
| List versions | `git log --oneline` or GitHub **Commits** |
| One file from past | `git checkout COMMIT -- file` → commit → push |
| Safely explore old state | `git checkout -b branch-name COMMIT` |
| Undo pushed mistake | `git revert COMMIT` → push |

---

## Related

- [GitHub: Pushing commits](https://docs.github.com/en/get-started/using-git/pushing-commits-to-a-remote-repository)
- [GitHub: Viewing commit history](https://docs.github.com/en/repositories/viewing-activity-and-data-for-your-repository/viewing-commit-history-of-a-repository)
