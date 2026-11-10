import { defineConfig } from 'vite'
import { officeApi } from './server/api.js'

export default defineConfig({
  plugins: [officeApi()],
})
