import { startApp } from './boot';
import { startRender } from 'ember-tui';

// Start the Ember application
startApp()
  .then(() => {
    // Start rendering to terminal
  })
  .catch((error) => {
    console.error('Failed to start ember-tui application:', error);
    process.exit(1);
  });
