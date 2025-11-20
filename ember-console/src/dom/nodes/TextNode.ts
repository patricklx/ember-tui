import ViewNode from './ViewNode.ts';
import { TerminaTextElement } from "../native-elements/TerminaTextElement";

export default class TextNode extends ViewNode {
  text: any;
  private _parentNode: ViewNode | null = null;
  constructor(text: string) {
    super();

    this.nodeType = 3;
    this.text = text;

    this._meta = {
      skipAddToDom: true,
    };
  }

  // @ts-expect-error override parent
  set parentNode(node: ViewNode | null) {
    this._parentNode = node;
    this.setText(this.text);
  }

  get parentNode() {
    return this._parentNode;
  }

  setText(text: string) {
    this.text = text;
		if (this._parentNode instanceof TerminaTextElement) {
			this._parentNode.updateText();
		}
  }
}
