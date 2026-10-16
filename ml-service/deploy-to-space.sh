#!/usr/bin/env bash
# Publishes the COMMITTED contents of ml-service/ to a Hugging Face Space.
#
#   ml-service/deploy-to-space.sh https://huggingface.co/spaces/<you>/<space-name>
#
# git will ask for your Hugging Face username and, as the password, an access token with WRITE permission
# (huggingface.co/settings/tokens). Enter them yourself in the prompt; this script never sees them.
# Only tracked files are sent, so venv/, models/ and .env can never leak into the Space.
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "usage: $0 <space-git-url>" >&2
  exit 1
fi

SPACE_URL="$1"
REPO_ROOT="$(git rev-parse --show-toplevel)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

git clone "$SPACE_URL" "$WORK/space"
find "$WORK/space" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
git -C "$REPO_ROOT" archive HEAD:ml-service | tar -x -C "$WORK/space"

cd "$WORK/space"
git add -A
if git diff --cached --quiet; then
  echo "Nothing to deploy: the Space already matches the committed ml-service/."
  exit 0
fi
git commit -m "Deploy ML service"
git push
echo "Pushed. Watch the build log on the Space page (first build takes several minutes)."
