import Component from '@glimmer/component';
import Box from './Box.gts';
import { type Styles } from '../dom/styles';

interface SpacerSignature {
  Args: {
    flexDirection?: Styles['flexDirection'];
  };
}

/**
 * A flexible space that expands along the major axis of its containing layout.
 *
 * It's useful as a shortcut for filling all the available space between elements.
 */
// eslint-disable-next-line ember/no-empty-glimmer-component-classes
export default class Spacer extends Component<SpacerSignature> {
  <template>
    <Box @flexGrow={{1}} @flexDirection={{@flexDirection}} />
  </template>
}
