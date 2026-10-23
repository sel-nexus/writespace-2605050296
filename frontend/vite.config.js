/** Configure React transforms and isolated browser-storage unit tests. */
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/** Resolve the public development port and keep tests in one worker.
 * Args:
 *   context: Vite's active mode for environment loading.
 * Returns:
 *   Build and test settings without a dependency on a setup file.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [react()],
    server: { port: Number(env.VITE_PORT || 5173) },
    test: {
      environment: 'jsdom',
      include: ['src/tests/**/*.{test,spec}.{js,jsx}'],
      minWorkers: 1,
      maxWorkers: 1,
      fileParallelism: false,
    },
  };
});
