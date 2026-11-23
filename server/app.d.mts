import type http from 'node:http';

export function createPinSignServer(options: {
  dataDir: string;
  distDir?: string;
  appOrigin?: string;
  basePath?: string;
}): {
  handler: http.RequestListener;
  close: () => void;
};
