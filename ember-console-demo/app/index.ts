import { startApp } from './boot';
import { startRender } from 'ember-console';

// Start the Ember application
startApp()
  .then(() => {
    // Start rendering to terminal
  })
  .catch((error) => {
    console.error('Failed to start ember-console application:', error);
    process.exit(1);
  });
