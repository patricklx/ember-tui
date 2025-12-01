import Component from '@glimmer/component';
import { Text, Box, Spacer, Static } from 'ember-console';
import { tracked } from "@glimmer/tracking";
import { service } from '@ember/service';
import type RouterService from '@ember/routing/router-service';
import { hideCursor } from "ember-console/render/apply-term-updates";


const eq = (a, b) => a === b;

/**
 * Main application template with keyboard navigation
 */
export default class AppTemplate extends Component {
	@service declare router: RouterService;
	@tracked selectedView: 'colors' | 'lorem' | 'tomster' | 'box-demo' | 'static-test' | 'file-editor' | 'menu' = 'menu';
  @tracked counter = 0;
  @tracked debug = [];

  get debugMessages() {
    return this.debug.join('\n');
  }
	constructor(owner: unknown, args: object) {
		super(owner, args);

		// Set up keyboard listener on the document node
		if (typeof document !== 'undefined') {
			document.addEventListener('keypress', this.handleKeyPress);
		}

		hideCursor();

		// Start at menu
		this.selectedView = 'file-editor';
    this.router.transitionTo('file-editor');
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

		// Handle Ctrl+B to go back to menu
		if (event.ctrlKey && key === 'b') {
			this.selectedView = 'menu';
			return;
		}

		// Only handle number keys when on menu
		if (this.selectedView === 'menu') {
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
			} else if (key === '7') {
				this.selectedView = 'file-editor';
				this.router.transitionTo('file-editor');
			}
		}
	}

	startCounter = () => {
		setInterval(() => {
			this.counter += 1;
		}, 1000);
	}

	<template>
		{{(this.startCounter)}}
    <Box @flexDirection="column"  @height='100%'>
      {{#if (eq this.selectedView "menu")}}
        <Text @bold={{true}} @color="cyan">Ember Console Demo - Main Menu</Text>
        <Text>---</Text>
        <Text @color="white">[1] Colors Demo</Text>
        <Text @color="white">[2] Lorem Ipsum Generator</Text>
        <Text @color="white">[3] Ember Tomster ASCII Art</Text>
        <Text @color="white">[4] Box Layout Demo</Text>
        <Text @color="white">[5] Component Test (Newline & Spacer)</Text>
        <Text @color="white">[6] Static Component Test</Text>
        <Text @color="white">[7] File Editor</Text>
        <Text>---</Text>
        <Text @color="gray">Press 1-7 to select a demo</Text>
      {{else}}
        <Text @bold={{true}} @color="cyan">{{this.selectedView}}</Text>
        <Text>---</Text>
        {{outlet}}
        <Box @borderStyle="single" @borderColor="gray" @paddingX={{1}}>
          <Text @color="yellow">Press Ctrl+B to go back to menu</Text>
        </Box>
      {{/if}}
    </Box>
	</template>
}
