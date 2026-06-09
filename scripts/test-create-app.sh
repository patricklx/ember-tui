#!/bin/bash
set -e
set -x

# Build and pack ember-tui
echo "Building ember-tui..."
cd ember-tui
pnpm install
pnpm build
pnpm pack
PACKAGE_FILE=$(ls ember-tui-*.tgz)
cd ..

# Clean up workspace
rm -f pnpm-workspace.yaml
rm -rf node_modules
rm -rf ember-tui/node_modules

# Create new app
node ember-tui/bin/create-app.js my-app --pnpm

# Install from packed .tgz
cd my-app
pnpm install ../ember-tui/$PACKAGE_FILE
pnpm prebuild

# Test the app
pnpm start > out.txt 2>&1 &
APP_PID=$!
sleep 20
kill $APP_PID 2>/dev/null || true
cat out.txt
cat out.txt | grep "Welcome"

pnpm test