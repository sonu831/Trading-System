#!/bin/bash

# Check if CHANGELOG.md is being modified in this push
# This is a simplified check. A robust one would check against origin/main.

if git show --name-only | grep -q "CHANGELOG.md"; then
  exit 0
fi

# If we are just pushing tags, skip
if [ -n "$GIT_PUSH_OPTION_0" ]; then
    exit 0
fi

echo "⚠️  Wait! You are pushing changes but CHANGELOG.md is not modified."
echo "Please update the changelog to reflect your changes."
echo "If this is a trivial change, you can bypass this check with --no-verify."
exit 1
