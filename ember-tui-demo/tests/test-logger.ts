import { appendFileSync } from 'fs';
import { join } from 'path';

const LOG_FILE = join(process.cwd(), 'test-failures.log');

export function logTestFailure(testName: string, error: any, context?: any) {
  const timestamp = new Date().toISOString();
  const logEntry = `
================================================================================
[${timestamp}] TEST FAILURE: ${testName}
================================================================================
Error: ${error?.message || String(error)}
${error?.stack || ''}
${context ? `\nContext: ${JSON.stringify(context, null, 2)}` : ''}
================================================================================

`;
  
  try {
    appendFileSync(LOG_FILE, logEntry, 'utf8');
  } catch (err) {
    console.error('Failed to write to log file:', err);
  }
}

export function logTestStart(testName: string) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] Starting test: ${testName}\n`;
  
  try {
    appendFileSync(LOG_FILE, logEntry, 'utf8');
  } catch (err) {
    console.error('Failed to write to log file:', err);
  }
}

export function logTestSuccess(testName: string) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ✓ Test passed: ${testName}\n`;
  
  try {
    appendFileSync(LOG_FILE, logEntry, 'utf8');
  } catch (err) {
    console.error('Failed to write to log file:', err);
  }
}
