import 'racer';

declare module 'racer' {
  interface util {
    isProduction: boolean;
  }
  interface Model {
    hasErrored: boolean;
  }
}

declare module 'racer/lib/util' {
  export let isProduction: boolean;
}
