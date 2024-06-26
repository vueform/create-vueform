import vueformPlugin from '@vueform/vueform/tailwind'
import builderPlugin from '@vueform/builder/tailwind'

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './resources/**/*.blade.php',
    './resources/**/*.js',
    './resources/**/*.vue',
    './vueform.config.js',
    './node_modules/@vueform/vueform/themes/tailwind/**/*.vue',
    './node_modules/@vueform/vueform/themes/tailwind/**/*.js',
    './node_modules/@vueform/builder/**/*.js',
    './node_modules/@vueform/builder/**/*.css',
  ],
  darkMode: 'class',
  theme: {
    extend: {},
  },
  plugins: [
    vueformPlugin,
    builderPlugin,
  ]
}