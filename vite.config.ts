import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  return {
    // Asset base path.
    //
    // './' makes every JS/CSS/asset reference RELATIVE to the deployed
    // document. That is correct for a GitHub Pages *project* site served from
    // https://<owner>.github.io/<repo>/ and, unlike a hardcoded '/repo-name/'
    // path, it does not depend on the repository name or owner.
    //
    // Verified for this deployment:
    //   owner : harshan-mana
    //   repo  : aegis-helmet-app
    //   Pages : https://harshan-mana.github.io/aegis-helmet-app/
    //
    // Only set BASE_PATH if the site moves to a custom domain or is served
    // from the repository root.
    base: env.BASE_PATH || './',
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
     
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  }
})
