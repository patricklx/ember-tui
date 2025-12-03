import 'ember-source/types';


declare module '*.gts' {
  import Component from '@glimmer/component';
  const value: typeof Component;
  export default value;
}

declare module '*.hbs' {
  const value: string;
  export default value;
}
