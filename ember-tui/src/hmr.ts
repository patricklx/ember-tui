export interface HotModule {
  accept(): void;
  accept(callback: (newModule: any) => void): void;
  accept(dep: string, callback: (newModule: any) => void): void;
  accept(deps: readonly string[], callback: (newModule: any) => void): void;
  dispose(callback: (data: any) => void): void;
  decline(): void;
  invalidate(): void;
  on(event: string, callback: (...args: any[]) => void): void;
  data: any;
}

export interface ImportMetaHot {
  hot?: HotModule;
}

type ModuleCallbacks = {
  acceptCallback?: (newModule: any) => void;
  disposeCallback?: (data: any) => void;
  eventCallbacks?: Map<string, Array<(...args: any[]) => void>>;
  data: any;
};

const moduleCallbacks = new Map<string, ModuleCallbacks>();

export function normalizeModuleId(moduleId: string, cwd = process.cwd()): string {
  let normalizedModuleId = moduleId.replace('file://', '');

  if (normalizedModuleId.startsWith(cwd)) {
    normalizedModuleId = normalizedModuleId.slice(cwd.length);
    if (normalizedModuleId.startsWith('/')) {
      normalizedModuleId = normalizedModuleId.slice(1);
    }
  }

  return normalizedModuleId;
}

export function resolveDepPath(moduleId: string, depPath: string, cwd = process.cwd()): string {
  let normalizedDepPath = depPath.replace('file://', '');

  if (normalizedDepPath.startsWith(cwd)) {
    normalizedDepPath = normalizedDepPath.slice(cwd.length);
    if (normalizedDepPath.startsWith('/')) {
      normalizedDepPath = normalizedDepPath.slice(1);
    }
  }

  if (
    normalizedDepPath.startsWith('virtual:') ||
    (!normalizedDepPath.startsWith('.') && !normalizedDepPath.startsWith('/'))
  ) {
    return normalizedDepPath;
  }

  if (normalizedDepPath.startsWith('/')) {
    return normalizedDepPath.slice(1);
  }

  const moduleDir = moduleId.substring(0, moduleId.lastIndexOf('/'));
  const parts = normalizedDepPath.split('/');
  const dirParts = moduleDir.split('/');

  for (const part of parts) {
    if (part === '.') {
      continue;
    }

    if (part === '..') {
      dirParts.pop();
      continue;
    }

    dirParts.push(part);
  }

  return dirParts.join('/');
}

export function createHotContext(moduleId: string): HotModule {
  const normalizedModuleId = normalizeModuleId(moduleId);

  if (!moduleCallbacks.has(normalizedModuleId)) {
    moduleCallbacks.set(normalizedModuleId, { data: {} });
  }

  const callbacks = moduleCallbacks.get(normalizedModuleId)!;

  return {
    accept(
      callbackOrDep?: ((newModule: any) => void) | string | readonly string[],
      callback?: (newModule: any) => void,
    ) {
      if (typeof callbackOrDep === 'function') {
        callbacks.acceptCallback = callbackOrDep;
      } else if (typeof callbackOrDep === 'string') {
        if (!callbacks.data.acceptedDeps) {
          callbacks.data.acceptedDeps = new Map();
        }
        const resolvedDep = resolveDepPath(normalizedModuleId, callbackOrDep);
        callbacks.data.acceptedDeps.set(resolvedDep, callback);
      } else if (Array.isArray(callbackOrDep)) {
        if (!callbacks.data.acceptedDeps) {
          callbacks.data.acceptedDeps = new Map();
        }
        for (const dep of callbackOrDep) {
          const resolvedDep = resolveDepPath(normalizedModuleId, dep);
          callbacks.data.acceptedDeps.set(resolvedDep, callback);
        }
      } else {
        callbacks.acceptCallback = undefined;
      }
    },

    dispose(callback: (data: any) => void) {
      callbacks.disposeCallback = callback;
    },

    decline() {
      callbacks.acceptCallback = undefined;
    },

    invalidate() {
      process.exit(0);
    },

    on(event: string, callback: (...args: any[]) => void) {
      if (!callbacks.eventCallbacks) {
        callbacks.eventCallbacks = new Map();
      }
      if (!callbacks.eventCallbacks.has(event)) {
        callbacks.eventCallbacks.set(event, []);
      }
      callbacks.eventCallbacks.get(event)!.push(callback);
    },

    data: callbacks.data,
  };
}

