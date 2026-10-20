import { defineConfig, Options } from 'tsup';
import tsupBanner from '@jswork/tsup-banner';
import { umdWrapper } from 'esbuild-plugin-umd-wrapper';
import { replace } from 'esbuild-plugin-replace';

const baseOptions: Options = {
  entry: ['src/index.ts'],
  clean: true,
  format: ['cjs', 'esm'],
  tsconfig: './tsconfig.json',
  dts: true,
  sourcemap: true,
  cjsInterop: true,
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
    replace({
      'export default': 'export =',
    }),
    umdWrapper({
      libraryName: 'urlLiteral',
    }),
  ],
};

export default defineConfig([
  {
    ...baseOptions,
    splitting: true,
  },
  umdOptions
]);
