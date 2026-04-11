#!/bin/sh

set -eu

current_branch=$(git symbolic-ref --quiet --short HEAD 2>/dev/null || true)
origin_url=$(git remote get-url origin 2>/dev/null || true)

if [ -z "$origin_url" ]; then
	echo "No 'origin' remote is configured."
	exit 1
fi

if [ "$current_branch" != "dev" ]; then
	echo "Release flow must run from 'dev'. Current branch: ${current_branch:-detached HEAD}."
	exit 1
fi

if [ -n "$(git status --short)" ]; then
	echo "Working tree is not clean. Commit or stash changes before preparing a release."
	exit 1
fi

git fetch origin

git rev-parse --verify origin/main >/dev/null 2>&1 || {
	echo "Remote branch 'origin/main' does not exist."
	exit 1
}

git rev-parse --verify origin/dev >/dev/null 2>&1 || {
	echo "Remote branch 'origin/dev' does not exist."
	exit 1
}

behind_count=$(git rev-list --count HEAD..origin/dev)

if [ "$behind_count" -ne 0 ]; then
	echo "Local 'dev' is behind 'origin/dev' by ${behind_count} commit(s). Pull or rebase before releasing."
	exit 1
fi

ahead_count=$(git rev-list --count origin/main..HEAD)

if [ "$ahead_count" -eq 0 ]; then
	echo "No commits are waiting to be released from 'dev' to 'main'."
	exit 0
fi

echo "Running release validation on 'dev'..."
npm run lint
npm run check
npm run test:unit -- --run
npm run build

case "$origin_url" in
	https://github.com/*)
		repo_path=${origin_url#https://github.com/}
		repo_path=${repo_path%.git}
		pr_url="https://github.com/${repo_path}/compare/main...dev?expand=1"
		;;
	git@github.com:*)
		repo_path=${origin_url#git@github.com:}
		repo_path=${repo_path%.git}
		pr_url="https://github.com/${repo_path}/compare/main...dev?expand=1"
		;;
	*)
		pr_url=""
		;;
esac

echo
echo "Release checks passed."
echo "Next step: open a pull request from 'dev' into 'main'."

if [ -n "$pr_url" ]; then
	echo "$pr_url"
fi