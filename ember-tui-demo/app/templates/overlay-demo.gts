import { Box, Text } from 'ember-tui';
import { trackedObject } from "@ember/reactive/collections";


const state = trackedObject({
  show: false
});

setInterval(() => {
  state.show = !state.show;
}, 5000);



<template>
  <Box @flexDirection="column" @gap={{1}} @width={{30}}>
    {{! Header }}
    <Box @borderStyle="double" @borderColor="cyan" @padding={{1}}>
      <Text @bold={{true}} @color="cyan">
        Overlay Feature Demo
      </Text>
    </Box>

    {{! Demo 4: Highlight Effect }}
    <Box @marginTop={{1}} @flexDirection="column" @gap={{1}}>
      <Text @bold={{true}} @color="green">4. Text Highlighting Effect</Text>

      <Box @position="relative" @height={{8}}>
        <Box @padding={{1}} @flexDirection="column">
          <Text>The overlay feature is perfect for:</Text>
          <Text> </Text>
          <Text>• Highlighting important text</Text>
          <Text>• Creating focus effects</Text>
          <Text>• Building color overlays</Text>
          <Text>• Visual emphasis without replacing content</Text>
        </Box>

        {{! Highlight "important text" }}
        <Box
          @backgroundColor="yellow"
          @overlay={{true}}
          @position={{if state.show 'absolute'}}
          @top={{3}}
          @left={{15}}
          @width={{14}}
          @height={{1}}
        />

        {{! Highlight "focus effects" }}
        <Box
          @backgroundColor="green"
          @overlay={{true}}
          @position={{if state.show 'absolute'}}
          @top={{4}}
          @left={{12}}
          @width={{13}}
          @height={{1}}
        />

        {{! Highlight "color overlays" }}
        <Box
          @backgroundColor="cyan"
          @overlay={{true}}
          @position={{if state.show 'absolute'}}
          @top={{5}}
          @left={{12}}
          @width={{10}}
          @height={{1}}
        />
      </Box>
    </Box>


    {{! Footer Instructions }}
    <Box @marginTop={{2}} @borderStyle="single" @borderColor="gray" @padding={{1}}>
      <Text @color="gray" @dimColor={{true}}>
        Press Ctrl+B to return to main menu
      </Text>
    </Box>
  </Box>

    {{! Overlay with semi-transparent effect via different background }}

</template>
