import { type Model } from 'racer';
import tracks = require('tracks');

import { type AppBase } from './App';
import { type PageBase } from './Page';

export function routes(app: AppBase) {
  return tracks.setup(app);
}

// From tracks/lib/router.js
export interface PageParams extends ReadonlyArray<unknown> {
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

export interface QueryParams {
  [param: string]: unknown;
}

export interface TransitionalRoute {
  from: string;
  to: string;
}

export interface RouteMethod {
  (routePattern: string, routeHandler: RouteHandler): void;
  (routePattern: TransitionalRoute, routeHandler: TransitionalRouteHandler): void;
}

export interface RouteHandler {
  (page: PageBase, model: Model, params: PageParams, next: (err?: Error) => void): void;
}

export interface TransitionalRouteHandler {
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
    history: {
      push: (url: string, render?: boolean, state?: object, e?: any) => void,
      replace: (url: string, render?: boolean, state?: object, e?: any) => void,
      refresh: () => void,
    };
    post: RouteMethod;
    put: RouteMethod;
  }
}

declare module './Page' {
  interface PageBase {
    redirect(url: string, status?: number): void;
  }
}
