# TODO - PR #75 Vite Dev Server Refactoring

## ⏰ STOP AT 10 MINUTES
This task is timeboxed. Stop, commit, push, and report status even if incomplete.

## ✅ Completed in this session
- [x] Ran `pnpm install`
- [x] Reviewed PR diff related to `loader.mjs`, `babel.config.mjs`, `index.html`, and HMR wiring
- [x] Removed `ssr: true` usage from the custom Vite loader path
- [x] Switched loader transform path to use `devServer.transformRequest(filePath)` first
- [x] Removed app bootstrap dependency on `ember-tui` custom HMR initialization from `app/app.ts`
- [x] Kept existing `ember-vite-hmr/setup-ember-hmr` initializer in place for now
- [x] Ran `pnpm --filter ember-tui-demo test`

## ⚠️ Current test status
The test run progresses further than before:
- Embroider prebuild completes successfully
- The spawned app starts
- The HMR render-output test is still hanging / not completing successfully within observed time
- Output captured so far is primarily debugger stderr text, while the test expects rendered terminal output updates

## 🔍 Current code state
### `ember-tui-demo/loader.mjs`
- Uses Vite dev server in middleware mode
- Resolves modules with `pluginContainer.resolveId(...)`
- Loads via `transformRequest(filePath)` first
- Falls back to plugin load / filesystem read
- No longer forces SSR mode in resolve/load/transform calls

### `ember-tui-demo/app/app.ts`
- Removed:
  - `import 'ember-tui/hmr-init'`
  - `initializeHMR` import and runtime call
- Kept `import.meta.hot.accept(...)` handling for compat-modules reload behavior

## 🚧 Remaining work
1. Confirm whether `ember-vite-hmr/setup-ember-hmr` alone is sufficient in this Node loader environment
2. Load Vite’s own HMR client explicitly if required by this runtime model
3. Investigate why rendered terminal output is not appearing in the spawned HMR test
4. Decide whether to keep `transformRequest` approach or refine loader fallback behavior further
5. Re-run tests after the next HMR wiring adjustment

## 📁 Files intentionally changed
- `ember-tui-demo/loader.mjs`
- `ember-tui-demo/app/app.ts`
- `todo.md`

## 📌 Notes for follow-up
- Do not commit unrelated generated files
- Do not stage `bob_shell_exec_command_output`
- Keep scope focused on loader/HMR migration