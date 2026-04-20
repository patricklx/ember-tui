import Component from '@glimmer/component';
import { Text, Box } from 'ember-tui';
import { tracked } from '@glimmer/tracking';

/**
 * Simple component for testing HMR functionality
 */
export default class HmrTest extends Component {
  @tracked message = 'Initial HMR Test Message';

  <template>
    <Box @flexDirection="column" @borderStyle="single" @borderColor="green" @paddingLeft={{1}} @paddingRight={{1}}>
      <Text @color="green" @bold={{true}}>HMR_TEST_MARKER_1776722246800 - Modified Content</Text>
      <Text @color="white">{{this.message}}</Text>
    </Box>
  </template>
}
