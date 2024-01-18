// import Model = require('racer/lib/Model/ModelStandalone');
// import util = require('racer/lib/util');

// import { App } from './App';
// import * as components from './components';
// import { DerbyBase } from './Derby';
// import { Page } from './Page';

// @TODO: verify standalone loading
export default {}

// // eslint-disable-next-line @typescript-eslint/no-var-requires
// require('./documentListeners').add(document);

// // Standard Derby inherits from Racer, but we only set up the event emitter and
// // expose the Model and util here instead
// export class DerbyStandalone extends DerbyBase {
//   Model = Model;
//   util = util;

//   App = AppStandalone;
//   Page = Page;
//   Component = components.Component;

//   createApp() {
//     return new this.App(this, null, null, null);
//   }
// }

// export class AppStandalone extends App {
//   _init() {
//     this.model = new this.derby.Model();
//     this.createPage();
//   }
// }
