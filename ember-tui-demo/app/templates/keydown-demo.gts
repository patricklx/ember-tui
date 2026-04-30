import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { on } from '@ember/modifier';
import { concat } from '@ember/helper';
import { Box, Text } from 'ember-tui';

interface KeyEntry {
  key: string;
  modifiers: string;
  raw: string;
}

class KeydownDemo extends Component {
  @tracked lastEvent: KeyEntry | null = null;
  @tracked history: KeyEntry[] = [];

  handleKey = (event: any) => {
    const modifiers = [
      event.ctrlKey && 'Ctrl',
      event.altKey && 'Alt',
      event.shiftKey && 'Shift',
    ]
      .filter(Boolean)
      .join('+');

    const entry: KeyEntry = {
      key: event.key,
      modifiers,
      raw: JSON.stringify(event.rawInput),
    };

    this.lastEvent = entry;
    this.history = [entry, ...this.history].slice(0, 10);
  };

  get modifierLabel() {
    return this.lastEvent?.modifiers ? ` (${this.lastEvent.modifiers})` : '';
  }

  <template>
    <Box
      {{on "keydown" this.handleKey}}
      @flexDirection="column"
      @padding={{1}}
      @gap={{1}}
    >

      {{! Title }}
      <Box @marginBottom={{1}}>
        <Text @bold={{true}} @color="cyan">Keyboard Event Demo</Text>
      </Box>
      <Text @color="gray">Press any key — all keystrokes are captured below.</Text>

      {{! Last key panel }}
      <Box
        @borderStyle="round"
        @borderColor="cyan"
        @paddingX={{2}}
        @paddingY={{1}}
        @flexDirection="column"
        @gap={{1}}
        @marginTop={{1}}
        @width={{50}}
      >
        <Text @bold={{true}} @color="cyan">Last key pressed</Text>

        {{#if this.lastEvent}}
          <Box @flexDirection="row" @gap={{2}}>
            <Box @width={{10}}>
              <Text @color="gray">key</Text>
            </Box>
            <Text @color="white" @bold={{true}}>{{this.lastEvent.key}}{{this.modifierLabel}}</Text>
          </Box>
          <Box @flexDirection="row" @gap={{2}}>
            <Box @width={{10}}>
              <Text @color="gray">raw</Text>
            </Box>
            <Text @color="yellow">{{this.lastEvent.raw}}</Text>
          </Box>
        {{else}}
          <Text @color="gray" @dimColor={{true}}>— waiting for input —</Text>
        {{/if}}
      </Box>

      {{! History log }}
      <Box
        @borderStyle="single"
        @borderColor="gray"
        @paddingX={{1}}
        @paddingY={{1}}
        @flexDirection="column"
        @width={{50}}
        @marginTop={{1}}
      >
        <Text @bold={{true}} @color="gray">Recent keystrokes (last 10)</Text>
        {{#if this.history.length}}
          {{#each this.history as |entry index|}}
            <Box @flexDirection="row" @gap={{1}}>
              <Box @width={{3}}>
                <Text @color="gray" @dimColor={{true}}>{{index}}</Text>
              </Box>
              <Box @width={{18}}>
                <Text @color="white">{{entry.key}}{{if entry.modifiers (concat " (" entry.modifiers ")") ""}}</Text>
              </Box>
              <Text @color="yellow" @dimColor={{true}}>{{entry.raw}}</Text>
            </Box>
          {{/each}}
        {{else}}
          <Text @color="gray" @dimColor={{true}}>no keystrokes yet</Text>
        {{/if}}
      </Box>

      <Box @marginTop={{1}} @borderStyle="single" @borderColor="gray" @paddingX={{1}}>
        <Text @color="gray">Press Ctrl+B to return to menu</Text>
      </Box>

    </Box>
  </template>
}

export default KeydownDemo;
