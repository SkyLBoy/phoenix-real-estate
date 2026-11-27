import { cp, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

// Copia aislada sin .env, datos reales ni conflicto con el next dev del operador.
const raiz = resolve(import.meta.dirname, '../..');
const temporal = await mkdtemp(join(tmpdir(), 'phoenix-e2e-'));
for (const entrada of ['app','lib','public','package.json','next.config.ts','tsconfig.json']) {
  await cp(join(raiz, entrada), join(temporal, entrada), { recursive: true });
}
await cp(join(raiz, 'node_modules'), join(temporal, 'node_modules'), { recursive: true, mode: constants.COPYFILE_FICLONE });
// Los recorridos funcionales usan fuentes del sistema para poder correr sin Google Fonts.
const layout = join(temporal, 'app/layout.tsx');
const fuente = await readFile(layout, 'utf8');
await writeFile(layout, fuente.replace(/import \{ Geist, Geist_Mono \} from "next\/font\/google";\n/, '')
  .replace(/const geistSans = Geist\([\s\S]*?\n\}\);/, 'const geistSans = { variable: "" };')
  .replace(/const geistMono = Geist_Mono\([\s\S]*?\n\}\);/, 'const geistMono = { variable: "" };'));
const fixture = join(temporal, 'supabase-servidor.mjs');
await cp(join(import.meta.dirname, 'supabase-servidor.mjs'), fixture);
const servidor = spawn(process.execPath, ['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port','3107'], {
  cwd: temporal, stdio: 'inherit', env: {
    ...process.env, NODE_OPTIONS: [process.env.NODE_OPTIONS, `--import=${fixture}`].filter(Boolean).join(' '), VERCEL_ENV: 'preview', NEXT_TELEMETRY_DISABLED: '1',
    NEXT_PUBLIC_SUPABASE_URL: 'https://supabase.test', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-e2e',
    SUPABASE_SERVICE_ROLE_KEY: 'service-e2e', NEXT_PUBLIC_WHATSAPP_ASESOR: '',
    GEMINI_API_KEY: '', ADMIN_USER_IDS: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  },
});
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => servidor.kill(signal));
servidor.on('exit', async (codigo) => {
  await rm(temporal, { recursive: true, force: true, maxRetries: 3 });
  process.exitCode = codigo ?? 0;
});
