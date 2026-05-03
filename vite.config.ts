import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  envDir: './configs',
  server: {
    host: true, // Necessary for Android dev
    allowedHosts: ['roentgenographic-informed-chadwick.ngrok-free.dev'],
  },
})
