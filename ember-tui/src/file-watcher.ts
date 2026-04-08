/*---------------------------------------------------------------------------------------------
 *
 * IBM Confidential
 * PID 5900-BVU
 * Copyright IBM Corp. 2026
 *
 *--------------------------------------------------------------------------------------------*/

import chokidar, { type FSWatcher } from "chokidar";
import { resolve, relative } from "node:path";
import { handleModuleUpdate } from "./hmr";

export class FileWatcher {
    private watchers: Map<string, FSWatcher> = new Map();
    private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
    private watchedDirs: Set<string> = new Set();

    constructor(private rootDir: string, private debounceMs: number = 100) {}

    watchDirectory(dir: string): void {
        const absoluteDir = resolve(this.rootDir, dir);

        if (this.watchedDirs.has(absoluteDir)) {
            return;
        }

        this.watchedDirs.add(absoluteDir);

        const watcher = chokidar.watch(absoluteDir, {
            persistent: true,
            ignoreInitial: true,
            awaitWriteFinish: {
                stabilityThreshold: 100,
                pollInterval: 50
            }
        });

        watcher.on('change', (filePath: string) => {
            // Ignore non-source files
            if (!this.shouldWatch(filePath)) {
                return;
            }

            const relativeFilePath = relative(this.rootDir, filePath);

            // Debounce file changes
            const existingTimer = this.debounceTimers.get(filePath);
            if (existingTimer) {
                clearTimeout(existingTimer);
            }

            const timer = setTimeout(() => {
                this.debounceTimers.delete(filePath);
                this.handleFileChange(filePath, relativeFilePath);
            }, this.debounceMs);

            this.debounceTimers.set(filePath, timer);
        });

        this.watchers.set(absoluteDir, watcher);
    }

    private shouldWatch(filename: string): boolean {
        // Watch TypeScript, JavaScript, and template files
        const extensions = [".ts", ".js", ".gts", ".gjs", ".hbs"];
        return extensions.some((ext) => filename.endsWith(ext));
    }

    private async handleFileChange(
        absolutePath: string,
        relativePath: string
    ): Promise<void> {

        // Use relative path as module ID (consistent with loader.mjs)
        try {
            await handleModuleUpdate(relativePath);
        } catch (error) {
            console.error(`[HMR] Error handling update for ${relativePath}:`, error);
        }
    }

    stop(): void {
        // Clear all debounce timers
        for (const timer of this.debounceTimers.values()) {
            clearTimeout(timer);
        }
        this.debounceTimers.clear();

        // Close all watchers
        for (const watcher of this.watchers.values()) {
            watcher.close();
        }
        this.watchers.clear();
        this.watchedDirs.clear();
    }
}

let globalWatcher: FileWatcher | null = null;

export function startFileWatcher(rootDir: string, dirs: string[]): FileWatcher {
    if (globalWatcher) {
        globalWatcher.stop();
    }

    globalWatcher = new FileWatcher(rootDir);

    for (const dir of dirs) {
        globalWatcher.watchDirectory(dir);
    }

    return globalWatcher;
}

export function stopFileWatcher(): void {
    if (globalWatcher) {
        globalWatcher.stop();
        globalWatcher = null;
    }
}
