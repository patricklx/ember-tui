import { Box, Text } from 'ember-tui';
import HoverBox from '../components/HoverBox.gts';
import ClickBox from '../components/ClickBox.gts';

<template>
  <Box @flexDirection="column" @gap={{1}} @padding={{1}}>

    <Box @flexDirection="column" @marginBottom={{1}}>
      <Text @bold={{true}} @color="cyan">Mouse Hover Demo</Text>
      <Text @color="gray">Move your cursor over the boxes below</Text>
    </Box>

    {{! Row of color buttons }}
    <Box @flexDirection="row" @gap={{2}}>
      <HoverBox @label="Red"    @color="darkred"      @hoverColor="red"     @textColor="white" />
      <HoverBox @label="Green"  @color="darkgreen"    @hoverColor="green"   @textColor="white" />
      <HoverBox @label="Blue"   @color="darkblue"     @hoverColor="blue"    @textColor="white" />
    </Box>

    {{! Row of more boxes }}
    <Box @flexDirection="row" @gap={{2}}>
      <HoverBox @label="Cyan"    @color="#005f5f" @hoverColor="cyan"    @textColor="black" />
      <HoverBox @label="Magenta" @color="#5f005f" @hoverColor="magenta" @textColor="white" />
      <HoverBox @label="Yellow"  @color="#5f5f00" @hoverColor="yellow"  @textColor="black" />
    </Box>

    {{! A wider tall box }}
    <HoverBox
      @label="Wide Box — hover me!"
      @color="#1a1a2e"
      @hoverColor="#16213e"
      @textColor="cyan"
      @width={{52}}
      @height={{5}}
    />

    {{! Click demo }}
    <Box @flexDirection="column" @marginTop={{1}} @gap={{1}}>
      <Text @bold={{true}} @color="cyan">Click Demo</Text>
      <Text @color="gray">Click the box below — it changes with every click</Text>
      <ClickBox />
    </Box>

    <Box @marginTop={{1}} @borderStyle="single" @borderColor="gray" @paddingX={{1}}>
      <Text @color="gray">Press Ctrl+B to return to menu</Text>
    </Box>

  </Box>
</template>
