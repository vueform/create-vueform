import en from '@vueform/vueform/locales/en'
import vueform from '@vueform/vueform/dist/tailwind-material'
import { defineConfig } from '@vueform/vueform'

import '@vueform/vueform/dist/tailwind-material.css';

export default defineConfig({
  theme: vueform,
  locales: { en },
  locale: 'en',
  axios: window.axios,
})