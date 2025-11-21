import Component from '@glimmer/component';
import { Text } from 'ember-console';

/**
 * Colors demo view showcasing text styling capabilities
 */
export default class ColorsTemplate extends Component {
	<template>
		<Text @bold={{true}} @color="green">Colors Demo View</Text>
		<Text>Hello from ember-console!</Text>

		{{! Colored text }}
		<Text @color="green">This text is green</Text>
		<Text @color="blue">This text is blue</Text>
		<Text @color="#ff6b6b">This text is custom hex color</Text>

		{{! Background colors }}
		<Text @backgroundColor="yellow" @color="black">
			Black text on yellow background
		</Text>

		{{! Text styles }}
		<Text @bold={{true}}>This text is bold</Text>
		<Text @italic={{true}}>This text is italic</Text>
		<Text @underline={{true}}>This text is underlined</Text>
		<Text @strikethrough={{true}}>This text is strikethrough</Text>

		{{! Combined styles }}
		<Text @color="cyan" @bold={{true}} @underline={{true}}>
			Cyan, bold, and underlined!
		</Text>

		{{! Dim color }}
		<Text @dimColor={{true}}>This text is dimmed</Text>

		{{! Inverse }}
		<Text @inverse={{true}}>This text has inverted colors</Text>
	</template>
}