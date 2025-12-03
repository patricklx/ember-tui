# Ember TUI

> Ember.js for CLIs. Build and test your CLI output using components.

Ember TUI provides the same component-based UI building experience that Ember.js offers in the browser, but for command-line apps.
It uses [Yoga](https://github.com/facebook/yoga) to build Flexbox layouts in the terminal, so most CSS-like properties are available in Ember TUI as well.
If you are already familiar with Ember.js, you already know Ember TUI.

Since Ember TUI is built on Ember.js, all features of Ember.js are supported.
Head over to the [Ember.js](https://emberjs.com) website for documentation on how to use it.
Only Ember TUI's methods are documented in this readme.

## Install

```sh
npm install ember-tui
```

## Usage

```gts
import { render, Text } from 'ember-tui';
import { tracked } from '@glimmer/tracking';

class Counter {
  @tracked counter = 0;

  constructor() {
    setInterval(() => {
      this.counter++;
    }, 100);
  }
}

const counter = new Counter();

const template = <template>
  <Text color="green">{{counter.counter}} tests passed</Text>
</template>;

render(template);
```

## Contents

- [Getting Started](#getting-started)
- [Components](#components)
  - [`<Text>`](#text)
  - [`<Box>`](#box)
  - [`<Newline>`](#newline)
  - [`<Spacer>`](#spacer)
  - [`<Static>`](#static)
  - [`<Transform>`](#transform)
- [API](#api)
- [Examples](#examples)

## Getting Started

Ember TUI uses [Yoga](https://github.com/facebook/yoga), a Flexbox layout engine, to build great user interfaces for your CLIs using familiar CSS-like properties you've used when building apps for the browser.
It's important to remember that each element is a Flexbox container.
Think of it as if every `<div>` in the browser had `display: flex`.
See [`<Box>`](#box) built-in component below for documentation on how to use Flexbox layouts in Ember TUI.
Note that all text must be wrapped in a [`<Text>`](#text) component.

## Components

### `<Text>`

This component can display text and change its style to make it bold, underlined, italic, or strikethrough.

```gts
import { render, Text } from 'ember-tui';

const template = <template>
  <Text @color="green">I am green</Text>
  <Text @color="black" @backgroundColor="white">I am black on white</Text>
  <Text @color="#ffffff">I am white</Text>
  <Text @bold={{true}}>I am bold</Text>
  <Text @italic={{true}}>I am italic</Text>
  <Text @underline={{true}}>I am underline</Text>
  <Text @strikethrough={{true}}>I am strikethrough</Text>
  <Text @inverse={{true}}>I am inversed</Text>
</template>;

render(template);
```

**Note:** `<Text>` allows only text nodes and nested `<Text>` components inside of it. For example, `<Box>` component can't be used inside `<Text>`.

#### color

Type: `string`

Change text color.
Ember TUI uses [chalk](https://github.com/chalk/chalk) under the hood, so all its functionality is supported.

```gts
<Text @color="green">Green</Text>
<Text @color="#005cc5">Blue</Text>
<Text @color="rgb(232, 131, 136)">Red</Text>
```

#### backgroundColor

Type: `string`

Same as `color` above, but for background.

```gts
<Text @backgroundColor="green" @color="white">Green</Text>
<Text @backgroundColor="#005cc5" @color="white">Blue</Text>
<Text @backgroundColor="rgb(232, 131, 136)" @color="white">Red</Text>
```

#### dimColor

Type: `boolean`\
Default: `false`

Dim the color (make it less bright).

```gts
<Text @color="red" @dimColor={{true}}>Dimmed Red</Text>
```

#### bold

Type: `boolean`\
Default: `false`

Make the text bold.

#### italic

Type: `boolean`\
Default: `false`

Make the text italic.

#### underline

Type: `boolean`\
Default: `false`

Make the text underlined.

#### strikethrough

Type: `boolean`\
Default: `false`

Make the text crossed with a line.

#### inverse

Type: `boolean`\
Default: `false`

Invert background and foreground colors.

```gts
<Text @inverse={{true}} @color="yellow">Inversed Yellow</Text>
```

#### wrap

Type: `string`\
Allowed values: `wrap` `truncate` `truncate-start` `truncate-middle` `truncate-end`\
Default: `wrap`

This property tells Ember TUI to wrap or truncate text if its width is larger than the container.
If `wrap` is passed (the default), Ember TUI will wrap text and split it into multiple lines.
If `truncate-*` is passed, Ember TUI will truncate text instead, resulting in one line of text with the rest cut off.

```gts
<Box @width={{7}}>
  <Text>Hello World</Text>
</Box>
//=> 'Hello\nWorld'

// `truncate` is an alias to `truncate-end`
<Box @width={{7}}>
  <Text @wrap="truncate">Hello World</Text>
</Box>
//=> 'Hello…'

<Box @width={{7}}>
  <Text @wrap="truncate-middle">Hello World</Text>
</Box>
//=> 'He…ld'

<Box @width={{7}}>
  <Text @wrap="truncate-start">Hello World</Text>
</Box>
//=> '…World'
```

### `<Box>`

`<Box>` is an essential Ember TUI component to build your layout.
It's like `<div style="display: flex">` in the browser.

```gts
import { render, Box, Text } from 'ember-tui';

const template = <template>
  <Box @margin={{2}}>
    <Text>This is a box with margin</Text>
  </Box>
</template>;

render(template);
```

#### Dimensions

##### width

Type: `number` `string`

Width of the element in spaces.
You can also set it as a percentage, which will calculate the width based on the width of the parent element.

```gts
<Box @width={{4}}>
  <Text>X</Text>
</Box>
//=> 'X   '
```

```gts
<Box @width={{10}}>
  <Box @width="50%">
    <Text>X</Text>
  </Box>
  <Text>Y</Text>
</Box>
//=> 'X    Y'
```

##### height

Type: `number` `string`

Height of the element in lines (rows).
You can also set it as a percentage, which will calculate the height based on the height of the parent element.

```gts
<Box @height={{4}}>
  <Text>X</Text>
</Box>
//=> 'X\n\n\n'
```

##### minWidth

Type: `number`

Sets a minimum width of the element.

##### minHeight

Type: `number`

Sets a minimum height of the element.

#### Padding

##### paddingTop

Type: `number`\
Default: `0`

Top padding.

##### paddingBottom

Type: `number`\
Default: `0`

Bottom padding.

##### paddingLeft

Type: `number`\
Default: `0`

Left padding.

##### paddingRight

Type: `number`\
Default: `0`

Right padding.

##### paddingX

Type: `number`\
Default: `0`

Horizontal padding. Equivalent to setting `paddingLeft` and `paddingRight`.

##### paddingY

Type: `number`\
Default: `0`

Vertical padding. Equivalent to setting `paddingTop` and `paddingBottom`.

##### padding

Type: `number`\
Default: `0`

Padding on all sides. Equivalent to setting `paddingTop`, `paddingBottom`, `paddingLeft` and `paddingRight`.

```gts
<Box @paddingTop={{2}}><Text>Top</Text></Box>
<Box paddingBottom={{2}}><Text>Bottom</Text></Box>
<Box @paddingLeft={{2}}><Text>Left</Text></Box>
<Box paddingRight={{2}}><Text>Right</Text></Box>
<Box paddingX={{2}}><Text>Left and right</Text></Box>
<Box paddingY={{2}}><Text>Top and bottom</Text></Box>
<Box padding={{2}}><Text>Top, bottom, left and right</Text></Box>
```

#### Margin

##### marginTop

Type: `number`\
Default: `0`

Top margin.

##### marginBottom

Type: `number`\
Default: `0`

Bottom margin.

##### marginLeft

Type: `number`\
Default: `0`

Left margin.

##### marginRight

Type: `number`\
Default: `0`

Right margin.

##### marginX

Type: `number`\
Default: `0`

Horizontal margin. Equivalent to setting `marginLeft` and `marginRight`.

##### marginY

Type: `number`\
Default: `0`

Vertical margin. Equivalent to setting `marginTop` and `marginBottom`.

##### margin

Type: `number`\
Default: `0`

Margin on all sides. Equivalent to setting `marginTop`, `marginBottom`, `marginLeft` and `marginRight`.

```gts
<Box @marginTop={{2}}><Text>Top</Text></Box>
<Box marginBottom={{2}}><Text>Bottom</Text></Box>
<Box marginLeft={{2}}><Text>Left</Text></Box>
<Box @marginRight={{2}}><Text>Right</Text></Box>
<Box marginX={{2}}><Text>Left and right</Text></Box>
<Box marginY={{2}}><Text>Top and bottom</Text></Box>
<Box margin={{2}}><Text>Top, bottom, left and right</Text></Box>
```

#### Gap

##### gap

Type: `number`\
Default: `0`

Size of the gap between an element's columns and rows. A shorthand for `columnGap` and `rowGap`.

```gts
<Box @gap={{1}} @width={{3}} @flexWrap="wrap">
  <Text>A</Text>
  <Text>B</Text>
  <Text>C</Text>
</Box>
// A B
//
// C
```

##### columnGap

Type: `number`\
Default: `0`

Size of the gap between an element's columns.

```gts
<Box @columnGap={{1}}>
  <Text>A</Text>
  <Text>B</Text>
</Box>
// A B
```

##### rowGap

Type: `number`\
Default: `0`

Size of the gap between an element's rows.

```gts
<Box @flexDirection="column" @rowGap={{1}}>
  <Text>A</Text>
  <Text>B</Text>
</Box>
// A
//
// B
```

#### Flex

##### flexGrow

Type: `number`\
Default: `0`

See [flex-grow](https://css-tricks.com/almanac/properties/f/flex-grow/).

```gts
<Box>
  <Text>Label:</Text>
  <Box @flexGrow={{1}}>
    <Text>Fills all remaining space</Text>
  </Box>
</Box>
```

##### flexShrink

Type: `number`\
Default: `1`

See [flex-shrink](https://css-tricks.com/almanac/properties/f/flex-shrink/).

```gts
<Box @width={{20}}>
  <Box @flexShrink={{2}} @width={{10}}>
    <Text>Will be 1/4</Text>
  </Box>
  <Box @width={{10}}>
    <Text>Will be 3/4</Text>
  </Box>
</Box>
```

##### flexBasis

Type: `number` `string`

See [flex-basis](https://css-tricks.com/almanac/properties/f/flex-basis/).

```gts
<Box @width={{6}}>
  <Box @flexBasis={{3}}>
    <Text>X</Text>
  </Box>
  <Text>Y</Text>
</Box>
//=> 'X  Y'
```

##### flexDirection

Type: `string`\
Allowed values: `row` `row-reverse` `column` `column-reverse`

See [flex-direction](https://css-tricks.com/almanac/properties/f/flex-direction/).

```gts
<Box>
  <Box @marginRight={{1}}>
    <Text>X</Text>
  </Box>
  <Text>Y</Text>
</Box>
// X Y

<Box @flexDirection="row-reverse">
  <Text>X</Text>
  <Box @marginRight={{1}}>
    <Text>Y</Text>
  </Box>
</Box>
// Y X

<Box @flexDirection="column">
  <Text>X</Text>
  <Text>Y</Text>
</Box>
// X
// Y
```

##### flexWrap

Type: `string`\
Allowed values: `nowrap` `wrap` `wrap-reverse`

See [flex-wrap](https://css-tricks.com/almanac/properties/f/flex-wrap/).

```gts
<Box @width={{2}} @flexWrap="wrap">
  <Text>A</Text>
  <Text>BC</Text>
</Box>
// A
// B C
```

##### alignItems

Type: `string`\
Allowed values: `flex-start` `center` `flex-end`

See [align-items](https://css-tricks.com/almanac/properties/a/align-items/).

```gts
<Box @alignItems="flex-start">
  <Box @marginRight={{1}}>
    <Text>X</Text>
  </Box>
  <Text>A<Newline/>B<Newline/>C</Text>
</Box>
// X A
//   B
//   C
```

##### alignSelf

Type: `string`\
Default: `auto`\
Allowed values: `auto` `flex-start` `center` `flex-end`

See [align-self](https://css-tricks.com/almanac/properties/a/align-self/).

```gts
<Box @height={{3}}>
  <Box @alignSelf="flex-start">
    <Text>X</Text>
  </Box>
</Box>
// X
//
//
```

##### justifyContent

Type: `string`\
Allowed values: `flex-start` `center` `flex-end` `space-between` `space-around` `space-evenly`

See [justify-content](https://css-tricks.com/almanac/properties/j/justify-content/).

```gts
<Box @justifyContent="flex-start">
  <Text>X</Text>
</Box>
// [X      ]

<Box @justifyContent="center">
  <Text>X</Text>
</Box>
// [   X   ]

<Box @justifyContent="flex-end">
  <Text>X</Text>
</Box>
// [      X]
```

#### Visibility

##### display

Type: `string`\
Allowed values: `flex` `none`\
Default: `flex`

Set this property to `none` to hide the element.

##### overflowX

Type: `string`\
Allowed values: `visible` `hidden`\
Default: `visible`

Behavior for an element's overflow in the horizontal direction.

##### overflowY

Type: `string`\
Allowed values: `visible` `hidden`\
Default: `visible`

Behavior for an element's overflow in the vertical direction.

##### overflow

Type: `string`\
Allowed values: `visible` `hidden`\
Default: `visible`

A shortcut for setting `overflowX` and `overflowY` at the same time.

#### Borders

##### borderStyle

Type: `string`\
Allowed values: `single` `double` `round` `bold` `singleDouble` `doubleSingle` `classic`

Add a border with a specified style.
If `borderStyle` is `undefined` (the default), no border will be added.
Ember TUI uses border styles from the [`cli-boxes`](https://github.com/sindresorhus/cli-boxes) module.

```gts
<Box @flexDirection="column">
  <Box>
    <Box @borderStyle="single" @marginRight={{2}}>
      <Text>single</Text>
    </Box>
    <Box @borderStyle="double" @marginRight={{2}}>
      <Text>double</Text>
    </Box>
    <Box @borderStyle="round" @marginRight={{2}}>
      <Text>round</Text>
    </Box>
    <Box @borderStyle="bold">
      <Text>bold</Text>
    </Box>
  </Box>
</Box>
```

##### borderColor

Type: `string`

Change border color.
A shorthand for setting `borderTopColor`, `borderRightColor`, `borderBottomColor`, and `borderLeftColor`.

```gts
<Box @borderStyle="round" @borderColor="green">
  <Text>Green Rounded Box</Text>
</Box>
```

##### borderDimColor

Type: `boolean`\
Default: `false`

Dim the border color.
A shorthand for setting `borderTopDimColor`, `borderBottomDimColor`, `borderLeftDimColor`, and `borderRightDimColor`.

```gts
<Box @borderStyle="round" @borderDimColor={{true}}>
  <Text>Hello world</Text>
</Box>
```

##### borderTop / borderRight / borderBottom / borderLeft

Type: `boolean`\
Default: `true`

Determines whether the respective border is visible.

#### Background

##### backgroundColor

Type: `string`

Background color for the element.

Accepts the same values as [`color`](#color) in the `<Text>` component.

```gts
<Box @flexDirection="column">
  <Box @backgroundColor="red" @width={{20}} @height={{5}} @alignSelf="flex-start">
    <Text>Red background</Text>
  </Box>
  <Box @backgroundColor="#FF8800" @width={{20}} @height={{3}} @marginTop={{1}} @alignSelf="flex-start">
    <Text>Orange background</Text>
  </Box>
</Box>
```

The background color fills the entire `<Box>` area and is inherited by child `<Text>` components unless they specify their own `backgroundColor`.

### `<Newline>`

Adds one or more newline (`\n`) characters.
Must be used within `<Text>` components.

#### count

Type: `number`\
Default: `1`

Number of newlines to insert.

```gts
import { render, Text, Newline } from 'ember-tui';

const template = <template>
  <Text>
    <Text @color="green">Hello</Text>
    <Newline />
    <Text @color="red">World</Text>
  </Text>
</template>;

render(template);
```

Output:

```
Hello
World
```

### `<Spacer>`

A flexible space that expands along the major axis of its containing layout.
It's useful as a shortcut for filling all the available space between elements.

For example, using `<Spacer>` in a `<Box>` with default flex direction (`row`) will position "Left" on the left side and will push "Right" to the right side.

```gts
import { render, Box, Text, Spacer } from 'ember-tui';

const template = <template>
  <Box>
    <Text>Left</Text>
    <Spacer />
    <Text>Right</Text>
  </Box>
</template>;

render(template);
```

### `<Static>`

`<Static>` component permanently renders its output above everything else.
It's useful for displaying activity like completed tasks or logs - things that
don't change after they're rendered (hence the name "Static").

```gts
import { render, Static, Box, Text } from 'ember-tui';
import { tracked } from '@glimmer/tracking';

class TestRunner {
  @tracked tests = [];

  constructor() {
    let completedTests = 0;
    const run = () => {
      if (completedTests++ < 10) {
        this.tests = [
          ...this.tests,
          {
            id: this.tests.length,
            title: `Test #${this.tests.length + 1}`
          }
        ];
        setTimeout(run, 100);
      }
    };
    run();
  }
}

const runner = new TestRunner();

const template = <template>
  <Static @items={{runner.tests}} as |test|>
    <Box key={{test.id}}>
      <Text color="green">✔ {{test.title}}</Text>
    </Box>
  </Static>

  <Box @marginTop={{1}}>
    <Text @dimColor={{true}}>Completed tests: {{runner.tests.length}}</Text>
  </Box>
</template>;

render(template);
```

**Note:** `<Static>` only renders new items in the `items` array and ignores items
that were previously rendered.

#### items

Type: `Array`

Array of items of any type to render using the block you pass as component content.

### `<Transform>`

Transform a string representation of components before they're written to output.
For example, you might want to apply a gradient to text or create some text effects.

**Note:** `<Transform>` must be applied only to `<Text>` children components and shouldn't change the dimensions of the output; otherwise, the layout will be incorrect.

```gts
import { render, Transform, Text } from 'ember-tui';

const template = <template>
  <Transform @transform={{fn (output) => output.toUpperCase()}}>
    <Text>Hello World</Text>
  </Transform>
</template>;

render(template);
```

Since the `transform` function converts all characters to uppercase, the final output rendered to the terminal will be "HELLO WORLD", not "Hello World".

#### transform(outputLine, index)

Type: `Function`

Function that transforms children output.
It accepts children and must return transformed children as well.

##### children

Type: `string`

Output of child components.

##### index

Type: `number`

The zero-indexed line number of the line that's currently being transformed.

## API

### render(tree, options?)

Mount a component and render the output.

#### tree

Type: `Component`

The root component to render.

#### options

Type: `object`

##### stdout

Type: `stream.Writable`\
Default: `process.stdout`

Output stream where the app will be rendered.

##### stdin

Type: `stream.Readable`\
Default: `process.stdin`

Input stream where the app will listen for input.

##### stderr

Type: `stream.Writable`\
Default: `process.stderr`

Error stream.

### startRender(document, options?)

Start the render loop for a document.

#### document

Type: `DocumentNode`

The document node to render.

#### options

Type: `object`

Same options as `render()`.

## Examples

Check out the [examples](ember-tui-demo/app/templates) directory for more examples:

- [Colors Demo](ember-tui-demo/app/templates/colors.gts) - Demonstrates text colors and styles
- [Box Layout Demo](ember-tui-demo/app/templates/box-demo.gts) - Shows flexbox layout capabilities
- [Static Component](ember-tui-demo/app/templates/static-test.gts) - Example of using Static component
- [Lorem Ipsum](ember-tui-demo/app/templates/lorem.gts) - Text wrapping and layout

## License

MIT
