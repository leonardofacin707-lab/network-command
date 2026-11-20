// Serve a versão de publicação (dist/) na porta 5174, para conferir antes de mandar para o ar. Rode antes: npm run build
import { fileURLToPath } from 'node:url';
import { iniciarServidor } from '../tests/helpers/servidor.mjs';
const { url } = await iniciarServidor(Number(process.env.PORTA) || 5174, fileURLToPath(new URL('../dist/', import.meta.url)));
console.log(`Versão de publicação em ${url}  (Ctrl+C para parar)`);
