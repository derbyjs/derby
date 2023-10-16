import { type Model } from 'racer';
import tracks = require('tracks');

import { type AppBase } from './App';
import { type PageBase } from './Page';

export function routes(app: AppBase) {
  return tracks.setup(app);
}

// From tracks/lib/router.js
interface PageParams extends ReadonlyArray<unknown> {
  /** Previous URL path + querystring */
  previous?: string;
  /** Current URL path + querystring */
  url: string;
  /**
   * Parsed query parameters
   * @see https://www.npmjs.com/package/qs
   */
  query: Readonly<QueryParams>;
  /** HTTP method for the currently rendered page */
  method: string;
  routes: unknown;
}

interface QueryParams {
  [param: string]: unknown;
}

interface TransitionalRoute {
  from: string;
  to: string;
}

interface RouteMethod {
  (routePattern: string, routeHandler: RouteHandler): void;
  (routePattern: TransitionalRoute, routeHandler: TransitionalRouteHandler): void;
}

interface RouteHandler {
  (page: PageBase, model: Model, params: PageParams, next: (err?: Error) => void): void;
}

interface TransitionalRouteHandler {
  (
    page: PageBase,
    model: Model,
    params: PageParams,
    next: (err?: Error) => void,
    done: () => void
  ): void;
}

declare module './App' {
  interface AppBase {
    del: RouteMethod;
    get: RouteMethod;
    history: unknown;
    post: RouteMethod;
    put: RouteMethod;
  }
}