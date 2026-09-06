import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
// 霞鹜文楷屏幕版字体（subset 分片，完整中文字符集）
import 'lxgw-wenkai-screen-webfont/lxgwwenkaiscreen.css'
import './assets/styles/main.css'

const app = createApp(App)
app.use(createPinia())
app.mount('#app')
