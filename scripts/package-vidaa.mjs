import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const VIDAA_DIR = path.join(DIST_DIR, 'vidaa');
const ZIP_OUTPUT = path.join(DIST_DIR, 'youtube-vidaa.zip');

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      if (entry === 'vidaa' || entry === 'youtube-vidaa.zip') continue;
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

function main() {
  console.log('[VIDAA] Compilation du bundle YouTube Extended...');
  execSync('npm run build', { cwd: ROOT_DIR, stdio: 'inherit' });

  if (fs.existsSync(VIDAA_DIR)) {
    fs.rmSync(VIDAA_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(VIDAA_DIR, { recursive: true });

  // Copier les artefacts compilés vers dist/vidaa
  copyRecursive(DIST_DIR, VIDAA_DIR);

  // Copier manifest.json, sw.js et installer/
  for (const file of ['manifest.json', 'sw.js']) {
    const srcFile = path.join(ROOT_DIR, file);
    if (fs.existsSync(srcFile)) {
      fs.copyFileSync(srcFile, path.join(VIDAA_DIR, file));
    }
  }

  const installerSrc = path.join(ROOT_DIR, 'installer');
  if (fs.existsSync(installerSrc)) {
    copyRecursive(installerSrc, path.join(VIDAA_DIR, 'installer'));
  }

  // Générer dist/vidaa/index.html et dist/vidaa/vidaa.html avec le marqueur de build et __NUVIO_PLATFORM__ = "vidaa"
  const buildStamp = new Date().toISOString();
  const indexHtmlPath = path.join(VIDAA_DIR, 'index.html');
  let baseHtml = fs.readFileSync(indexHtmlPath, 'utf8');

  if (!baseHtml.includes('name="nuvio-build"')) {
    baseHtml = baseHtml.replace(
      '<head>',
      `<head>\n    <meta name="nuvio-build" content="${buildStamp}" />`
    );
  }
  fs.writeFileSync(indexHtmlPath, baseHtml, 'utf8');

  const vidaaHtml = baseHtml.replace(
    `<meta name="nuvio-build" content="${buildStamp}" />`,
    `<meta name="nuvio-build" content="${buildStamp}" />\n    <script>window.__NUVIO_PLATFORM__ = "vidaa"; window.__YOUTUBE_PLATFORM__ = "vidaa";</script>`
  );
  fs.writeFileSync(path.join(VIDAA_DIR, 'vidaa.html'), vidaaHtml, 'utf8');

  // Créer l'archive dist/youtube-vidaa.zip si zip ou python3 est disponible
  if (fs.existsSync(ZIP_OUTPUT)) {
    fs.rmSync(ZIP_OUTPUT, { force: true });
  }
  try {
    execSync(`cd "${VIDAA_DIR}" && zip -r "${ZIP_OUTPUT}" .`, { stdio: 'ignore' });
    console.log(`[VIDAA] Archive créée : ${ZIP_OUTPUT}`);
  } catch {
    try {
      execSync(
        `python3 -c 'import shutil; shutil.make_archive(${JSON.stringify(ZIP_OUTPUT.replace(/\.zip$/, ''))}, "zip", ${JSON.stringify(VIDAA_DIR)})'`,
        { stdio: 'ignore' }
      );
      console.log(`[VIDAA] Archive créée : ${ZIP_OUTPUT}`);
    } catch {
      console.warn('[VIDAA] Utilitaire zip non trouvé, dossier dist/vidaa prêt sans archive .zip.');
    }
  }

  console.log(`[VIDAA] Build terminé dans ${VIDAA_DIR} (build: ${buildStamp})`);
}

main();
