import Service from '@ember/service';
import { tracked } from '@glimmer/tracking';

type ConsoleMethod = 'log' | 'info' | 'warn' | 'error' | 'debug';

export interface ConsoleMessage {
  level: ConsoleMethod;
  args: unknown[];
  text: string;
  timestamp: Date;
}

const METHODS: ConsoleMethod[] = ['log', 'info', 'warn', 'error', 'debug'];

export default class ConsoleMessagesService extends Service {
  @tracked messages: ConsoleMessage[] = [];

  private originals?: Partial<Record<ConsoleMethod, (...args: unknown[]) => void>>;
  private patched = false;

  patchConsole(): void {
    if (this.patched) {
      return;
    }

    this.originals = {};

    for (const method of METHODS) {
      const original = console[method].bind(console);
      this.originals[method] = original;

      console[method] = (...args: unknown[]) => {
        this.messages = [
          ...this.messages,
          {
            level: method,
            args,
            text: args.map((value) => this.serialize(value)).join(' '),
            timestamp: new Date(),
          },
        ];
      };
    }

    this.patched = true;
  }

  willDestroy(): void {
    super.willDestroy();

    if (!this.originals) {
      return;
    }

    for (const method of METHODS) {
      const original = this.originals[method];
      if (original) {
        console[method] = original;
      }
    }

    this.patched = false;
  }

  private serialize(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }

    if (value instanceof Error) {
      return value.stack ?? value.message;
    }

    try {
      return JSON.stringify(value);
    } catch {
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      return String(value);
    }
  }
}

declare module '@ember/service' {
  interface Registry {
    'service:console-messages': ConsoleMessagesService;
  }
}
