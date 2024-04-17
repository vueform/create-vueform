import en from '@vueform/vueform/locales/en'
import vueform from '@vueform/vueform/dist/tailwind'
import { defineConfig } from '@vueform/vueform'
import builder from '@vueform/builder/plugin'

export default defineConfig({
  theme: vueform,
  locales: { en },
  locale: 'en',
  axios: window.axios,
  apiKey: 'YOUR_PUBLIC_KEY',
  plugins: [
    builder,
  ],
})