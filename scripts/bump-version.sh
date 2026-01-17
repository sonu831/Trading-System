#!/bin/bash

# Enhanced version bumper
# Usage: ./scripts/bump-version.sh <major|minor|patch>

TYPE=$1

if [ -z "$TYPE" ]; then
  echo "Usage: $0 <major|minor|patch>"
  exit 1
fi

# Read current version manually (simple grep/cut to avoid jq dependency requirement)
MAJOR=$(grep "major" version.json | tr -dc '0-9')
MINOR=$(grep "minor" version.json | tr -dc '0-9')
PATCH=$(grep "patch" version.json | tr -dc '0-9')

if [ "$TYPE" == "major" ]; then
  MAJOR=$((MAJOR + 1))
  MINOR=0
  PATCH=0
elif [ "$TYPE" == "minor" ]; then
  MINOR=$((MINOR + 1))
  PATCH=0
elif [ "$TYPE" == "patch" ]; then
  PATCH=$((PATCH + 1))
else
  echo "Invalid argument. Use: major, minor, or patch"
  exit 1
fi

NEW_VERSION="$MAJOR.$MINOR.$PATCH"

# write back to version.json
echo "{
  \"major\": $MAJOR,
  \"minor\": $MINOR,
  \"patch\": $PATCH,
  \"tag\": \"v$NEW_VERSION\"
}" > version.json

# Update all package.json files
find layer-* -name "package.json" -exec sed -i '' "s/\"version\": \".*\"/\"version\": \"$NEW_VERSION\"/g" {} +

echo "✅ Bumped to version $NEW_VERSION (Type: $TYPE)"
echo "Run: git commit -am 'chore: bump to v$NEW_VERSION' && git tag v$NEW_VERSION"
