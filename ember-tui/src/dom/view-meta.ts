const elementMap: Record<string, any> = {};
const dashRegExp = /-/g;

const defaultViewMeta = {
  skipAddToDom: false,
  isUnaryTag: false,
  tagNamespace: '',
  canBeLeftOpenTag: false,
  component: null,
};

export function normalizeElementName(elementName: string) {
  return `${elementName.replace(dashRegExp, '').toLowerCase()}`;
}

export function getElementMap() {
  return elementMap;
}

export function getViewMeta(elementName: string) {
  const normalizedName = normalizeElementName(elementName);

  let meta = defaultViewMeta;
  const entry = elementMap[normalizedName];

  if (entry && entry.meta) {
    meta = entry.meta;
  }

  return meta;
}

export function isKnownView(elementName: string) {
  return elementMap[normalizeElementName(elementName)];
}

export function setElementEntry(
  normalizedName: string,
  entry: { resolver: () => any; meta: any }
) {
  elementMap[normalizedName] = entry;
}

export { defaultViewMeta };
