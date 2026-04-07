/*---------------------------------------------------------------------------------------------
 *
 * IBM Confidential
 * PID 5900-BVU
 * Copyright IBM Corp. 2026
 *
 *--------------------------------------------------------------------------------------------*/

import { startFileWatcher } from "./file-watcher";

declare global {
    interface ImportMeta {
        hot?: {
            accept(deps: string, cb: (mod: any) => void): void;
            accept(deps: readonly string[], cb: (mod: any) => void): void;
            accept(cb: (mod: any) => void): void;
            accept(): void;
            dispose(callback: (data: any) => void): void;
            decline(): void;
            invalidate(): void;
            data: any;
        };
    }
}

// Monkey patch emberHotReloadPlugin.canAcceptNew to normalize module URLs
if (typeof globalThis !== 'undefined' && (globalThis as any).emberHotReloadPlugin) {
    const originalCanAcceptNew = (globalThis as any).emberHotReloadPlugin.canAcceptNew;

    (globalThis as any).emberHotReloadPlugin.canAcceptNew = function(moduleUrl: string): boolean {
        // Normalize the moduleUrl to match our internal tracking
        let normalizedUrl = moduleUrl.replace('file://', '');

        if (typeof process !== 'undefined' && process.cwd) {
            const cwd = process.cwd();
            if (normalizedUrl.startsWith(cwd)) {
                normalizedUrl = normalizedUrl.slice(cwd.length);
                if (normalizedUrl.startsWith('/')) {
                    normalizedUrl = normalizedUrl.slice(1);
                }
            }
        }

        return originalCanAcceptNew.call(this, normalizedUrl);
    };
}

export function initializeHMR(): void {
    const isDev = process.env.NODE_ENV !== "production";

    console.error("[HMR] initializeHMR called, NODE_ENV:", process.env.NODE_ENV);

    if (!isDev) {
        console.error("[HMR] Disabled in production mode");
        return;
    }

    console.error("[HMR] Initializing Hot Module Replacement...");

    // Initialize global HMR contexts map if not already present
    if (!(globalThis as any).__hmr_contexts) {
        (globalThis as any).__hmr_contexts = new Map();
    }

    // Start file watcher for app directory
    const rootDir = process.cwd();
    const watchDirs = ["app"];

    startFileWatcher(rootDir, watchDirs);
}
