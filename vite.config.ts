import path from 'path';
import { execSync } from 'child_process';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

function getChangelog() {
  try {
    const log = execSync(
      'git log --pretty=format:"%H|%ad|%s" --date=short -30',
      { encoding: 'utf-8' }
    );
    return log.trim().split('\n').filter(Boolean).map(line => {
      const [hash, date, ...rest] = line.split('|');
      return { hash: hash.slice(0, 7), date, message: rest.join('|') };
    });
  } catch {
    return [];
  }
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const changelog = getChangelog();
    return {
      base: mode === 'production' ? '/camp/' : '/',
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        '__CHANGELOG__': JSON.stringify(changelog)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
