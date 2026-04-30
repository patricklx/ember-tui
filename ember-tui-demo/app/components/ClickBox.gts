import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { on } from '@ember/modifier';
import { Box, Text } from 'ember-tui';

const COLORS = ['#1a1a2e', '#4a0e8f', '#0e4a8f', '#0e8f4a', '#8f4a0e', '#8f0e4a'];
const LABELS = ['Click me!', 'Nice!', 'Again!', 'Keep going!', 'On fire! 🔥', 'Legend! 🏆'];

export default class ClickBox extends Component {
  @tracked clickCount = 0;
  @tracked isHovered = false;

  onClick = () => { this.clickCount++; };
  onMouseEnter = () => { this.isHovered = true; };
  onMouseLeave = () => { this.isHovered = false; };

  get colorIndex() {
    return this.clickCount % COLORS.length;
  }

  get bg() {
    return this.isHovered
      ? COLORS[(this.colorIndex + 1) % COLORS.length]
      : COLORS[this.colorIndex];
  }

  get label() {
    return LABELS[this.colorIndex];
  }

  <template>
    <Box
      {{on "click" this.onClick}}
      {{on "mousemove" this.onMouseEnter}}
      {{on "mouseleave" this.onMouseLeave}}
      @backgroundColor={{this.bg}}
      @width={{30}}
      @height={{5}}
      @alignItems="center"
      @justifyContent="center"
      @flexDirection="column"
      @borderStyle="round"
      @borderColor={{if this.isHovered "white" "gray"}}
      @gap={{1}}
    >
      <Text @color="white" @bold={{true}}>{{this.label}}</Text>
      <Text @color="white" @dimColor={{true}}>clicks: {{this.clickCount}}</Text>
    </Box>
  </template>
}
