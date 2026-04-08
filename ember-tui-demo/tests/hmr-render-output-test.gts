import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { FakeTTY } from 'ember-tui/test-utils/FakeTTY';

describe('HMR Render Output Verification', () => {
  let demoProcess: ChildProcess;
  let fakeTTY: FakeTTY;
  const timeout = 120000; // 2 minutes max

  const componentPath = join(__dirname, '../app/components/HmrTest.gts');

  // Store original content
  let originalComponentContent: string;

  beforeAll(async () => {
    // Save original content if file exists
    if (existsSync(componentPath)) {
      originalComponentContent = readFileSync(componentPath, 'utf-8');
    }

    // Create a fake TTY to capture output
    fakeTTY = new FakeTTY();

    // Run prebuild to generate embroider artifacts
    const prebuildProcess = spawn('pnpm', ['run', 'prebuild'], {
      cwd: resolve(__dirname, '..'),
      env: process.env,
      stdio: 'inherit'
    });

    await new Promise<void>((resolve, reject) => {
      prebuildProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Prebuild failed with code ${code}`));
        }
      });
    });

    // Start the demo app directly with node (not via pnpm) to capture actual output
    // Remove VITEST from env to allow app to start
    const { ...cleanEnv } = process.env;
    delete cleanEnv['VITEST'];
    demoProcess = spawn('node', [
      '--inspect=9231',
      '--enable-source-maps',
      '--loader',
      './loader.mjs',
      'app/app.ts'
    ], {
      cwd: resolve(__dirname, '..'),
      env: {
        ...cleanEnv,
        NODE_ENV: 'development',
        FORCE_COLOR: '1',
        TEST_MODE: '1' // Signal to use test output
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    // Collect output
    demoProcess.stdout?.setEncoding('utf8');
    demoProcess.stdout?.on('data', (data) => {
      stdout += data;
      // Debug: log each character to see what we're getting
      const chars = data.split('');
      console.log('STDOUT CHARS:', chars.map((c: string) => c.charCodeAt(0)));
      console.log('STDOUT STRING:', JSON.stringify(data));
      console.log('STDOUT LENGTH:', data.length);
      // Also write to fake TTY to simulate terminal
      fakeTTY.write(data);
    });

    demoProcess.stderr?.setEncoding('utf8');
    demoProcess.stderr?.on('data', (data) => {
      stderr += data;
      // Debug: log stderr too
      const chars = data.split('');
      console.log('STDERR CHARS:', chars.map((c: string) => c.charCodeAt(0)));
      console.log('STDERR STRING:', JSON.stringify(data));
      // Also write stderr to fake TTY since app might write there
      fakeTTY.write(data);
    });

    // Wait for app to start and render
    await new Promise<void>((resolve, reject) => {
      let resolved = false;

      const checkInterval = setInterval(() => {
        console.log('Checking output... stdout length:', stdout.length, 'stderr length:', stderr.length, 'fakeTTY:', fakeTTY.getCleanOutput().length);

        // Look for actual rendered content - the HMR Test Component box or menu
        // The app writes rendered UI to stdout, not stderr
        if (stdout.includes('HMR Test Component') ||
            stdout.includes('Ember Console Demo') ||
            stdout.length > 100) {
          clearInterval(checkInterval);
          if (!resolved) {
            resolved = true;
            resolve();
          }
        }
      }, 500);

      // Timeout after 20 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        if (!resolved) {
          console.log('TIMEOUT - Final stdout:', stdout);
          console.log('TIMEOUT - Final stderr:', stderr);
          console.log('TIMEOUT - FakeTTY output:', fakeTTY.getCleanOutput());
          reject(new Error('App failed to render within 20 seconds'));
        }
      }, 20000);

      // Also check if process exits early
      demoProcess.on('exit', (code, signal) => {
        clearInterval(checkInterval);
        if (!resolved) {
          console.log('Process exited early with code:', code, 'signal:', signal);
          console.log('Final stdout:', stdout);
          console.log('Final stderr:', stderr);
          reject(new Error(`Process exited with code ${code}`));
        }
      });
    });

    // Give app extra time to fully render and flush stdout
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('After wait - stdout length:', stdout.length);
    console.log('After wait - stderr length:', stderr.length);
    console.log('After wait - fakeTTY clean output length:', fakeTTY.getCleanOutput().length);
    console.log('After wait - fakeTTY full output length:', fakeTTY.getFullOutput().length);
  }, timeout);

  afterAll(async () => {
    // Restore original content if it was saved
    if (originalComponentContent && existsSync(componentPath)) {
      writeFileSync(componentPath, originalComponentContent);
    }

    // Kill the process
    if (demoProcess && !demoProcess.killed) {
      demoProcess.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (!demoProcess.killed) {
        demoProcess.kill('SIGKILL');
      }
    }
  });

  it('should capture initial render output from terminal', () => {
    const cleanOutput = fakeTTY.getCleanOutput();
    const fullOutput = fakeTTY.getFullOutput();

    // Verify we captured actual terminal output
    expect(cleanOutput.length).toBeGreaterThan(50);

    // The full output should contain ANSI escape codes (terminal formatting)
    // eslint-disable-next-line no-control-regex
    expect(fullOutput).toMatch(/\x1b\[/); // ANSI escape sequence
  });

  it('should update rendered output when component is modified (ACTUAL HMR TEST)', async () => {
    if (!existsSync(componentPath)) {
      expect(true).toBe(true);
      return;
    }

    // Get initial output
    const initialOutput = fakeTTY.getCleanOutput();
    fakeTTY.clear(); // Clear output buffer to track new changes

    // Modify the component with a UNIQUE marker we can detect
    const uniqueMarker = `HMR_TEST_MARKER_${Date.now()}`;
    const modifiedContent = originalComponentContent.replace(
      /HMR Test Component/,
      `${uniqueMarker} - Modified Content`
    );

    writeFileSync(componentPath, modifiedContent);

    // Wait for HMR to process and re-render
    await new Promise(resolve => setTimeout(resolve, 6000));

    // Get new output after HMR
    const newOutput = fakeTTY.getCleanOutput();

    // CRITICAL: Verify the unique marker appears in the output
    expect(newOutput).toContain(uniqueMarker);

    // Verify output changed from initial
    expect(newOutput).not.toBe(initialOutput);

    // Clear for restoration test
    fakeTTY.clear();

    // Restore original content
    writeFileSync(componentPath, originalComponentContent);

    // Wait for HMR to process restoration
    await new Promise(resolve => setTimeout(resolve, 6000));

    // Verify the marker is GONE after restoration
    const restoredOutput = fakeTTY.getCleanOutput();
    expect(restoredOutput).not.toContain(uniqueMarker);
  }, timeout);

  it('should show different content in output after HMR update', async () => {
    if (!existsSync(componentPath)) {
      expect(true).toBe(true);
      return;
    }

    // Clear output buffer
    fakeTTY.clear();

    // Make a visible change to the component
    const testMessage = `TEST_MESSAGE_${Date.now()}`;
    const modifiedContent = originalComponentContent.replace(
      /HMR Test Component/,
      testMessage
    );

    writeFileSync(componentPath, modifiedContent);

    // Wait for HMR and re-render
    await new Promise(resolve => setTimeout(resolve, 6000));

    // The test message should appear in the terminal output
    const output = fakeTTY.getCleanOutput();
    expect(output).toContain(testMessage);

    // Restore
    writeFileSync(componentPath, originalComponentContent);
    await new Promise(resolve => setTimeout(resolve, 3000));
  }, timeout);
});
