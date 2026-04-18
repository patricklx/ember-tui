/**
 * Setup function to initialize the terminal environment for Ember/Glimmer
 * Similar to ember-native's setup but for terminal rendering
 */

import TerminalDocumentNode from './dom/nodes/DocumentNode';
import ViewNode from "./dom/nodes/ViewNode";
// @ts-expect-error - @glimmer/runtime has no type declarations
import { SimpleDynamicAttribute } from '@glimmer/runtime';
import { registerElements } from "./dom/setup-registry";
import type ElementNode from './dom/nodes/ElementNode';


SimpleDynamicAttribute.prototype.set = function (dom: any, value: any) {
	const { name, namespace } = this.attribute;
	dom.__setAttribute(name, value as any, namespace);
};

SimpleDynamicAttribute.prototype.update = function (value: any) {
	const normalizedValue = value;
	const { element: element, name: name } = this.attribute;
	if (null === normalizedValue) {
		element.removeAttribute(name);
	} else {
		element.setAttribute(name, normalizedValue as string);
	}
};

function setupInspectorSupport() {
  const globalMessaging: Record<string, ((args: any) => void)[]> = {};
  const g = globalThis as any;

  class Event {
    target: any;
    type: any;

    constructor(type: string, target: any) {
      this.type = type;
      this.target = target;
    }

    preventDefault() {}
    stopPropagation() {}
  }

  g.postMessage = (msg: any, origin: string, ports?: any[]) => {
    globalMessaging['message']?.forEach((listener) =>
      listener({
        data: msg,
        origin,
        ports,
      }),
    );
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  g.triggerEvent = (type: string, element: ElementNode, _data: any) => {
    const e = new Event(type, element);
    globalMessaging[type]?.forEach((cb) => {
      cb(e);
    });
  };

  g.addEventListener = (type: any, cb: any) => {
    globalMessaging[type] = globalMessaging[type] || [];
    globalMessaging[type].push(cb);
  };

  g.removeEventListener = (type: any, cb: any) => {
    if (type === 'message') {
      const i = globalMessaging[type]?.indexOf(cb) || -1;
      if (i >= 0) {
        globalMessaging[type]!.splice(i, 1);
      }
    }
  };

  if (g.document.documentElement && g.document.documentElement.dataset) {
    // let EmberDebug know that content script has executed
    g.document.documentElement.dataset['emberExtension'] = '1';
  }

  g.document.body.cloneNode = () => g.document.body;

  class Port {
    private msgId: number;
    listeners: any[];
    private otherPort: keyof MessageChannel;
    private channel: MessageChannel;
    constructor(channel: MessageChannel, otherPort: keyof MessageChannel) {
      this.channel = channel;
      this.otherPort = otherPort;
      this.msgId = 20000;
      this.listeners = [];
    }

    trigger(msg: any) {
      this.listeners.forEach((listener) => listener({ data: msg }));
    }

    get channelPort() {
      return this.channel[this.otherPort];
    }

    start() {}
    addEventListener(_type: string, cb: (args: any) => void) {
      this.listeners.push(cb);
    }
    postMessage(msg: any) {
      this.channelPort.trigger(msg);
    }
  }

  class MessageChannel {
    port1 = new Port(this, 'port2');
    port2 = new Port(this, 'port1');
  }

  (globalThis as any).MessageChannel = MessageChannel;

  (globalThis as any).scrollX = 0;
  (globalThis as any).scrollY = 0;
  Object.defineProperty(globalThis as any, 'innerWidth', {
    get() {
      return (g.document.body as ElementNode)?.yogaNode?.getWidth() || 0;
    },
  });
}

export function setup() {
  // Reuse the singleton document, but reset retained DOM/listener state
  const document = TerminalDocumentNode.getInstance();
  document.reset();

	registerElements();

  // Setup global objects for Glimmer/Ember compatibility
  const g = globalThis as any;

  // Set up document
  g.document = document;

  // Set up Element constructors
  g.Element = ViewNode;
  g.Node = ViewNode;
  g.HTMLElement = ViewNode;
  g.NodeList = Array;

  // Set up window object (minimal for Ember compatibility)
  if (!g.window) {
    g.window = globalThis;
  }

  g.window.document = document;
  g.window.location = {
    href: '',
    host: '',
    hostname: '',
    pathname: '',
    search: '',
    origin: '',
    protocol: 'terminal:',
  };
	document.location = g.location = g.window.location;

  // Stub for MouseEvent (not used in terminal but needed for Ember)
  class MouseEvent {
    type: string;
    eventOpts: any;

    constructor(type: string, eventOpts?: any) {
      this.type = type;
      this.eventOpts = eventOpts;
    }
  }

  g.MouseEvent = MouseEvent;

  // Stub for Window
  class Window {}
  g.Window = Window;

  // Add requestAnimationFrame stub (for Ember's rendering)
  if (!g.requestAnimationFrame) {
    g.requestAnimationFrame = (callback: (time: number) => void) => {
      return setTimeout(() => callback(Date.now()), 16) as any; // ~60fps
    };
  }

  if (!g.cancelAnimationFrame) {
    g.cancelAnimationFrame = (id: number) => {
      clearTimeout(id);
    };
  }

  setupInspectorSupport();

  return document;
}
