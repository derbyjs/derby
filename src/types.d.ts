import 'racer';

declare module 'racer' {
  interface util {
    isProduction: boolean;
  }
  interface Model {
    hasErrored?: boolean;
  }
}
