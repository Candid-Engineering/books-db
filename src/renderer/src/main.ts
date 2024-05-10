import('./assets/main.css')
import onScan from 'onscan.js'

import App from './App.svelte'

const app = new App({
  target: document.getElementById('app') as HTMLElement
})

onScan.attachTo(document)
document.addEventListener('scan', function (event) {
  const sScanCode = event.detail.scanCode
  const iQuantity = event.detail.qty
  alert(iQuantity + 'x ' + sScanCode)
})

export default app
