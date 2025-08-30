#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Check if vsce is installed
if ! command -v vsce &> /dev/null
then
    echo "vsce could not be found, installing it..."
    npm install -g vsce
fi

# Check for Personal Access Token
if [ -z "$VSCE_PAT" ]; then
  echo "Error: VSCE_PAT environment variable is not set."
  echo "Please obtain a Personal Access Token from Azure DevOps (https://dev.azure.com/<your-organization>/_usersSettings/tokens) with 'Marketplace (Publish)' scope."
  echo "Then set it as an environment variable: export VSCE_PAT='your_pat_here'"
  exit 1
fi

echo "Publishing the extension..."
vsce publish -p $VSCE_PAT

echo "Publishing complete."