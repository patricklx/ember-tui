import Component from '@glimmer/component';

/**
 * A flexible space that expands along the major axis of its containing layout.
 *
 * It's useful as a shortcut for filling all the available space between elements.
 */
// eslint-disable-next-line ember/no-empty-glimmer-component-classes
export default class Transform extends Component<{
	Args: {
		transform: (value: string) => string,
	},
	Blocks: {
		default: []
	}
}> {
  <template>
		<terminal-text
			flex-grow=0
			flex-shrink=1
			flex-direction="row"
			internal_transform={{@transform}}
		>
			{{yield}}
		</terminal-text>
  </template>
}
