import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

export const SMART_TV_USER_AGENT =
  'Mozilla/5.0 (Linux; NetCast; U) AppleWebKit/537.31 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.31 SmartTV/10.0';

const YT_ORIGIN = 'https://www.youtube.com';
const YT_TV_URL = 'https://www.youtube.com/tv';

const STATIC_MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.py': 'text/x-python; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.sh': 'text/x-shellscript; charset=utf-8',
  '.bat': 'application/x-msdos-program'
};

/**
 * Script injecté en tête de <head> dans la réponse HTML de YouTube TV (/tv)
 * - Active l'environnement Hisense VIDAA OS (1920x1080, classe vidaa-tv, Hisense API)
 * - Spoof le User-Agent SmartTV côté client pour kabuki
 * - Redirige automatiquement les appels fetch / XHR vers le proxy pour éviter tout blocage CORS
 */
function buildClientBootstrapScript(nonceAttr) {
  return `<meta id="app-viewport" name="viewport" content="width=1920, height=1080, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="manifest" href="/manifest.json" />
<script${nonceAttr}>
(function bootstrapYoutubeVidaa() {
  window.__ORIGINAL_USER_AGENT__ = navigator.userAgent || "";
  window.__NUVIO_PLATFORM__ = "vidaa";
  window.__YOUTUBE_PLATFORM__ = "vidaa";
  document.documentElement.classList.add("vidaa-tv");

  if (typeof window.Hisense_AddInsecureDomain === "function") {
    try { window.Hisense_AddInsecureDomain("*"); } catch (e) {}
  }

  var smartTvUA = ${JSON.stringify(SMART_TV_USER_AGENT)};
  try {
    Object.defineProperty(navigator, "userAgent", {
      get: function () { return smartTvUA; },
      configurable: true
    });
  } catch (e) {}

  if (!window.location.hash || window.location.hash === "#") {
    try {
      window.history.replaceState(
        null,
        "",
        window.location.pathname +
          window.location.search +
          "#/?env_forceFullAnimation=1&env_enableWebSpeech=1&env_enableVoice=1"
      );
    } catch (e) {
      window.location.hash = "#/?env_forceFullAnimation=1&env_enableWebSpeech=1&env_enableVoice=1";
    }
  }

  var CORS_PROXY_HOSTS = {
    "www.gstatic.com": true,
    "gstatic.com": true,
    "yt3.ggpht.com": true,
    "yt3.googleusercontent.com": true,
    "i.ytimg.com": true,
    "i9.ytimg.com": true,
    "clients1.google.com": true,
    "play.google.com": true,
    "youtubei.googleapis.com": true
  };

  var SAME_ORIGIN_YT_HOSTS = {
    "www.youtube.com": true,
    "youtube.com": true,
    "m.youtube.com": true
  };

  function rewriteRequestUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== "string") return rawUrl;
    if (rawUrl.indexOf("/cors-bypass/") === 0 || rawUrl.indexOf("data:") === 0 || rawUrl.indexOf("blob:") === 0) {
      return rawUrl;
    }
    var normalized = rawUrl.indexOf("//") === 0 ? window.location.protocol + rawUrl : rawUrl;
    if (normalized.indexOf("http://") !== 0 && normalized.indexOf("https://") !== 0) {
      return rawUrl;
    }
    try {
      var parsed = new URL(normalized);
      if ( parsed.origin === window.location.origin ) {
        return rawUrl;
      }
      if (SAME_ORIGIN_YT_HOSTS[parsed.hostname]) {
        return parsed.pathname + parsed.search + parsed.hash;
      }
      if (CORS_PROXY_HOSTS[parsed.hostname]) {
        return "/cors-bypass/" + encodeURIComponent(parsed.toString());
      }
    } catch (e) {}
    return rawUrl;
  }

  window.__rewriteYoutubeVidaaUrl = rewriteRequestUrl;

  if (typeof window.fetch === "function") {
    var origFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
      try {
        if (typeof input === "string") {
          input = rewriteRequestUrl(input);
        } else if (input && typeof URL !== "undefined" && input instanceof URL) {
          input = rewriteRequestUrl(input.toString());
        } else if (typeof Request !== "undefined" && input instanceof Request) {
          var rewritten = rewriteRequestUrl(input.url);
          if (rewritten !== input.url) {
            input = new Request(rewritten, input);
          }
        }
      } catch (e) {}
      return origFetch(input, init);
    };
  }

  if (typeof window.XMLHttpRequest !== "undefined") {
    var origOpen = window.XMLHttpRequest.prototype.open;
    window.XMLHttpRequest.prototype.open = function (method, url) {
      try {
        if (typeof url === "string") {
          arguments[1] = rewriteRequestUrl(url);
        } else if (url && typeof url.toString === "function") {
          arguments[1] = rewriteRequestUrl(url.toString());
        }
      } catch (e) {}
      return origOpen.apply(this, arguments);
    };
  }
})();
</script>`;
}

