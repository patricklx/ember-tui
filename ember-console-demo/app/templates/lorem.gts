import Component from '@glimmer/component';
import { Text } from 'ember-console';
import { tracked } from "@glimmer/tracking";
import chalk from 'chalk';

/**
 * Lorem Ipsum generator view with incremental text generation
 */
export default class LoremTemplate extends Component {
	@tracked loremText = '';
	@tracked loremIndex = 0;
	loremIntervalId: number | null = null;

	loremIpsum = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.";

	constructor(owner: unknown, args: object) {
		super(owner, args);
		this.startLoremGeneration();
	}

	willDestroy() {
		super.willDestroy();
		if (this.loremIntervalId !== null) {
			clearInterval(this.loremIntervalId);
			this.loremIntervalId = null;
		}
	}

	startLoremGeneration = () => {
		if (this.loremIntervalId !== null) {
			clearInterval(this.loremIntervalId);
		}

		this.loremIntervalId = setInterval(() => {
			if (this.loremIndex < this.loremIpsum.length) {
				this.loremText += this.loremIpsum[this.loremIndex];
				this.loremIndex += 1;
			} else {
				// Stop when complete
				if (this.loremIntervalId !== null) {
					clearInterval(this.loremIntervalId);
					this.loremIntervalId = null;
				}
			}
		}, 100) as unknown as number;
	}

	<template>
		<Text @bold={{true}} @color={{chalk.magenta}}>Lorem Ipsum Generator</Text>
		<Text @italic={{true}}>Generating text character by character (100ms intervals)...</Text>
		<Text>---</Text>
		<Text @color="green">{{this.loremText}}</Text>
	</template>
}
