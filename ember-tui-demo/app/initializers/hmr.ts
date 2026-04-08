import { initializeHMR } from "ember-tui";
import 'ember-vite-hmr/setup-ember-hmr';

export function initialize(): void {
    const isDev = process.env.NODE_ENV !== "production";

    if (isDev) {
        initializeHMR();
    }
}

export default {
    initialize,
};
