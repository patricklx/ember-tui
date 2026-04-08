import Component from '@glimmer/component';
import { Text, Box } from 'ember-tui';
import { tracked } from '@glimmer/tracking';

/**
 * Simple component for testing HMR functionality
 */
export default class HmrTest extends Component {
  // @ts-expect-error - decorator syntax issue in .gts files
  @tracked message = 'Initial HMR Test Message';

  <template>
    <Box @flexDirection="column" @borderStyle="single" @borderColor="green" @paddingLeft={{1}} @paddingRight={{1}}>
      <Text @color="green" @bold={{true}}>HMR Test Component</Text>
      <Text @color="white">{{this.message}}</Text>
    </Box>
  </template>
}
