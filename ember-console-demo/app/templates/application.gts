import Component from '@glimmer/component';
import { Text } from 'ember-console';
import { tracked } from "@glimmer/tracking";
import { service } from '@ember/service';
import type RouterService from '@ember/routing/router-service';


const eq = (a, b) => a === b;

/**
 * Main application template with keyboard navigation
 */
export default class AppTemplate extends Component {
	@service declare router: RouterService;
	@tracked selectedView: 'colors' | 'lorem' | 'tomster' = 'colors';

	constructor(owner: unknown, args: object) {
		super(owner, args);

		// Set up keyboard listener on the document node
		if (typeof document !== 'undefined') {
			document.addEventListener('keypress', this.handleKeyPress);
		}

		// Navigate to initial route
		this.router.transitionTo('colors');
	}

	willDestroy() {
		super.willDestroy();
		if (typeof document !== 'undefined') {
			document.removeEventListener('keypress', this.handleKeyPress);
		}
	}

	handleKeyPress = (event: any) => {
		const key = event.key;

		if (key === '1') {
			this.selectedView = 'colors';
			this.router.transitionTo('colors');
		} else if (key === '2') {
			this.selectedView = 'lorem';
			this.router.transitionTo('lorem');
		} else if (key === '3') {
			this.selectedView = 'tomster';
			this.router.transitionTo('tomster');
		}
	}

	<template>
		<Text @bold={{true}} @color="cyan">Select a view (press 1, 2, or 3):</Text>
		<Text @color={{if (eq this.selectedView "colors") "green" "white"}}>[1] Colors Demo</Text>
		<Text @color={{if (eq this.selectedView "lorem") "green" "white"}}>[2] Lorem Ipsum Generator</Text>
		<Text @color={{if (eq this.selectedView "tomster") "green" "white"}}>[3] Ember Tomster ASCII Art</Text>
		<Text>---</Text>
		{{outlet}}
	</template>
}
