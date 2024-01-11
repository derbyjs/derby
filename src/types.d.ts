
declare module 'racer' {
  interface util {
    isProduction: boolean;
  }
  interface ModelData {
    $event: any;
    $element: any;
    id: string;
  }
}