import {defineConfig} from 'vite';
export default defineConfig({build:{ssr:'server/index.ts',outDir:'dist-server',emptyOutDir:true,rollupOptions:{output:{format:'cjs',entryFileNames:'index.cjs'}}}});
