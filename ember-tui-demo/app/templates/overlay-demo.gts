import { Box, Text } from 'ember-tui';

<template>
  <Box @flexDirection="column" @gap={{1}}>
    {{! Header }}
    <Box @borderStyle="double" @borderColor="cyan" @padding={{1}}>
      <Text @bold={{true}} @color="cyan">
        Overlay Feature Demo
      </Text>
    </Box>

    {{! Demo 1: Basic Overlay vs No Overlay }}
    <Box @marginTop={{1}} @flexDirection="column" @gap={{1}}>
      <Text @bold={{true}} @color="green">1. Basic Overlay Comparison</Text>
      
      <Box @flexDirection="column" @gap={{1}}>
        <Text @color="gray">Without overlay (default - text gets covered):</Text>
        <Box @position="relative" @height={{3}}>
          <Box @padding={{1}}>
            <Text>████ Base Text Content Here ████</Text>
          </Box>
          <Box 
            @backgroundColor="red"
            @position="absolute"
            @top={{1}}
            @left={{10}}
            @width={{15}}
            @height={{1}}
          />
        </Box>

        <Text @color="gray">With overlay=true (text preserved with new background):</Text>
        <Box @position="relative" @height={{3}}>
          <Box @padding={{1}}>
            <Text>████ Base Text Content Here ████</Text>
          </Box>
          <Box 
            @backgroundColor="blue"
            @overlay={{true}}
            @position="absolute"
            @top={{1}}
            @left={{10}}
            @width={{15}}
            @height={{1}}
          />
        </Box>
      </Box>
    </Box>

    {{! Demo 2: Multiple Overlays }}
    <Box @marginTop={{1}} @flexDirection="column" @gap={{1}}>
      <Text @bold={{true}} @color="green">2. Multiple Colored Overlays</Text>
      
      <Box @position="relative" @height={{5}}>
        <Box @padding={{1}}>
          <Text>┌─────────────────────────────────────────┐</Text>
          <Text>│ Original Content With Multiple Lines   │</Text>
          <Text>│ Each Line Can Have Different Overlays  │</Text>
          <Text>└─────────────────────────────────────────┘</Text>
        </Box>

        {{! Red overlay on first line }}
        <Box 
          @backgroundColor="red"
          @overlay={{true}}
          @position="absolute"
          @top={{1}}
          @left={{5}}
          @width={{20}}
          @height={{1}}
        />

        {{! Green overlay on second line }}
        <Box 
          @backgroundColor="green"
          @overlay={{true}}
          @position="absolute"
          @top={{2}}
          @left={{10}}
          @width={{25}}
          @height={{1}}
        />

        {{! Yellow overlay on third line }}
        <Box 
          @backgroundColor="yellow"
          @overlay={{true}}
          @position="absolute"
          @top={{3}}
          @left={{15}}
          @width={{20}}
          @height={{1}}
        />
      </Box>
    </Box>

    {{! Demo 3: Overlay with Borders }}
    <Box @marginTop={{1}} @flexDirection="column" @gap={{1}}>
      <Text @bold={{true}} @color="green">3. Overlay with Borders</Text>
      
      <Box @position="relative" @height={{7}}>
        <Box @padding={{1}}>
          <Text @color="cyan">╔══════════════════════════════════╗</Text>
          <Text @color="cyan">║  Background Content Text Here   ║</Text>
          <Text @color="cyan">║  Can Be Any Length or Format     ║</Text>
          <Text @color="cyan">║  123456789 ABCDEFG !@#$%^&*()   ║</Text>
          <Text @color="cyan">╚══════════════════════════════════╝</Text>
        </Box>

        {{! Overlay box with border }}
        <Box 
          @backgroundColor="magenta"
          @overlay={{true}}
          @borderStyle="round"
          @borderColor="white"
          @position="absolute"
          @top={{2}}
          @left={{10}}
          @width={{20}}
          @height={{3}}
        >
          <Text @color="white" @bold={{true}}>Overlay Box</Text>
        </Box>
      </Box>
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
          @position="absolute"
          @top={{3}}
          @left={{15}}
          @width={{14}}
          @height={{1}}
        />

        {{! Highlight "focus effects" }}
        <Box 
          @backgroundColor="green"
          @overlay={{true}}
          @position="absolute"
          @top={{4}}
          @left={{12}}
          @width={{13}}
          @height={{1}}
        />

        {{! Highlight "color overlays" }}
        <Box 
          @backgroundColor="cyan"
          @overlay={{true}}
          @position="absolute"
          @top={{5}}
          @left={{12}}
          @width={{14}}
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
</template>
