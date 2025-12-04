#!/usr/bin/env node
/* eslint-env node */
/* eslint-disable no-undef */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'fs';

const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/patricklx/ember-tui/refs/heads/scripts/ember-tui-demo';

// Get app name from arguments
const args = process.argv.slice(2);
const appName = args.find(arg => !arg.startsWith('--') && arg !== 'create-app');

if (!appName) {
  console.error('Error: Please provide an app name');
  console.error('Usage: npx ember-tui create-app <app-name> [--pnpm|--yarn]');
  process.exit(1);
}

// Detect package manager
let pkgManager = 'npm';
let installCmd = 'npm i';
let uninstallCmd = 'npm uninstall';

if (args.includes('--pnpm')) {
  pkgManager = 'pnpm';
  installCmd = 'pnpm add';
  uninstallCmd = 'pnpm remove';
} else if (args.includes('--yarn')) {
  pkgManager = 'yarn';
  installCmd = 'yarn add';
  uninstallCmd = 'yarn remove';
}

// Check for required tools (only package manager needed now)
try {
  execSync(`command -v ${pkgManager}`, { stdio: 'ignore' });
} catch {
  console.error(`Error: ${pkgManager} is not installed. Please install it and try again.`);
  process.exit(1);
}

async function downloadFile(url, destination) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status}`);
  }
  const data = await response.text();

  // Create directory if it doesn't exist
  const dir = destination.substring(0, destination.lastIndexOf('/'));
  if (dir && !existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(destination, data);
}

async function setup() {
  console.log(`Creating new Ember app: ${appName}...`);

  // Create new Ember app with TypeScript
  try {
    const emberCliCmd = pkgManager === 'pnpm' ? 'pnpx' : 'npx';
    execSync(`${emberCliCmd} ember-cli new ${appName} --typescript --skip-npm --skip-git`, {
      stdio: 'inherit',
      cwd: process.cwd()
    });
  } catch (error) {
    console.error('Failed to create Ember app:', error.message);
    process.exit(1);
  }

  // Change to app directory
  process.chdir(appName);
  console.log(`\nSetting up Ember-TUI in ${appName}...`);

  // Remove unnecessary files
  if (existsSync('testem.cjs')) rmSync('testem.cjs');
  if (existsSync('testem.js')) rmSync('testem.js');
  if (existsSync('./tests/helpers/index.ts')) rmSync('./tests/helpers/index.ts');
  if (existsSync('./tests/helpers')) {
    try {
      rmSync('./tests/helpers', { recursive: true });
    } catch {
      // Directory might not be empty or not exist
    }
  }

  // Download configuration files
  const filesToDownload = [
    { url: `${GITHUB_RAW_BASE}/app/config/environment.ts`, dest: 'app/config/environment.ts' },
    { url: `${GITHUB_RAW_BASE}/app/app.ts`, dest: 'app/app.ts' },
    { url: `${GITHUB_RAW_BASE}/vite.config.mjs`, dest: 'vite.config.mjs' },
    { url: `${GITHUB_RAW_BASE}/rollup.config.mjs`, dest: 'rollup.config.mjs' },
    { url: `${GITHUB_RAW_BASE}/README.md`, dest: 'README.md' },
    { url: `${GITHUB_RAW_BASE}/loader.mjs`, dest: 'loader.mjs' },
    { url: `${GITHUB_RAW_BASE}/tests/globalSetup.js`, dest: 'tests/globalSetup.js' },
  ];

  console.log('Downloading configuration files...');
  for (const file of filesToDownload) {
    try {
      await downloadFile(file.url, file.dest);
      console.log(`✓ Downloaded ${file.dest}`);
    } catch (error) {
      console.error(`✗ Failed to download ${file.dest}:`, error.message);
    }
  }

  // Create tests/integration directory if it doesn't exist
  if (!existsSync('tests/integration')) {
    mkdirSync('tests/integration', { recursive: true });
  }

  // Download test file
  try {
    await downloadFile(`${GITHUB_RAW_BASE}/tests/basic-test.gts`, 'tests/integration/basic-test.gts');
    console.log('✓ Downloaded tests/integration/basic-test.gts');
  } catch (error) {
    console.error('✗ Failed to download test file:', error.message);
  }

  // Create application template
  console.log('Creating application template...');
  const appTemplate = `import { Box, Text } from 'ember-tui';

<template>
  <Box>
    <Text>Welcome to Ember-Tui</Text>
  </Box>
</template>
`;
  writeFileSync('app/templates/application.gts', appTemplate);
  console.log('✓ Created app/templates/application.gts');

  // Insert globalThis.self line into deprecation-workflow.ts
  if (existsSync('app/deprecation-workflow.ts')) {
    const deprecationContent = readFileSync('app/deprecation-workflow.ts', 'utf8');
    if (!deprecationContent.includes('globalThis.self = globalThis;')) {
      const lines = deprecationContent.split('\n');
      lines.splice(1, 0, 'globalThis.self = globalThis;');
      writeFileSync('app/deprecation-workflow.ts', lines.join('\n'));
      console.log('✓ Updated app/deprecation-workflow.ts');
    }
  }

  // Update locationType in config/environment.js
  if (existsSync('config/environment.js')) {
    let envContent = readFileSync('config/environment.js', 'utf8');
    envContent = envContent.replace(/locationType: 'history'/g, "locationType: 'none'");
    writeFileSync('config/environment.js', envContent);
    console.log('✓ Updated config/environment.js');
  }

  // Merge package.json scripts
  console.log('Updating package.json...');
  try {
    // Download remote package.json
    const response = await fetch(`${GITHUB_RAW_BASE}/package.json`);
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.status}`);
    }
    const remotePackageData = await response.text();

    if (existsSync('package.json')) {
      const localPackage = JSON.parse(readFileSync('package.json', 'utf8'));
      const remotePackage = JSON.parse(remotePackageData);

      // Merge scripts from remote into local
      localPackage.scripts = remotePackage.scripts;

      writeFileSync('package.json', JSON.stringify(localPackage, null, 2) + '\n');
      console.log('✓ Merged package.json scripts');
    }
  } catch (error) {
    console.error('✗ Failed to merge package.json:', error.message);
  }

  // Install dependencies
  console.log('\nInstalling dependencies...');
  try {
    execSync(`${installCmd} --save-dev ember-tui ember-vitest vitest @rollup/plugin-babel @rollup/plugin-commonjs @rollup/plugin-json @rollup/plugin-node-resolve`, { stdio: 'inherit' });
    console.log('✓ Dependencies installed');
  } catch (error) {
    console.error('✗ Failed to install dependencies:', error.message);
    process.exit(1);
  }

  // Uninstall unnecessary packages
  console.log('\nRemoving unnecessary packages...');
  try {
    execSync(`${uninstallCmd} testem qunit qunit-dom ember-page-title ember-welcome-page`, { stdio: 'inherit' });
    console.log('✓ Unnecessary packages removed');
  } catch {
    // Some packages might not be installed, that's okay
    console.log('✓ Cleanup completed');
  }

  console.log(`\n✅ Setup complete!`);
  console.log(`\nNext steps:`);
  console.log(`  cd ${appName}`);
  console.log(`  ${pkgManager === 'npm' ? 'npm' : pkgManager} prebuild`);
  console.log(`  ${pkgManager === 'npm' ? 'npm' : pkgManager} start`);
}

setup().catch((error) => {
  console.error('Setup failed:', error);
  process.exit(1);
});
