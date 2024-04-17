import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import Vueform from '@vueform/vueform'
import vueformConfig from '../vueform.config'
import Builder from '@vueform/builder'
import builderConfig from '../builder.config'

const app = createApp(App)
app.use(Vueform, vueformConfig)
app.use(Builder, builderConfig)
app.mount('#app')