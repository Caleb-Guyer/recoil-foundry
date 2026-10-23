import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { SourceTextModule } from 'node:vm';
import { gzipSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';

// Fresh V8 isolates prevent one build benefiting from the other's code cache.
// This measures eager JS compilation, NOT internet transfer or browser startup.
if (process.argv[2] === '--sample') {
  const sources = JSON.parse(readFileSync(process.argv[3], 'utf8')).files.map((f) =>
    readFileSync(f, 'utf8'),
  );
  const start = performance.now();
  for (const source of sources) new SourceTextModule(source);
  console.log(performance.now() - start);
} else {
  const folder = resolve(process.argv[2] ?? 'dist');
  const html = readFileSync(resolve(folder, 'index.html'), 'utf8');
  const entry = html.match(/<script[^>]*type="module"[^>]*src="([^"]+)"/)[1];
  const files = new Map();
  function visit(file) {
    if (files.has(file)) return;
    const source = readFileSync(file, 'utf8');
    files.set(file, source);
    for (const dependency of new SourceTextModule(source).dependencySpecifiers)
      if (dependency.startsWith('.')) visit(resolve(dirname(file), dependency));
  }
  visit(resolve(folder, entry));
  const output = resolve(process.argv[3] ?? 'loading-audit.json');
  const inputs = output + '.inputs.json';
  writeFileSync(inputs, JSON.stringify({ files: [...files.keys()] }));
  const samples = [];
  for (let i = 0; i < 11; i++) {
    const child = spawnSync(
      process.execPath,
      ['--experimental-vm-modules', import.meta.filename, '--sample', inputs],
      { encoding: 'utf8' },
    );
    if (child.status !== 0) throw new Error(child.stderr);
    samples.push(Number(child.stdout.trim()));
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const report = {
    methodology:
      'Eager production JS graph only. Eleven fresh Node/V8 isolates; sources read before timer. Module compilation only, excluding evaluation, browser layout, process startup and network. Default gzip per file. No optional dynamic imports followed.',
    node: process.version,
    chunks: [...files.keys()].map((file) => file.slice(folder.length + 1)),
    eagerBytes: [...files.values()].reduce((n, source) => n + Buffer.byteLength(source), 0),
    eagerGzipBytes: [...files.values()].reduce((n, source) => n + gzipSync(source).length, 0),
    compileMs: { samples, median: sorted[5], p95: sorted[10] },
  };
  writeFileSync(output, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
