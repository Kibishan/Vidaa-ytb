/**
 * Support pour Hisense VIDAA OS
 * Adapté de Empi9245/nuviotvsmart pour YouTube TV (youtube-webos / kabuki)
 */

import { SYNTHETIC_KEY_FLAG } from './utils.js';

export const VIDAA_BACK_KEY_CODES = [8, 27, 461, 10009];

let _isVidaaCached = null;
let _keyboardPollInterval = null;
let _lastInputEl = null;
let _lastInputValue = '';

/**
 * Détecte si l'application tourne sur un téléviseur Hisense VIDAA OS
 * ou via l'entrée explicite vidaa.html / ?platform=vidaa
 */
export function isVidaa() {
  if (_isVidaaCached !== null) return _isVidaaCached;
  if (typeof window === 'undefined') return false;

  try {
    const search = window.location ? window.location.search || '' : '';
    const pathname = window.location ? window.location.pathname || '' : '';
    const ua = (
      window.__ORIGINAL_USER_AGENT__ ||
      (window.navigator && window.navigator.userAgent) ||
      ''
    ).toLowerCase();

    const detected =
      window.__NUVIO_PLATFORM__ === 'vidaa' ||
      window.__YOUTUBE_PLATFORM__ === 'vidaa' ||
      (typeof document !== 'undefined' &&
        document.documentElement &&
        document.documentElement.classList.contains('vidaa-tv')) ||
      typeof window.Hisense_GetOSVersion === 'function' ||
      typeof window.Hisense_GetFirmWareVersion === 'function' ||
      typeof window.Hisense_GetDeviceID === 'function' ||
      typeof window.Hisense_installApp === 'function' ||
      typeof window.Hisense_Exit === 'function' ||
      typeof window.omi_platform !== 'undefined' ||
      typeof window.opera_omi !== 'undefined' ||
      pathname.indexOf('vidaa.html') !== -1 ||
      search.indexOf('wrapper=vidaa') !== -1 ||
      search.indexOf('platform=vidaa') !== -1 ||
      ua.indexOf('vidaa') !== -1 ||
      ua.indexOf('hisense') !== -1 ||
      ua.indexOf('odin/') !== -1 ||
      ua.indexOf('omi/') !== -1;

    _isVidaaCached = Boolean(detected);
    return _isVidaaCached;
  } catch {
    return false;
  }
}

export function isVidaaBackKey(keyCode) {
  return VIDAA_BACK_KEY_CODES.indexOf(keyCode) !== -1;
}

/**
 * Quitte proprement l'application sur VIDAA OS
 */
export function exitVidaaApp() {
  try {
    if (typeof window.Hisense_Exit === 'function') {
      window.Hisense_Exit();
      return true;
    }
    if (typeof window.Hisense_CloseApp === 'function') {
      window.Hisense_CloseApp();
      return true;
    }
    if (window.opera_omi && typeof window.opera_omi.exit === 'function') {
      window.opera_omi.exit();
      return true;
    }
    window.close();
    return true;
  } catch (e) {
    console.warn('[VIDAA] Impossible de fermer l’application:', e);
    return false;
  }
}

/**
 * Configure le viewport 1920x1080 et les classes CSS pour VIDAA OS
 */
export function configureVidaaEnvironment() {
  if (typeof document === 'undefined') return;

  try {
    document.documentElement.classList.add('vidaa-tv');
    window.__NUVIO_PLATFORM__ = 'vidaa';
    window.__YOUTUBE_PLATFORM__ = 'vidaa';

    let viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport && document.head) {
      viewport = document.createElement('meta');
      viewport.name = 'viewport';
      document.head.appendChild(viewport);
    }
    if (viewport) {
      viewport.setAttribute(
        'content',
        'width=1920, height=1080, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'
      );
    }

    if (typeof window.Hisense_AddInsecureDomain === 'function') {
      try {
        window.Hisense_AddInsecureDomain('*');
      } catch {
        // Ignore
      }
    }
  } catch (e) {
    console.warn('[VIDAA] Erreur de configuration environnement:', e);
  }
}

/**
 * Normalise les touches de la télécommande VIDAA OS pour YouTube TV (kabuki) :
 * - Touche Retour VIDAA (keyCode 8 / 461 / 10009) -> Escape (keyCode 27) hors champ texte
 * - Touches avance/retour rapide VIDAA (427 / 428) -> MediaFastForward (417) / MediaRewind (412)
 */
