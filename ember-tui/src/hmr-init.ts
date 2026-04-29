/*---------------------------------------------------------------------------------------------
 *
 * IBM Confidential
 * PID 5900-BVU
 * Copyright IBM Corp. 2026
 *
 *--------------------------------------------------------------------------------------------*/

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

    // Monkey patch emberHotReloadPlugin.__import to convert paths back to Vite format
    const originalImport = (globalThis as any).emberHotReloadPlugin.__import;

    (globalThis as any).emberHotReloadPlugin.__import = function(moduleUrl: string): Promise<any> {
        // Convert normalized path back to Vite format (file:// + absolute path)
        let viteUrl = moduleUrl;

        // If it's a relative path, make it absolute
        if (!viteUrl.startsWith('/') && !viteUrl.startsWith('file://')) {
            if (typeof process !== 'undefined' && process.cwd) {
                viteUrl = process.cwd() + '/' + viteUrl;
            }
        }

        // Add file:// prefix if not present
        if (!viteUrl.startsWith('file://')) {
            viteUrl = 'file://' + viteUrl;
        }

        return originalImport.call(this, viteUrl);
    };
}
