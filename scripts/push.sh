#!/bin/bash

# Path to the package.json file
PACKAGE_JSON="package.json"

# Check if jq is installed
if ! command -v jq &> /dev/null
then
    echo "jq could not be found. Please install jq to use this script."
    exit 1
fi

PREV_VERSION=$(jq -r '.version' $PACKAGE_JSON)

# Increment the patch version number
jq --indent 2 '.version |= (split(".") | .[0:2] + [(.[-1] | tonumber + 1 | tostring)] | join("."))' $PACKAGE_JSON > temp.json && mv temp.json $PACKAGE_JSON

# Extract just the version number from the updated JSON
NEW_VERSION=$(jq -r '.version' $PACKAGE_JSON)

echo "Version updated in $PACKAGE_JSON from $PREV_VERSION to $NEW_VERSION."

git add *
git commit -m 'chore: bump version'
git push
