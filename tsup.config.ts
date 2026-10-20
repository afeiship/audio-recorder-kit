import { defineConfig, Options } from 'tsup';
import tsupBanner from '@jswork/tsup-banner';
import { umdWrapper } from 'esbuild-plugin-umd-wrapper';
import { replace } from 'esbuild-plugin-replace';
import { readFile } from 'fs/promises';
import type { Plugin } from 'esbuild';

// js-audio-recorder ships a webpack sourcemap whose "webpack://[name]/..."
// sources make tsup's map merging throw "Invalid URL" — strip the hint.
const stripBrokenDepMaps: Plugin = {
  name: 'strip-broken-dep-sourcemaps',
  setup(build) {
    build.onLoad({ filter: /js-audio-recorder[\\/]dist[\\/]recorder\.js$/ }, async (args) => {
      const contents = (await readFile(args.path, 'utf8')).replace(
        /\n?\/\/# sourceMappingURL=.*$/m,
        ''
      );
      return { contents, loader: 'js' };
    });
  },
};

const baseOptions: Options = {
  entry: ['src/index.ts'],
  clean: true,
  format: ['cjs', 'esm'],
  tsconfig: './tsconfig.json',
  dts: true,
  sourcemap: true,
  cjsInterop: true,
  // Bundle runtime deps so dist artifacts resolve in a raw browser
  noExternal: ['js-audio-recorder', 'media-devices'],
  esbuildPlugins: [stripBrokenDepMaps],
  // external: ['react', 'react-dom'],
  banner: {
    js: tsupBanner(),
  },
  outExtension({ format }) {
    return {
      js: `.${format}.js`,
    };
  },
};

// UMD build configuration - separate to avoid sharing options object
const umdOptions: Options = {
  entry: ['src/index.ts'],
  clean: false, // Don't clean to avoid race condition
  format: ['umd'] as any,
  tsconfig: './tsconfig.json',
  sourcemap: true,
  banner: {
    js: tsupBanner(),
  },
  outExtension({ format }) {
    return {
      js: `.${format}.js`,
    };
  },
  esbuildPlugins: [
    stripBrokenDepMaps,
    replace({
      'export default': 'export =',
    }),
    umdWrapper({
      libraryName: 'AudioRecorder',
    }),
  ],
  // Bundle runtime deps so the UMD build is self-contained for <script> use
  noExternal: ['js-audio-recorder', 'media-devices'],
};

export default defineConfig([
  {
    ...baseOptions,
    splitting: false,
  },
  umdOptions
]);
