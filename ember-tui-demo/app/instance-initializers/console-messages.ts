import type ApplicationInstance from '@ember/application/instance';
import type ConsoleMessagesService from '../services/console-messages';

export function initialize(appInstance: ApplicationInstance): void {
  const service = appInstance.lookup('service:console-messages') as ConsoleMessagesService | undefined;
  service?.patchConsole();
}

export default {
  initialize,
};
