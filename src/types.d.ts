import '@derbyjs/racer';

declare module '@derbyjs/racer' {
  interface util {
    isProduction: boolean;
  }
  interface Model {
    hasErrored?: boolean;
  }
}

declare module '@derbyjs/racer/lib/util' {
  export let isProduction: boolean;
}
