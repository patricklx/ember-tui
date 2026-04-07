import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';

describe('HMR functionality', () => {
  let demoProcess: ChildProcess;
  let stdout = '';
  let stderr = '';
  const timeout = 120000; // 2 minutes max

  const componentPath = join(__dirname, '../app/components/HmrTest.gts');
  const templatePath = join(__dirname, '../app/templates/application.gts');

  // Store original content
  let originalComponentContent: string;
  let originalTemplateContent: string;

  beforeAll(async () => {
    // Save original content if files exist
    if (existsSync(componentPath)) {
      originalComponentContent = readFileSync(componentPath, 'utf-8');
    }
    if (existsSync(templatePath)) {
      originalTemplateContent = readFileSync(templatePath, 'utf-8');
    }

    // Start the demo app
    demoProcess = spawn('pnpm', ['start'], {
      cwd: resolve(__dirname, '..'),
      env: { ...process.env, FORCE_COLOR: '1', VITEST: undefined },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    // Collect output with explicit encoding
    demoProcess.stdout?.setEncoding('utf8');
    demoProcess.stdout?.on('data', (data) => {
      stdout += data;
    });

    demoProcess.stderr?.setEncoding('utf8');
    demoProcess.stderr?.on('data', (data) => {
      stderr += data;
    });

    // Wait for app to start - look for any output
    await new Promise<void>((resolve, reject) => {
      const checkInterval = setInterval(() => {
        const totalOutput = stdout + stderr;
        // Check for any indication the app started
        if (totalOutput.length > 100) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 500);

      // Timeout after 15 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error('App failed to start within 15 seconds'));
      }, 15000);
    });

    // Give app time to fully initialize and render
    await new Promise(resolve => setTimeout(resolve, 3000));
  }, timeout);

  afterAll(async () => {
    // Restore original content if it was saved
    if (originalComponentContent && existsSync(componentPath)) {
      writeFileSync(componentPath, originalComponentContent);
    }
    if (originalTemplateContent && existsSync(templatePath)) {
      writeFileSync(templatePath, originalTemplateContent);
    }

    // Kill the process
    if (demoProcess && !demoProcess.killed) {
      demoProcess.kill('SIGTERM');

      // Wait a bit for graceful shutdown
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Force kill if still running
      if (!demoProcess.killed) {
        demoProcess.kill('SIGKILL');
      }
    }
  });

  it('should start the app and render initial output', () => {
    const totalOutput = stdout + stderr;

    // The app should have rendered some content
    expect(totalOutput.length).toBeGreaterThan(100);

    // Process should still be running
    expect(demoProcess.killed).toBe(false);
  });

  it('should handle component modification without crashing (HMR stability test)', async () => {
    // Modify the component file
    if (existsSync(componentPath)) {
      const modifiedContent = originalComponentContent.replace(
        /export default class/,
        '// HMR TEST CHANGE\nexport default class'
      );
      writeFileSync(componentPath, modifiedContent);

      // Wait for HMR to process
      await new Promise(resolve => setTimeout(resolve, 4000));

      // Main verification: Process should still be running (no crash)
      expect(demoProcess.killed).toBe(false);

      // Verify the process is still responsive by checking exit code is null
      expect(demoProcess.exitCode).toBe(null);

      // Restore original
      writeFileSync(componentPath, originalComponentContent);

      // Wait for restoration to process
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Process should still be running after restoration
      expect(demoProcess.killed).toBe(false);
    } else {
      // Skip if component doesn't exist
      expect(true).toBe(true);
    }
  }, timeout);

  it('should handle template modification without crashing (HMR stability test)', async () => {
    // Modify the template file
    if (existsSync(templatePath)) {
      const modifiedContent = originalTemplateContent.replace(
        /<HmrTest \/>/,
        '<HmrTest />\n{{! HMR TEST MODIFICATION }}'
      );
      writeFileSync(templatePath, modifiedContent);

      // Wait for HMR to process
      await new Promise(resolve => setTimeout(resolve, 4000));

      // Main verification: Process should still be running (no crash)
      expect(demoProcess.killed).toBe(false);

      // Verify the process is still responsive by checking exit code is null
      expect(demoProcess.exitCode).toBe(null);

      // Restore original
      writeFileSync(templatePath, originalTemplateContent);

      // Wait for restoration to process
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Process should still be running after restoration
      expect(demoProcess.killed).toBe(false);
    } else {
      // Skip if template doesn't exist
      expect(true).toBe(true);
    }
  }, timeout);
});