export function installVidaaKeyNormalizer() {
  if (typeof window === 'undefined' || window.__vidaaKeyNormalizerInstalled) return;
  window.__vidaaKeyNormalizerInstalled = true;

  const isTextInputFocused = (target) => {
    const el = target || document.activeElement;
    if (!el) return false;
    const tag = el.tagName;
    if (tag === 'INPUT') {
      const type = (el.type || 'text').toLowerCase();
      return (
        type === 'text' ||
        type === 'search' ||
        type === 'password' ||
        type === 'email' ||
        type === 'url' ||
        type === 'tel' ||
        type === 'number'
      );
    }
    return tag === 'TEXTAREA' || Boolean(el.isContentEditable);
  };

  const dispatchNormalizedKey = (type, originalEvent, mappedCode, mappedKey) => {
    let evt;
    try {
      evt = new KeyboardEvent(type, {
        bubbles: true,
        cancelable: true,
        composed: true,
        view: window,
        key: mappedKey,
        code: mappedKey,
        keyCode: mappedCode,
        which: mappedCode
      });
    } catch {
      evt = document.createEvent('KeyboardEvent');
      evt.initEvent(type, true, true);
    }

    evt[SYNTHETIC_KEY_FLAG] = true;
    evt.__vidaaNormalized = true;

    const desc = { get: () => mappedCode };
    const keyDesc = { get: () => mappedKey };
    try {
      Object.defineProperties(evt, {
        keyCode: desc,
        which: desc,
        key: keyDesc,
        code: keyDesc
      });
    } catch {
      // Ignore readonly descriptor failure
    }

    const target = originalEvent.target || document.activeElement || document.body;
    target.dispatchEvent(evt);
  };

  const handleKeyEvent = (evt) => {
    if (evt.__vidaaNormalized) return;

    const code = evt.keyCode || evt.which;

    // 1. Touche Retour sur télécommande VIDAA (8 = Backspace/Back sur VIDAA, 461 = Back, 10009 = Return)
    if (code === 8 || code === 461 || code === 10009) {
      if (code === 8 && isTextInputFocused(evt.target)) {
        return; // Laisse supprimer un caractère dans un vrai champ de saisie
      }

      // Si le panneau d'options YouTube Extended est ouvert, le gestionnaire UI va le fermer
      // Pour YouTube TV (kabuki), la touche Retour standard est Escape (keyCode 27)
      evt.preventDefault();
      evt.stopPropagation();
      dispatchNormalizedKey(evt.type, evt, 27, 'Escape');
      return;
    }

    // 2. Touches Avance / Retour rapide alternatives sur certaines télécommandes Hisense VIDAA
    if (code === 427) {
      evt.preventDefault();
      evt.stopPropagation();
      dispatchNormalizedKey(evt.type, evt, 417, 'MediaFastForward');
    } else if (code === 428) {
      evt.preventDefault();
      evt.stopPropagation();
      dispatchNormalizedKey(evt.type, evt, 412, 'MediaRewind');
    } else if ((code === 113 || code === 93 || code === 457) && !isTextInputFocused(evt.target)) {
      // F2 (113), ContextMenu (93) ou Info/Menu TV (457) -> Bouton Vert (404) pour ouvrir le menu du mod
      evt.preventDefault();
      evt.stopPropagation();
      dispatchNormalizedKey(evt.type, evt, 404, 'Green');
    }
  };

  window.addEventListener('keydown', handleKeyEvent, true);
  window.addEventListener('keyup', handleKeyEvent, true);
}

/**
 * Correctif clavier virtuel VIDAA OS :
 * Certains firmwares VIDAA modifient input.value sans déclencher l'événement 'input'.
 */
export function installVidaaKeyboardFix() {
  if (_keyboardPollInterval || typeof document === 'undefined') return;

  _keyboardPollInterval = window.setInterval(() => {
    const active = document.activeElement;
    if (
      active &&
      (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')
    ) {
      const currentVal = active.value || '';
      if (active !== _lastInputEl) {
        _lastInputEl = active;
        _lastInputValue = currentVal;
      } else if (currentVal !== _lastInputValue) {
        _lastInputValue = currentVal;
        try {
          active.dispatchEvent(new Event('input', { bubbles: true }));
          active.dispatchEvent(new Event('change', { bubbles: true }));
        } catch {
          const evt = document.createEvent('Event');
          evt.initEvent('input', true, true);
          active.dispatchEvent(evt);
        }
      }
    } else {
      _lastInputEl = null;
      _lastInputValue = '';
    }
  }, 250);
}

/**
 * Point d'entrée principal appelé au démarrage de userScript.js
 */
export function initVidaaSupport() {
  if (!isVidaa() && typeof window.PalmSystem !== 'undefined') {
    return;
  }

  console.info('[VIDAA] Initialisation du support Hisense VIDAA OS...');
  configureVidaaEnvironment();
  installVidaaKeyNormalizer();
  installVidaaKeyboardFix();
}