/**
 * Tente de servir un fichier statique local depuis dist/vidaa ou dist
 */
function tryServeStaticFile(pathname, res) {
  const cleanPath = pathname.split('?')[0];
  const candidateDirs = [
    path.join(ROOT_DIR, 'dist', 'vidaa'),
    path.join(ROOT_DIR, 'dist')
  ];

  for (const baseDir of candidateDirs) {
    const resolved = path.resolve(baseDir, '.' + cleanPath);
    if (!resolved.startsWith(baseDir)) continue;
    if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
      const ext = path.extname(resolved).toLowerCase();
      const mime = STATIC_MIME_TYPES[ext] || 'application/octet-stream';
      res.statusCode = 200;
      res.setHeader('Content-Type', mime);
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.end(fs.readFileSync(resolved));
      return true;
    }
  }
  return false;
}

/**
 * Lit le corps brut de la requête entrante
 */
async function readRequestBody(req) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return undefined;
  }
  if (req.body) {
    if (Buffer.isBuffer(req.body)) return req.body;
    if (typeof req.body === 'string') return Buffer.from(req.body);
    if (typeof req.body === 'object') return Buffer.from(JSON.stringify(req.body));
  }
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return chunks.length > 0 ? Buffer.concat(chunks) : undefined;
}

/**
 * Résout l'URL cible vers YouTube ou via /cors-bypass/
 */
function resolveUpstreamUrl(reqUrl) {
  const parsed = new URL(reqUrl, 'http://localhost');
  const pathname = parsed.pathname;

  // 1. Route /cors-bypass/<encoded_url>
  if (pathname.startsWith('/cors-bypass/')) {
    let rawTarget = pathname.slice('/cors-bypass/'.length);
    try {
      rawTarget = decodeURIComponent(rawTarget);
    } catch {
      // Ignore decode error
    }
    // Correction si le serveur a fusionné https:// en https:/
    rawTarget = rawTarget.replace(/^(https?):\/([^/])/, '$1://$2');
    if (parsed.search && !rawTarget.includes('?')) {
      rawTarget += parsed.search;
    }
    return { targetUrl: new URL(rawTarget), isTvHtmlEntry: false };
  }

  // 2. Point d'entrée YouTube TV (/tv)
  if (pathname === '/tv' || pathname === '/tv/') {
    const targetUrl = new URL(YT_TV_URL);
    parsed.searchParams.forEach((val, key) => {
      if (key !== 'platform' && key !== 'wrapper' && key !== 'path') {
        targetUrl.searchParams.append(key, val);
      }
    });
    return { targetUrl, isTvHtmlEntry: true };
  }

  // 3. Toutes les autres routes YouTube (/youtubei/*, /s/*, /api/*, etc.)
  const targetUrl = new URL(pathname + parsed.search, YT_ORIGIN);
  return { targetUrl, isTvHtmlEntry: false };
}

