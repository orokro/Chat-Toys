#!/bin/bash
set -e

# Ensure clean working tree
if [[ -n "$(git status --porcelain)" ]]; then
	echo "❌ Working tree is not clean. Commit or stash changes first."
	exit 1
fi

# Increment patch version (creates commit + tag)
npm version patch

# Push commit and tags to GitHub
git push origin main --tags

# Optional: publish to npm
# npm publish

echo "✅ Patch version bumped, tag created, and pushed to GitHub."
