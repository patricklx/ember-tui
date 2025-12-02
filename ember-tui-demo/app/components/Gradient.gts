import Component from '@glimmer/component';
import { Transform } from "ember-tui";
import gradientString from 'gradient-string';

export type GradientName =
	| 'cristal'
	| 'teen'
	| 'mind'
	| 'morning'
	| 'vice'
	| 'passion'
	| 'fruit'
	| 'instagram'
	| 'atlas'
	| 'retro'
	| 'summer'
	| 'pastel'
	| 'rainbow';

export type GradientColors = Array<string | Record<string, unknown>>;

export interface GradientOptions {
	Args: {
		/**
	The name of a [built-in gradient](https://github.com/bokub/gradient-string#available-built-in-gradients).

	Mutually exclusive with `colors`.
		 */
		readonly name?: GradientName;

		/**
	[Colors to use to make the gradient.](https://github.com/bokub/gradient-string#initialize-a-gradient)

	Mutually exclusive with `name`.
		 */
		readonly colors?: GradientColors;
	},
	Blocks: {
		default: []
	}
}

export default class Gradient extends Component<GradientOptions> {

	gradient = (str: string) => {
		if (this.args.name && this.args.colors) {
			throw new Error('The `name` and `colors` props are mutually exclusive');
		}

		let gradient: any;
		if (this.args.name) {
			gradient = gradientString[this.args.name];
		} else if (this.args.colors) {
			gradient = gradientString(this.args.colors as any); // TODO: Make stronger type.
		} else {
			throw new Error('Either `name` or `colors` prop must be provided');
		}

		return gradient.multiline(str);
	}

  <template>
    <Transform @transform={{this.gradient}}>{{yield}}</Transform>
  </template>
}
