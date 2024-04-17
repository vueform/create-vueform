import type { App } from 'vue';
import Vueform from '@vueform/vueform'

export default async (app: App) => {
  const vueformConfig = (await import('../../vueform.config')).default
  const builderConfig = (await import('../../builder.config')).default
  const Builder = (await import('@vueform/builder')).default
  app.use(Vueform, vueformConfig)
  app.use(Builder, builderConfig)
}