import type ElementNode from '../dom/nodes/ElementNode';
import '@glint/ember-tsc/types/-private/dsl/globals.d.ts';
import '@glint/template/-private/dsl/emit';
import type { ComponentLike, ModifierLike } from '@glint/template';
import 'ember-modifier';
import type {
  EmptyObject,
  NamedArgs,
  PositionalArgs,
} from 'ember-modifier/-private/signature';
import type {
  FunctionBasedModifier,
  Teardown,
} from 'ember-modifier/-private/function-based/modifier';

declare module 'ember-modifier' {
  export function modifier<
    E extends ElementNode<any>,
    P extends unknown[] = [],
    N = EmptyObject,
  >(
    fn: (element: E, positional: P, named: N) => void | Teardown,
  ): FunctionBasedModifier<{
    Args: {
      Positional: P;
      Named: N;
    };
    Element: E;
  }>;
  type ElementFor<S> = 'Element' extends keyof S
    ? S['Element'] extends ElementNode<any>
      ? S['Element']
      : ElementNode<any>
    : ElementNode<any>;
  export function modifier<S>(
    fn: (
      element: ElementFor<S>,
      positional: PositionalArgs<S>,
      named: NamedArgs<S>,
    ) => void | Teardown,
  ): FunctionBasedModifier<{
    Element: ElementFor<S>;
    Args: {
      Named: NamedArgs<S>;
      Positional: PositionalArgs<S>;
    };
  }>;
}

declare module '@glint/ember-tsc/-private/dsl/globals' {
  type InElementKeyword = ComponentLike<{
    Args: {
      Positional: [element: ElementNode<any>];
      Named: {
        insertBefore?: null | undefined;
      };
    };
    Blocks: {
      default: [];
    };
  }>;
  export default interface Globals {
    'in-element': InElementKeyword;
  }
}

declare module '@glint/template/-private/dsl/emit' {
  export function emitElement<Name extends string>(
    name: Name,
  ): {
    element: ElementNode<any>;
  };

  export function applySplattributes<
    SourceElement extends ElementNode<any>,
    TargetElement extends SourceElement,
  >(source: SourceElement, target: TargetElement): void;

  export function applyAttributes(
    element: ElementNode<any>,
    attrs: Record<string, any>,
  ): void;
}

declare module '@ember/modifier' {
  interface OnModifierArgs {
    capture?: boolean;
    once?: boolean;
    passive?: boolean;
  }
  type OnModifierType = abstract new <Name extends string>() => InstanceType<
    ModifierLike<{
      Element: ElementNode<any>;
      Args: {
        Named: OnModifierArgs;
        Positional: [name: Name, callback: (event: any) => void];
      };
    }>
  >;
  // eslint-disable-next-line
  export interface OnModifier extends OnModifierType {}
}

declare module '*.gts' {
  import Component from '@glimmer/component';
  const value: typeof Component;
  export default value;
}

declare module '*.hbs' {
  const value: string;
  export default value;
}
