import { assert } from '@ember/debug';
// @ts-ignore
import contentFor from '.embroider/content-for.json';

const head = contentFor['/index.html'].head;
const rawConfig = head.substring(head.indexOf('content=\"') + 'content=\"'.length, head.indexOf('\" />'))

const config = JSON.parse(decodeURIComponent(rawConfig));

assert(
  'config is not an object',
  typeof config === 'object' && config !== null
);
assert(
  'modulePrefix was not detected on your config',
  'modulePrefix' in config && typeof config.modulePrefix === 'string'
);
assert(
  'locationType was not detected on your config',
  'locationType' in config && typeof config.locationType === 'string'
);
assert(
  'rootURL was not detected on your config',
  'rootURL' in config && typeof config.rootURL === 'string'
);
assert(
  'APP was not detected on your config',
  'APP' in config && typeof config.APP === 'object'
);

export default config;
