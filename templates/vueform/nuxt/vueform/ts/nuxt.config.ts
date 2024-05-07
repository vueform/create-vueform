// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  app: {
    head: {
      script: [
        {
          async: true,
          src: 'https://maps.googleapis.com/maps/api/js?key=AIzaSyBCToIMP1Rk6ZbGcfnJ2iwsnb09_lnxLmY&libraries=places',
        },
      ],
    },
  },
  devtools: { enabled: true },
  css: ['~/assets/scss/main.scss'],
  modules: [
    '@vueform/nuxt',
  ],
})
