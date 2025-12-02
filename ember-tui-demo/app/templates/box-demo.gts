import { Box, Text } from 'ember-tui';

<template>
  {{! Basic Box }}
  <Box>
    <Text @color="green">Basic Box Container</Text>
  </Box>

  {{! Box with background color }}
  <Box @backgroundColor="blue">
    <Text>Text inside a blue box</Text>
  </Box>

  {{! Flexbox layout - horizontal }}
  <Box @flexDirection="row" @gap={{2}}>
    <Text @color="red">Item 1</Text>
    <Text @color="green">Item 2</Text>
    <Text @color="blue">Item 3</Text>
  </Box>

  {{! Flexbox layout - vertical }}
  <Box @flexDirection="column" @gap={{1}}>
    <Text @bold={{true}}>Vertical Layout:</Text>
    <Text>Line 1</Text>
    <Text>Line 2</Text>
    <Text>Line 3</Text>
  </Box>

  {{! Box with padding }}
  <Box @backgroundColor="yellow" @paddingTop={{1}} @paddingBottom={{1}} @paddingLeft={{2}} @paddingRight={{2}}>
    <Text @color="black">Box with padding</Text>
  </Box>

  {{! Box with borders }}
  <Box @borderStyle="single" @borderColor="cyan">
    <Text>Box with cyan border</Text>
  </Box>

  {{! Nested boxes }}
  <Box @borderStyle="double" @borderColor="magenta" @padding={{1}}>
    <Box @backgroundColor="green">
      <Text @color="white" @bold={{true}}>Nested Box</Text>
    </Box>
  </Box>

  {{! Flexbox alignment }}
  <Box @flexDirection="row" @justifyContent="space-between" @width={{50}}>
    <Text>Left</Text>
    <Text>Right</Text>
  </Box>

  <Box @flexDirection="row" @justifyContent="center" @width={{50}}>
    <Text>Centered</Text>
  </Box>

  {{! Complex layout example }}
  <Box @borderStyle="round" @borderColor="green" @padding={{1}}>
    <Box @flexDirection="column" @gap={{1}}>
      <Text @bold={{true}} @color="green">Dashboard</Text>
      <Box @flexDirection="row" @gap={{1}}>
        <Box @backgroundColor="blue" @padding={{1}}>
          <Text @color="white">Status: OK</Text>
        </Box>
        <Box @backgroundColor="yellow" @padding={{1}}>
          <Text @color="black">Warnings: 2</Text>
        </Box>
        <Box @backgroundColor="red" @padding={{1}}>
          <Text @color="white">Errors: 0</Text>
        </Box>
      </Box>
    </Box>
  </Box>
</template>
