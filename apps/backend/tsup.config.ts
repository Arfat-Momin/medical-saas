import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/server.ts'],
    format: ['esm'],
    target: 'node20',
    outDir: 'dist',
    clean: true,
    // Bundle this workspace package into the output instead of leaving
    // it as a runtime import (Node can't resolve its raw TypeScript).
    noExternal: ['@medical/shared'],
});