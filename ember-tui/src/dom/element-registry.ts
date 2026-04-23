import type { NativeElementsTagNameMap } from './native-elements-tag-name-map';
import type ElementNode from "./nodes/ElementNode";
import { normalizeElementName } from "./view-meta";

const elementMap: Record<string, any> = {};

const defaultViewMeta = {
  skipAddToDom: false,
  isUnaryTag: false,
  tagNamespace: '',
  canBeLeftOpenTag: false,
  component: null,
};



export function registerElement(
  elementName: string,
  resolver: () => ElementNode,
  meta: object | null = null,
) {
  const normalizedName = normalizeElementName(elementName);

  meta = Object.assign({}, defaultViewMeta, meta);

  if (elementMap[normalizedName]) {
    throw new Error(`Element for ${elementName} already registered.`);
  }

  const entry = {
    resolver: resolver,
    meta: meta,
  };
  const dashName = elementName
    .replace(/([a-zA-Z])(?=[A-Z])/g, '$1-')
    .toLowerCase();
  elementMap[normalizedName] = entry;
  elementMap[dashName] = entry;
  elementMap[elementName] = entry;
}

export function getElementMap() {
  return elementMap;
}

export function getViewClass(elementName: string) {
  const normalizedName = normalizeElementName(elementName);
  const entry = elementMap[normalizedName];

  if (!entry) {
    throw new TypeError(`No known component for element ${elementName}.`);
  }

  try {
    return entry.resolver();
  } catch (e) {
    throw new TypeError(`Could not load view for: ${elementName}. ${e}`);
  }
}



export function isKnownView(elementName: string) {
  return elementMap[normalizeElementName(elementName)];
}

export function createElement<T extends keyof NativeElementsTagNameMap>(
  elementName: T,
): NativeElementsTagNameMap[T] {
  const normalizedName = normalizeElementName(elementName);
  const elementDefinition = elementMap[normalizedName];
  if (!elementDefinition) {
    if (process.env.NODE_ENV === 'development') {
      return createElement('div' as any);
    }
    throw new TypeError(`No known component for element ${elementName}.`);
  }
  return elementDefinition.resolver();
}
