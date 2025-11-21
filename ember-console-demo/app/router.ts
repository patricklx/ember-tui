import EmberRouter from '@ember/routing/router';
import ENV from './config/env';

export default class Router extends EmberRouter {
  location = 'none';
  rootURL = ENV.rootURL || '/';
}

Router.map(function () {
  // Define your routes here
  this.route('colors');
  this.route('lorem');
  this.route('tomster');
});