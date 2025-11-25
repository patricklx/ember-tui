import Component from '@glimmer/component';
import { Text, Box } from 'ember-console';
import { tracked } from "@glimmer/tracking";
import { service } from '@ember/service';
import type RouterService from '@ember/routing/router-service';


const eq = (a, b) => a === b;

/**
 * Main application template with keyboard navigation
 */
export default class AppTemplate extends Component {
	@service declare router: RouterService;
	@tracked selectedView: 'colors' | 'lorem' | 'tomster' | 'box-demo' | 'static-test' = 'colors';
  @tracked counter = 0;
  @tracked debug = [];

  get debugMessages() {
    return this.debug.join('\n');
  }
	constructor(owner: unknown, args: object) {
		super(owner, args);

    console.log = (...args) => {
      this.debug.push(args.join(' '));
    }

		// Set up keyboard listener on the document node
		if (typeof document !== 'undefined') {
			document.addEventListener('keypress', this.handleKeyPress);
		}

		// Navigate to static-test route to show Static component
		this.selectedView = 'static-test';
		this.router.transitionTo('static-test');
	}

	willDestroy() {
		super.willDestroy();
		if (typeof document !== 'undefined') {
			document.removeEventListener('keypress', this.handleKeyPress);
		}
	}

	handleKeyPress = (event: any) => {
		const key = event.key;
        this.counter += 1;

		if (key === '1') {
			this.selectedView = 'colors';
			this.router.transitionTo('colors');
		} else if (key === '2') {
			this.selectedView = 'lorem';
			this.router.transitionTo('lorem');
		} else if (key === '3') {
			this.selectedView = 'tomster';
			this.router.transitionTo('tomster');
		} else if (key === '4') {
			this.selectedView = 'box-demo';
			this.router.transitionTo('box-demo');
		} else if (key === '5') {
			this.selectedView = 'component-test';
			this.router.transitionTo('component-test');
		} else if (key === '6') {
			this.selectedView = 'static-test';
			this.router.transitionTo('static-test');
		}
	}

	<template>
    <Box @flexDirection="column" @overflow="visible" @height='100%'>
      <Text>
        {{this.debugMessages}}
      </Text>
      <Text @bold={{true}} @color="cyan">Select a view (press 1, 2, 3, 4, or 5): {{this.selectedView}}</Text>
      <Text @color={{if (eq this.selectedView "colors") "green" "white"}}>[1] Colors Demo</Text>
      <Text @color={{if (eq this.selectedView "lorem") "green" "white"}}>[2] Lorem Ipsum Generator</Text>
      <Text @color={{if (eq this.selectedView "tomster") "green" "white"}}>[3] Ember Tomster ASCII Art</Text>
      <Text @color={{if (eq this.selectedView "box-demo") "green" "white"}}>[4] Box Layout Demo</Text>
      <Text @color={{if (eq this.selectedView "component-test") "green" "white"}}>[5] Component Test (Newline & Spacer)</Text>
      <Text @color={{if (eq this.selectedView "static-test") "green" "white"}}>[6] Static Component Test</Text>
      <Text>---</Text>
      {{outlet}}
    </Box>
	</template>
}
