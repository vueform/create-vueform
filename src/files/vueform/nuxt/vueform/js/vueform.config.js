// vueform.config.(js|ts)

import en from '@vueform/vueform/locales/en'
import theme from '@vueform/vueform/dist/vueform'
import { defineConfig } from '@vueform/vueform'

// You might place these anywhere else in your project
import '@vueform/vueform/dist/vueform.css';

export default defineConfig({
  theme,
  locales: { en },
  locale: 'en',
})