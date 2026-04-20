import fs from 'fs';
import path from 'path';

class DebugLogger {
  private enabled = false;
  private fileLoggingEnabled = false;
  private logFilePath: string | null = null;
  private logStream: fs.WriteStream | null = null;

  enable() {
    this.enabled = true;
  }

  disable() {
    this.enabled = false;
  }

  enableFileLogging(filePath: string) {
    this.fileLoggingEnabled = true;
    this.logFilePath = filePath;
    
    // Create directory if it doesn't exist
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Create write stream
    this.logStream = fs.createWriteStream(filePath, { flags: 'a' });
  }

  disableFileLogging() {
    this.fileLoggingEnabled = false;
    if (this.logStream) {
      this.logStream.end();
      this.logStream = null;
    }
  }

  log(message: string, ...args: any[]) {
    if (!this.enabled) return;
    
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    
    console.log(logMessage, ...args);
    
    if (this.fileLoggingEnabled && this.logStream) {
      this.logStream.write(`${logMessage} ${args.map(a => JSON.stringify(a)).join(' ')}\n`);
    }
  }
}

export const debugLogger = new DebugLogger();

export function logDebug(message: string, ...args: any[]) {
  debugLogger.log(message, ...args);
}
