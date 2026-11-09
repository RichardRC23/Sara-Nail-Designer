import { cp, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const projectDirectory = dirname(fileURLToPath(import.meta.url));
const outputDirectory = join(projectDirectory, 'dist');
const publicFiles = [
  'index.html',
  'agendamento.html',
  'styles.css',
  'agendamento.css',
  'script.js',
  'agendamento.js',
  'supabase-config.js'
];

await mkdir(outputDirectory, { recursive: true });
for (const file of publicFiles) {
  await cp(join(projectDirectory, file), join(outputDirectory, file));
}
await cp(join(projectDirectory, 'assets'), join(outputDirectory, 'assets'), { recursive: true, force: true });

process.stdout.write('Site pronto para publicação na pasta dist/.\n');
