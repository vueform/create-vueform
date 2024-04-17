import en from '@vueform/vueform/locales/en'
import theme from '@vueform/vueform/dist/tailwind-material'
import { defineConfig } from '@vueform/vueform'

import '@vueform/vueform/dist/tailwind-material.css'

export default defineConfig({
  theme,
  locales: { en },
  locale: 'en',
})