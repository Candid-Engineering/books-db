import('./assets/main.css')
import onScan from 'onscan.js'

import App from './App.svelte'

const app = new App({
  target: document.getElementById('app') as HTMLElement
})

onScan.attachTo(document)
document.addEventListener('scan', function (sScancode: string, iQuantity: string) {
  alert(iQuantity + 'x ' + sScancode)
})

export default app
