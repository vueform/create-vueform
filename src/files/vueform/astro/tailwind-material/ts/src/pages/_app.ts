import type { App } from 'vue';
import Vueform from '@vueform/vueform'

export default async (app: App) => {
  const vueformConfig = (await import('../../vueform.config')).default
  app.use(Vueform, vueformConfig)
}