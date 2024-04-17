import en from '@vueform/vueform/locales/en'
import vueform from '@vueform/vueform/dist/material'
import { defineConfig } from '@vueform/vueform'

export default defineConfig({
  theme: vueform,
  locales: { en },
  locale: 'en',
  axios: window.axios,
})