/**
 * Handler principal compatible Vercel Serverless Function et serveur HTTP Node.js
 */
export default async function handleProxyRequest(req, res) {
  const reqOrigin = req.headers.origin || '*';

  // Gestion CORS preflight
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.setHeader('Access-Control-Allow-Origin', reqOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, HEAD');
    res.setHeader(
      'Access-Control-Allow-Headers',
      req.headers['access-control-request-headers'] || '*'
    );
    res.end();
    return;
  }

  const reqUrl = req.url || '/';
  const pathname = reqUrl.split('?')[0];

  // Servir les fichiers statiques locaux (vidaa.html, index.html, userScript.js, manifest.json, sw.js, icon.png, etc.)
  if (
    pathname === '/vidaa.html' ||
    pathname === '/index.html' ||
    pathname.startsWith('/webOSUserScripts/') ||
    pathname === '/manifest.json' ||
    pathname === '/sw.js' ||
    pathname === '/icon.png' ||
    pathname === '/largeIcon.png' ||
    pathname === '/index.js' ||
    pathname.startsWith('/installer/')
  ) {
    const targetStatic = pathname === '/installer/' ? '/installer/index.html' : pathname;
    if (tryServeStaticFile(targetStatic, res)) {
      return;
    }
  }

  // Si on appelle / ou /vidaa.html sans fichier statique, servir directement l'entrée YouTube TV (/tv)
  if (pathname === '/' || pathname === '/vidaa.html' || pathname === '/index.html') {
    req.url = '/tv' + (reqUrl.includes('?') ? '?' + reqUrl.split('?')[1] : '');
  }

  let targetInfo;
  try {
    targetInfo = resolveUpstreamUrl(req.url);
  } catch (err) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end(`Invalid proxy target URL: ${err.message}`);
    return;
  }

  const { targetUrl, isTvHtmlEntry } = targetInfo;

  // Construction des en-têtes upstream
  const upstreamHeaders = new Headers();
  const skipReqHeaders = new Set([
    'host',
    'connection',
    'content-length',
    'accept-encoding',
    'origin',
    'referer',
    'user-agent',
    'cookie'
  ]);

  for (const [key, value] of Object.entries(req.headers)) {
    const lower = key.toLowerCase();
    if (
      skipReqHeaders.has(lower) ||
      lower.startsWith('x-vercel-') ||
      lower.startsWith('x-forwarded-') ||
      lower.startsWith('sec-fetch-')
    ) {
      continue;
    }
    if (value !== undefined) {
      upstreamHeaders.set(key, Array.isArray(value) ? value.join(', ') : value);
    }
  }

  upstreamHeaders.set('User-Agent', SMART_TV_USER_AGENT);
  upstreamHeaders.set('Origin', YT_ORIGIN);
  upstreamHeaders.set('Referer', YT_TV_URL);
  if (upstreamHeaders.has('x-origin')) {
    upstreamHeaders.set('x-origin', YT_ORIGIN);
  }

  if (req.headers.cookie) {
    const translatedCookie = req.headers.cookie
      .replace(/__LocalSecure-/g, '__Secure-')
      .replace(/__LocalHost-/g, '__Host-');
    upstreamHeaders.set('Cookie', translatedCookie);
  }

  try {
    const body = await readRequestBody(req);
    const upstreamRes = await fetch(targetUrl.toString(), {
      method: req.method,
      headers: upstreamHeaders,
      body,
      redirect: 'manual'
    });

    // Gestion des redirections upstream
    if ([301, 302, 303, 307, 308].includes(upstreamRes.status)) {
      const location = upstreamRes.headers.get('location');
      if (location) {
        try {
          const locUrl = new URL(location, targetUrl);
          if (locUrl.hostname === 'www.youtube.com' || locUrl.hostname === 'youtube.com') {
            res.statusCode = upstreamRes.status;
            res.setHeader('Location', locUrl.pathname + locUrl.search + locUrl.hash);
            res.end();
            return;
          }
        } catch {
          // Ignore
        }
      }
    }

    res.statusCode = upstreamRes.status;

    // Filtrage et réécriture des en-têtes de réponse
    const stripResHeaders = new Set([
      'content-encoding',
      'content-length',
      'transfer-encoding',
      'content-security-policy',
      'content-security-policy-report-only',
      'x-frame-options',
      'strict-transport-security',
      'cross-origin-opener-policy',
      'cross-origin-embedder-policy',
      'cross-origin-resource-policy',
      'set-cookie'
    ]);

    upstreamRes.headers.forEach((value, key) => {
      if (!stripResHeaders.has(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    // Réécriture des cookies Set-Cookie pour qu'ils fonctionnent sur le domaine du proxy
    const setCookies =
      typeof upstreamRes.headers.getSetCookie === 'function'
        ? upstreamRes.headers.getSetCookie()
        : upstreamRes.headers.get('set-cookie')
          ? [upstreamRes.headers.get('set-cookie')]
          : [];

    if (setCookies.length > 0) {
      const isHttps =
        req.headers['x-forwarded-proto'] === 'https' ||
        (req.socket && req.socket.encrypted);

      const rewrittenCookies = setCookies.map((cookie) => {
        let c = cookie
          .replace(/;\s*Domain=[^;]+/gi, '')
          .replace(/;\s*Path=\/tv/gi, '; Path=/')
          .replace(/__Secure-/g, '__LocalSecure-')
          .replace(/__Host-/g, '__LocalHost-');
        if (!isHttps) {
          c = c.replace(/;\s*Secure/gi, '').replace(/;\s*SameSite=None/gi, '; SameSite=Lax');
        }
        return c;
      });
      res.setHeader('Set-Cookie', rewrittenCookies);
    }

    res.setHeader('Access-Control-Allow-Origin', reqOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    const contentType = (upstreamRes.headers.get('content-type') || '').toLowerCase();

    // 1. Transformation du HTML de YouTube TV (/tv)
    if (isTvHtmlEntry || contentType.includes('text/html')) {
      let html = await upstreamRes.text();
      const nonceMatch = html.match(/<script[^>]+nonce="([^"]+)"/i);
      const nonceAttr = nonceMatch ? ` nonce="${nonceMatch[1]}"` : '';

      const bootstrapMarkup = buildClientBootstrapScript(nonceAttr);
      if (html.includes('<head>')) {
        html = html.replace('<head>', `<head>${bootstrapMarkup}`);
      } else {
        html = bootstrapMarkup + html;
      }

      const userScriptTag = `<script src="/webOSUserScripts/userScript.js"${nonceAttr}></script>`;
      if (html.includes('</body>')) {
        html = html.replace('</body>', `${userScriptTag}</body>`);
      } else {
        html += userScriptTag;
      }

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.end(html);
      return;
    }

    // 2. Transformation des bundles JS de YouTube TV (kabuki base.js)
    if (
      (contentType.includes('javascript') || targetUrl.pathname.includes('/s/_/kabuki/')) &&
      targetUrl.pathname.includes('/s/_/kabuki/')
    ) {
      let js = await upstreamRes.text();
      js = js
        .replace(
          'String(_.cb.location.href)',
          JSON.stringify(YT_TV_URL)
        )
        .replace(
          'b["X-Origin"]=window.location.origin',
          `b["X-Origin"]=${JSON.stringify(YT_ORIGIN)}`
        )
        .replace(
          'document.location.toString()',
          JSON.stringify(YT_TV_URL)
        );
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.end(js);
      return;
    }

    // 3. Réponse binaire ou JSON brute
    const arrayBuffer = await upstreamRes.arrayBuffer();
    res.end(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error('[VIDAA Proxy Error]', err);
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'Proxy error', message: err.message }));
  }
}
