import { RootModel, type Model } from 'racer';
import tracks = require('tracks');

import { type App } from './App';
import { type Page } from './Page';

export function routes(app: App) {
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
  (page: Page, model: RootModel, params: PageParams, next: (err?: Error) => void): void;
}

export interface TransitionalRouteHandler {
  (
    page: Page,
    model: RootModel,
    params: PageParams,
    next: (err?: Error) => void,
    done: () => void
  ): void;
}

declare module './App' {
  interface App {
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
  interface Page {
    redirect(url: string, status?: number): void;
  }
}
