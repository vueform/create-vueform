import './bootstrap'

import { createApp } from 'vue'
import App from './components/App.vue'
import Vueform from '@vueform/vueform'
import vueformConfig from './../../vueform.config'

const app = createApp(App)
app.use(Vueform, vueformConfig)
app.mount('#app')