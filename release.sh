#!/bin/bash

set -e

# Get the latest tag, or the initial version from package.json
latest_tag=$(git tag | sort -V | tail -n 1)
if [ -z "$latest_tag" ]; then
  latest_tag="v$(node -p "require('./package.json').version")"
fi

echo "Latest tag is $latest_tag"

# Strip 'v' prefix if it exists
if [[ $latest_tag == v* ]]; then
  latest_tag_no_v=${latest_tag:1}
else
  latest_tag_no_v=$latest_tag
fi

# Increment patch version
new_version_no_v=$(echo "$latest_tag_no_v" | awk -F. '{$NF = $NF + 1;} 1' | sed 's/ /./g')
new_version="v$new_version_no_v"
echo "New version is $new_version"

# Bump version in package.json and package-lock.json
npm version --no-git-tag-version "$new_version_no_v"

# Add changes to git
git add package.json package-lock.json

# Commit
git commit -m "chore(release): $new_version"

# Add a new tag
git tag "$new_version"

# Push incl tags
git push
git push --tags

echo "Release $new_version pushed successfully."
