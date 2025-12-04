#!/bin/bash

set -ex

# Detect package manager from arguments
PKG_MANAGER="npm"
INSTALL_CMD="npm i"
UNINSTALL_CMD="npm uninstall"

for arg in "$@"; do
  if [[ "$arg" == *"--pnpm"* ]]; then
    PKG_MANAGER="pnpm"
    INSTALL_CMD="pnpm add"
    UNINSTALL_CMD="pnpm remove"
    break
  elif [[ "$arg" == *"--yarn"* ]]; then
    PKG_MANAGER="yarn"
    INSTALL_CMD="yarn add"
    UNINSTALL_CMD="yarn remove"
    break
  fi
done

# Check for required tools
for tool in jq grep sed curl $PKG_MANAGER; do
  if ! command -v $tool &> /dev/null; then
    echo "Error: $tool is not installed. Please install it and try again."
    exit 1
  fi
done


rm -f testem.cjs
rm -f ./tests/helpers/index.ts
rmdir ./tests/helpers

curl https://raw.githubusercontent.com/patricklx/ember-tui/refs/heads/scripts/ember-tui-demo/app/config/environment.ts > app/config/environment.ts
curl https://raw.githubusercontent.com/patricklx/ember-tui/refs/heads/scripts/ember-tui-demo/app/app.ts > app/app.ts
curl https://raw.githubusercontent.com/patricklx/ember-tui/refs/heads/scripts/ember-tui-demo/vite.config.mjs > vite.config.mjs
curl https://raw.githubusercontent.com/patricklx/ember-tui/refs/heads/scripts/ember-tui-demo/rollup.config.mjs > rollup.config.mjs
curl https://raw.githubusercontent.com/patricklx/ember-tui/refs/heads/scripts/ember-tui-demo/README.md > README.md
curl https://raw.githubusercontent.com/patricklx/ember-tui/refs/heads/scripts/ember-tui-demo/loader.mjs > loader.mjs

# Download test files
curl https://raw.githubusercontent.com/patricklx/ember-tui/refs/heads/scripts/ember-tui-demo/tests/globalSetup.js > tests/globalSetup.js
curl https://raw.githubusercontent.com/patricklx/ember-tui/refs/heads/scripts/ember-tui-demo/tests/basic-test.gts > tests/integration/basic-test.gts

# Create application template
cat > app/templates/application.gts << 'EOF'
import { Box, Text } from 'ember-tui';

<template>
  <Box>
    <Text>Welcome to Ember-Tui</Text>
  </Box>
</template>
EOF

# Insert globalThis.self line into deprecation-workflow.ts at line 2 if not already present
if ! grep -q "globalThis.self = globalThis;" app/deprecation-workflow.ts; then
  sed -i '2i globalThis.self = globalThis;' app/deprecation-workflow.ts
fi

# Ensure locationType is set to 'none' in config/environment.js
if [ -f config/environment.js ]; then
  sed -i "s/locationType: 'history'/locationType: 'none'/g" config/environment.js
fi

# Fetch remote package.json and merge scripts section
curl -s https://raw.githubusercontent.com/patricklx/ember-tui/refs/heads/scripts/ember-tui-demo/package.json > /tmp/remote-package.json
if [ -f package.json ]; then
  # Merge scripts section from remote into local package.json
  jq -s '.[0].scripts = .[1].scripts | .[0]' package.json /tmp/remote-package.json > /tmp/merged-package.json
  mv /tmp/merged-package.json package.json
  rm /tmp/remote-package.json
fi

$INSTALL_CMD --save-dev ember-tui ember-vitest vitest @rollup/plugin-babel @rollup/plugin-commonjs @rollup/plugin-json @rollup/plugin-node-resolve
$UNINSTALL_CMD testem qunit qunit-dom ember-page-title ember-welcome-page

echo "run 'npm start'"
