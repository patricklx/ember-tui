import { startApp } from './boot';
import { startRender } from 'etui';

// Start the Ember application
startApp()
  .then(() => {
    // Start rendering to terminal
  })
  .catch((error) => {
    console.error('Failed to start etui application:', error);
    process.exit(1);
  });
