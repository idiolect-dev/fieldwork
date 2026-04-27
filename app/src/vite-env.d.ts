/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_PERMISSION_SETS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
