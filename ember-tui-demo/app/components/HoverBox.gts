import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { on } from '@ember/modifier';
import { Box, Text } from 'ember-tui';

interface HoverBoxSignature {
  Args: {
    label: string;
    color: string;
    hoverColor: string;
    textColor?: string;
    width?: number;
    height?: number;
  };
}

export default class HoverBox extends Component<HoverBoxSignature> {
  @tracked isHovered = false;

  onMouseEnter = () => { this.isHovered = true; };
  onMouseLeave = () => { this.isHovered = false; };

  get bg() {
    return this.isHovered ? this.args.hoverColor : this.args.color;
  }

  get label() {
    return this.isHovered ? `▶ ${this.args.label}` : `  ${this.args.label}`;
  }

  <template>
    <Box
      {{on "mousemove" this.onMouseEnter}}
      {{on "mouseleave" this.onMouseLeave}}
      @backgroundColor={{this.bg}}
      @width={{if @width @width 24}}
      @height={{if @height @height 3}}
      @alignItems="center"
      @justifyContent="center"
      @borderStyle="single"
      @borderColor={{if this.isHovered "white" "gray"}}
    >
      <Text @color={{if @textColor @textColor "white"}} @bold={{this.isHovered}}>
        {{this.label}}
      </Text>
    </Box>
  </template>
}
