import Component from '@glimmer/component';
import { modifier } from 'ember-modifier';
import { type Styles } from '../dom/styles';
import type ElementNode from '../dom/nodes/ElementNode';

interface BoxSignature {
  Args: Styles;
  Blocks: {
    default: [];
  };
  Element: ElementNode;
}

/**
 * Box component for terminal rendering
 * Provides flexbox layout capabilities similar to div with display: flex
 */

// Applies the component's bundled `@args` directly through ElementNode's own
// setAttribute rather than a template attribute binding (`__attrs__={{this.attrs}}`).
// A template binding hands the object to Glimmer's dynamic-attribute VM
// (SimpleDynamicAttribute), which coerces every non-string value through
// `String(value)` - collapsing an object to the literal text "[object Object]"
// - unless a host app's bundler happens to dedupe `@glimmer/runtime` down to
// the exact class instance that VM path resolves to at render time, which
// ember-tui can't guarantee for every consumer (Vite's optimizeDeps
// pre-bundling, embroider, etc. can all end up with two separate copies).
// Calling setAttribute imperatively from a modifier bypasses that VM path
// entirely, so style args reach ElementNode's own `__attrs__` unpacking
// (camelCase -> kebab-case, real types preserved) regardless of module
// duplication elsewhere in the app.
// `element` is typed `any` (not `ElementNode`) to match the rest of the
// codebase's modifier usage (see InspectorSupport.gts) - ember-tui's own
// tsconfig treats ElementNode as satisfying the DOM `Element` type ember-modifier's
// signature expects, but consumers whose tsconfig pulls in the standard DOM
// lib see ElementNode as a structurally distinct type, which fails
// `E extends Element` type-checking there even though it's correct at runtime.
const applyStyleArgs = modifier(
  (element: any, [attrs]: [Record<string, unknown>]) => {
    (element as ElementNode).setAttribute('__attrs__', attrs);
  },
);

export default class Box extends Component<BoxSignature> {

  get attrs() {
    return Object.assign({}, this.args);
  }

  <template>
    <terminal-box {{applyStyleArgs this.attrs}} ...attributes>{{yield}}</terminal-box>
  </template>
}