export async function handleModuleUpdate(moduleId: string): Promise<void> {
  const normalizedModuleId = normalizeModuleId(moduleId);

  for (const [id, callbacks] of moduleCallbacks.entries()) {
    if (callbacks.eventCallbacks?.has('vite:beforeUpdate')) {
      const eventHandlers = callbacks.eventCallbacks.get('vite:beforeUpdate')!;
      for (const handler of eventHandlers) {
        try {
          handler({ type: 'update', path: normalizedModuleId });
        } catch (error) {
          console.error(`[HMR] Error in vite:beforeUpdate handler for ${id}:`, error);
        }
      }
    }
  }

  const visited = new Set<string>();
  const accepted = await propagateUpdate(normalizedModuleId, visited);

  if (!accepted) {
    console.log(`[HMR] No module accepted update for ${normalizedModuleId}, full reload required`);
  }

  for (const [id, callbacks] of moduleCallbacks.entries()) {
    if (callbacks.eventCallbacks?.has('vite:afterUpdate')) {
      const eventHandlers = callbacks.eventCallbacks.get('vite:afterUpdate')!;
      for (const handler of eventHandlers) {
        try {
          handler({ type: 'update', path: normalizedModuleId });
        } catch (error) {
          console.error(`[HMR] Error in vite:afterUpdate handler for ${id}:`, error);
        }
      }
    }
  }
}

async function propagateUpdate(moduleId: string, visited: Set<string>): Promise<boolean> {
  const normalizedModuleId = normalizeModuleId(moduleId);

  if (visited.has(normalizedModuleId)) {
    return false;
  }
  visited.add(normalizedModuleId);

  const callbacks = moduleCallbacks.get(normalizedModuleId);
  if (!callbacks) {
    return false;
  }

  if (callbacks.disposeCallback) {
    callbacks.disposeCallback(callbacks.data);
  }

  const timestamp = Date.now();
  const newModuleUrl = `${normalizedModuleId}?t=${timestamp}`;

  try {
    const newModule = await import(newModuleUrl);
    let accepted = false;

    // A module only self-accepts if it explicitly called import.meta.hot.accept()
    const selfAccepts = callbacks.acceptCallback !== undefined;

    if (selfAccepts) {
      if (callbacks.acceptCallback) {
        callbacks.acceptCallback(newModule);
      }
      accepted = true;
    }

    for (const [parentModuleId, parentCallbacks] of moduleCallbacks.entries()) {
      if (parentModuleId === normalizedModuleId) {
        continue;
      }

      const acceptedDeps = parentCallbacks.data.acceptedDeps as
        | Map<string, ((newModule: any) => void) | undefined>
        | undefined;

      if (acceptedDeps && acceptedDeps.has(normalizedModuleId)) {
        const depCallback = acceptedDeps.get(normalizedModuleId);
        if (depCallback) {
          depCallback(newModule);
          accepted = true;
        }
      }
    }

    if (accepted) {
      return true;
    }

    for (const [parentModuleId, parentCallbacks] of moduleCallbacks.entries()) {
      if (parentModuleId === normalizedModuleId) {
        continue;
      }

      const acceptedDeps = parentCallbacks.data.acceptedDeps as
        | Map<string, ((newModule: any) => void) | undefined>
        | undefined;

      if (acceptedDeps && acceptedDeps.has(normalizedModuleId)) {
        const parentAccepted = await propagateUpdate(parentModuleId, visited);
        if (parentAccepted) {
          return true;
        }
      }
    }

    return false;
  } catch (error) {
    console.error(`[HMR] Failed to update ${normalizedModuleId}:`, error);
    return false;
  }
}

export function getModuleCallbacks() {
  return moduleCallbacks;
}
