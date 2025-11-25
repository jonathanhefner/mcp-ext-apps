#!/bin/bash
set -euo pipefail

DOCS_DIR="docs"
BRANCH="gh-pages"
REMOTE="${1:-origin}"
COMMIT_MSG="Update documentation"

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "${REPO_ROOT}"

# Generate fresh documentation
echo "Generating documentation..."
npm run docs

# Verify docs exist
if [ ! -d "${DOCS_DIR}" ] || [ -z "$(ls -A "${DOCS_DIR}")" ]; then
    echo "Error: Documentation directory '${DOCS_DIR}' is empty or missing"
    exit 1
fi

# Create temporary worktree
WORKTREE_DIR=$(mktemp -d)
trap 'rm -rf "${WORKTREE_DIR}"' EXIT

# Setup gh-pages branch in worktree
if git ls-remote --heads "${REMOTE}" "${BRANCH}" | grep -q "${BRANCH}"; then
    git fetch "${REMOTE}" "${BRANCH}"
    git worktree add "${WORKTREE_DIR}" "${REMOTE}/${BRANCH}"
    cd "${WORKTREE_DIR}"
    git checkout -B "${BRANCH}" "${REMOTE}/${BRANCH}"
else
    git worktree add --detach "${WORKTREE_DIR}"
    cd "${WORKTREE_DIR}"
    git checkout --orphan "${BRANCH}"
    git rm -rf . 2>/dev/null || true
fi

# Clear and copy docs
find . -maxdepth 1 ! -name '.' ! -name '.git' -exec rm -rf {} +
cp -r "${REPO_ROOT}/${DOCS_DIR}/"* .
touch .nojekyll

# Commit and push if there are changes
if git diff --quiet && git diff --cached --quiet && [ -z "$(git ls-files --others --exclude-standard)" ]; then
    echo "No changes to documentation."
else
    git add -A
    git commit -m "${COMMIT_MSG}"
    git push "${REMOTE}" "${BRANCH}"
    echo "Documentation published to ${REMOTE}/${BRANCH}"
fi
