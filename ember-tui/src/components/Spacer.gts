import Component from '@glimmer/component';
import Box from './Box.gts';

/**
 * A flexible space that expands along the major axis of its containing layout.
 *
 * It's useful as a shortcut for filling all the available space between elements.
 */
export default class Spacer extends Component {
  <template>
    <Box @flexGrow={{1}} @flexDirection={{@flexDirection}} />
  </template>
}
