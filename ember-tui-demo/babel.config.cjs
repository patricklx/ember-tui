const {
  babelCompatSupport,
  templateCompatSupport,
} = require('@embroider/compat/babel');
const path = require('path');

process.env.NODE_ENV = 'development';

global.__embroider_macros_global__ = {
  value: null,
  set(key, val) {
    this.value = val;
  },
  get() {
    return this.value;
  }
};


const emberDataAddon = path.resolve('node_modules', 'ember-data', 'addon-main.cjs');
require(emberDataAddon).included.call({
  _internalRegisterV2Addon: () => null,
  parent: {},
  app: {
    project: {
      root: __dirname,
    },
  },
  _super: {
    included: () => null,
  }
})

module.exports = {
  plugins: [
    [
      '@babel/plugin-transform-typescript',
      {
        allExtensions: true,
        onlyRemoveTypeImports: true,
        allowDeclareFields: true,
      },
    ],
    [
      'babel-plugin-ember-template-compilation',
      {
        compilerPath: 'ember-source/dist/ember-template-compiler.js',
        enableLegacyModules: [
          'ember-cli-htmlbars',
          'ember-cli-htmlbars-inline-precompile',
          'htmlbars-inline-precompile',
        ],
        transforms: [...templateCompatSupport()],
      },
    ],
    [
      'module:decorator-transforms',
      {
        runtime: {
          import: require.resolve('decorator-transforms/runtime-esm'),
        },
      },
    ],
    [
      '@babel/plugin-transform-runtime',
      {
        absoluteRuntime: __dirname,
        useESModules: true,
        regenerator: false,
      },
    ],
    ...babelCompatSupport(),
  ],

  generatorOpts: {
    compact: false,
  },
};
