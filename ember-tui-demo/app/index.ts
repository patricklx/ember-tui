import { startApp } from './boot';

// Start the Ember application
startApp()
  .then(() => {
    // Start rendering to terminal
  })
  .catch((error) => {
    console.error('Failed to start ember-tui application:', error);
    process.exit(1);
  });
