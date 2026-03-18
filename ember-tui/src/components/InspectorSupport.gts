import Component from '@glimmer/component';
import { modifier } from 'ember-modifier';
import ViewNode from '../dom/nodes/ViewNode';
import NativeElementNode from '../dom/nodes/ElementNode';
import DocumentNode from '../dom/nodes/DocumentNode';
import Box from './Box.gts';
import { Edge } from 'yoga-layout';

const ref = modifier(function setRef(element: any, [context, key]: any) {
  // console.log('ref', element, context, key);
  context[key] = element;
});

interface InspectorSupportInterface {
  Blocks: {
    default: [];
  };
}

export default class InspectorSupport extends Component<InspectorSupportInterface> {
  declare highlight: NativeElementNode;
  declare tooltip: NativeElementNode;
  declare page: NativeElementNode;
  declare ownerDocument: DocumentNode;
  setupInspector = () => {
    const i = setInterval(() => {
      const viewInspection =
        (globalThis as any).EmberInspector?.viewDebug?.viewInspection;
      if (viewInspection && this.tooltip) {
        this.tooltip.querySelector = () => {
          return {
            style: {},
          };
        };
        viewInspection._showTooltip = () => {};
        const _showHighlight = viewInspection._showHighlight;
        viewInspection._hideHighlight = () => {
          this.highlight.setAttribute('display', 'flex');
        };
        viewInspection._showHighlight = (node: ViewNode, rect: any) => {
          _showHighlight.call(this, node, rect);
          this.highlight.setAttribute('display', 'flex');
          const style = this.highlight.getAttribute('style') as any;
          style.width = style.width.value;
          style.height = style.height.value;
          const pos = {
            x: this.page.yogaNode?.getPosition(Edge.Left)?.value || 0,
            y: this.page.yogaNode?.getPosition(Edge.Top)?.value || 0,
          };
          this.highlight.setAttribute(
            'left',
            Number(style.left!.replace('px', '')) - pos.x,
          );
          this.highlight.setAttribute(
            'top',
            Number(style.top!.replace('px', '')) - pos.y,
          );
        };
        viewInspection.highlight = this.highlight;
        viewInspection.tooltip = this.tooltip;
        const id = viewInspection.id;

        viewInspection.highlight.id = `ember-inspector-highlight-${id}`;
        viewInspection.tooltip.id = `ember-inspector-tooltip-${id}`;
        clearInterval(i);
      }
    }, 1000);
  };

  setupHighlight = modifier(
    function setupHighlight(
      this: InspectorSupport,
      element: any,
    ) {
      this.highlight = element;
      this.highlight.setAttribute('display', 'none');
      this.ownerDocument = element.ownerDocument!;
    }.bind(this),
  );
  setupTooltip = modifier(
    function setupTooltip(this: InspectorSupport, element: any) {
      this.tooltip = element;
      this.tooltip.setAttribute('display', 'none');
    }.bind(this),
  );
  <template>
    <Box @position='absolute' {{ref this 'page'}}>
      <Box {{this.setupHighlight}} />
      <Box {{this.setupTooltip}} />
      {{(this.setupInspector)}}
    </Box>
  </template>
}
