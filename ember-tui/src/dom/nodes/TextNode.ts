import ViewNode from './ViewNode';
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

	updateParentNode() {
		if (this._parentNode instanceof TerminaTextElement) {
			this._parentNode.updateText();
		}
		if (this._parentNode instanceof TextNode) {
			this._parentNode.updateParentNode();
		}
	}

  setText(text: string) {
    this.text = text;
		this.updateParentNode();
  }

	get nodeValue() {
		return this.text;
	}

	set nodeValue(value: string) {
		this.setText(value);
	}
}
