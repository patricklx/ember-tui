import Component from '@glimmer/component';
import { Text, Box, Spacer, Newline } from 'etui';

/**
 * Test template for Newline and Spacer components
 */
export default class ComponentTestTemplate extends Component {
  <template>
    <Box @flexDirection="column" @borderStyle="single" @borderColor="green" @padding={{1}}>
      <Text @bold={{true}} @color="cyan">Component Test: Newline & Spacer</Text>
      
      <Box @marginTop={{1}}>
        <Text @color="yellow">Testing Spacer component:</Text>
      </Box>
      
      <Box @flexDirection="row" @width={{60}} @borderStyle="round" @borderColor="blue" @padding={{1}}>
        <Text @color="green">Left</Text>
        <Spacer />
        <Text @color="magenta">Right (with Spacer between)</Text>
      </Box>
      
      <Box @marginTop={{1}} @flexDirection="row" @width={{60}}>
        <Text>Item 1</Text>
        <Spacer />
        <Text>Item 2</Text>
        <Spacer />
        <Text>Item 3</Text>
      </Box>
      
      <Box @marginTop={{1}}>
        <Text @color="green" @bold={{true}}>✓ Spacer component works!</Text>
      </Box>
      
      <Box @marginTop={{1}}>
        <Text @color="yellow">Testing Newline component:</Text>
      </Box>
      
      <Text>Line 1<Newline />Line 2<Newline @count={{2}} />Line 3 (after 2 newlines)</Text>
      
      <Box @marginTop={{1}}>
        <Text @color="green" @bold={{true}}>✓ Both components loaded successfully!</Text>
      </Box>
    </Box>
  </template>
}
