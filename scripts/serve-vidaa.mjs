import http from 'http';
import os from 'os';
import handleProxyRequest from '../api/proxy.js';

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

const server = http.createServer((req, res) => {
  handleProxyRequest(req, res);
});

server.listen(PORT, HOST, () => {
  const localIp = getLocalIp();
  console.log('==========================================================');
  console.log(' YouTube Extended pour Hisense VIDAA OS - Serveur Actif');
  console.log('==========================================================');
  console.log(` Local   : http://localhost:${PORT}/vidaa.html`);
  console.log(` Réseau  : http://${localIp}:${PORT}/vidaa.html`);
  console.log(` Install : http://${localIp}:${PORT}/installer/`);
  console.log('==========================================================');
});
