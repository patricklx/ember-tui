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
}
