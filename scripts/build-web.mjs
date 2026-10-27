/**
 * Genera la versión de producción de la web en dist/web.
 *
 *  - Une las hojas de estilo y los scripts EN EL MISMO ORDEN que web/index.html
 *    (los scripts son clásicos y dependen de ese orden).
 *  - Minifica con esbuild y pone una huella del contenido en el nombre del archivo,
 *    para que el servidor pueda guardarlos en caché sin caducidad.
 *  - Copia los recursos estáticos y escribe un index.html que carga 1 CSS + 1 JS.
 *
 * El código fuente (web/) no cambia: sigue abriéndose con doble clic para desarrollar.
 *
 *   npm run build:web
 */
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { transform } from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'web');
const out = join(root, 'dist', 'web');

const html = readFileSync(join(src, 'index.html'), 'utf8');

// Recursos locales en el orden en que aparecen en el HTML (los externos, como las fuentes, se respetan).
const STYLE = /^\s*<link rel="stylesheet" href="(?!https?:)([^"]+)">\r?\n/gm;
const SCRIPT = /^\s*<script src="([^"]+)"><\/script>\r?\n?/gm;
const styles = [...html.matchAll(STYLE)].map((m) => m[1]);
const scripts = [...html.matchAll(SCRIPT)].map((m) => m[1]);
if (!styles.length || !scripts.length) throw new Error('No se encontraron hojas de estilo o scripts en web/index.html');

const concat = (files) => files.map((file) => readFileSync(join(src, file), 'utf8')).join('\n');
const hash = (text) => createHash('sha256').update(text).digest('hex').slice(0, 10);

const css = concat(styles);
const js = concat(scripts);
const cssMin = (await transform(css, { loader: 'css', minify: true, target: ['chrome110', 'firefox115', 'safari16'] })).code;
const jsMin = (await transform(js, { loader: 'js', minify: true, target: 'es2020' })).code;

const cssName = `assets/app.${hash(cssMin)}.css`;
const jsName = `assets/app.${hash(jsMin)}.js`;

// index.html: el primer <link> local se sustituye por el CSS unido y el primer <script> por el JS unido.
let first = true;
let page = html.replace(STYLE, () => (first ? ((first = false), `  <link rel="stylesheet" href="${cssName}">\n`) : ''));
first = true;
page = page.replace(SCRIPT, () => (first ? ((first = false), `  <script src="${jsName}"></script>\n`) : ''));
page = page.replace(/<!-- Scripts clásicos[^>]*-->\r?\n/, '');

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'assets'), { recursive: true });
cpSync(join(src, 'assets'), join(out, 'assets'), { recursive: true });
writeFileSync(join(out, cssName), cssMin);
writeFileSync(join(out, jsName), jsMin);
writeFileSync(join(out, 'index.html'), page);

const formatKb = (text) => `${(Buffer.byteLength(text) / 1024).toFixed(1)} KB`;
const formatGzipKb = (text) => `${(gzipSync(text).length / 1024).toFixed(1)} KB`;
console.log(`CSS: ${styles.length} archivos, ${formatKb(css)} -> ${formatKb(cssMin)} (gzip ${formatGzipKb(cssMin)})`);
console.log(`JS:  ${scripts.length} archivos, ${formatKb(js)} -> ${formatKb(jsMin)} (gzip ${formatGzipKb(jsMin)})`);
console.log(`Peticiones locales al cargar: ${styles.length + scripts.length} -> 2`);
console.log(`Generado en ${out}`);
