import Component from '@glimmer/component';

interface NewlineSignature {
  Args: {
    /**
     * Number of newlines to insert.
     * @default 1
     */
    count?: number;
  };
}

/**
 * Adds one or more newline (\n) characters. Must be used within <Text> components.
 */
export default class Newline extends Component<NewlineSignature> {
  get newlines() {
    const count = this.args.count ?? 1;
    return '\n'.repeat(count);
  }

  <template><terminal-text pre-formatted={{true}}>{{this.newlines}}</terminal-text></template>
}
