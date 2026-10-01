import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
for (const folder of ['public', 'scripts']) {
  for (const file of readdirSync(path.join(root, folder)).filter(name => /\.(js|mjs)$/.test(name))) {
    const result = spawnSync(process.execPath, ['--check', path.join(root, folder, file)], {stdio: 'inherit'});
    if (result.status !== 0) process.exit(result.status || 1);
  }
}
