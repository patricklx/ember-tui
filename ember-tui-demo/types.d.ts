import "@glint/ember-tsc/types";
import "ember-source/types";
import "@embroider/core/virtual";
import "ember-tui/types/glint";


// Global type extensions
declare global {
  interface Window {
    EmberENV?: {
      EXTEND_PROTOTYPES?: boolean;
      FEATURES?: Record<string, boolean>;
      _APPLICATION_TEMPLATE_WRAPPER?: boolean;
      _DEFAULT_ASYNC_OBSERVERS?: boolean;
      _JQUERY_INTEGRATION?: boolean;
      _TEMPLATE_ONLY_GLIMMER_COMPONENTS?: boolean;
    };
  }

  interface ImportMetaHot {
    data: any;
    accept(deps: string, cb: (mod: any) => void): void;
    accept(deps: readonly string[], cb: (mod: any) => void): void;
    accept(cb: (mod: any) => void): void;
    accept(): void;
    dispose(cb: (data: any) => void): void;
    decline(): void;
    invalidate(): void;
    on(event: string, cb: (...args: any[]) => void): void;
  }

  interface ImportMeta {
    hot?: ImportMetaHot;
  }
}
