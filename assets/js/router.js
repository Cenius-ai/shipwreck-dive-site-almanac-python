/* ==========================================================================
   Shipwreck Dive Site Almanac - client-side router
   Every route is still a real file (index.html, wreck.html, briefing.html,
   log.html, signin.html) so deep links and plain http.server keep working.
   The router upgrades that into client-side navigation: it intercepts
   internal link clicks, fetches the target document, swaps the <main> view,
   updates the URL with pushState and re-runs the route's view controller.
   No reload, full back/forward support, and a hard navigation fallback if
   anything goes wrong.
   ========================================================================== */

(function () {
  'use strict';

  var ROUTES = {
    'index.html': { page: 'catalog', label: 'Catalog' },
    'wreck.html': { page: 'wreck', label: 'Wreck site' },
    'briefing.html': { page: 'briefing', label: 'Dive briefing' },
    'log.html': { page: 'log', label: 'Dive log' },
    'signin.html': { page: 'signin', label: 'Demo sign-in' }
  };

  var loadedScripts = Object.create(null);
  var navigating = false;
  var lastUrl = window.location.href;

  function routeKey(pathname) {
    var parts = String(pathname || '').split('/');
    var last = parts[parts.length - 1];
    return last || 'index.html';
  }

  /* The catalog is also reachable as /index.html; history prefers the root. */
  function canonicalUrl(url) {
    var copy = new URL(url.href);
    if (/\/index\.html$/.test(copy.pathname)) {
      copy.pathname = copy.pathname.slice(0, -'index.html'.length);
    }
    return copy;
  }

  function routeFor(url) {
    if (!url || url.origin !== window.location.origin) {
      return null;
    }
    return ROUTES[routeKey(url.pathname)] || null;
  }

  function rememberLoadedScripts() {
    SDA.qsa('script[src]').forEach(function (tag) {
      loadedScripts[tag.getAttribute('src')] = true;
    });
  }

  function loadScript(src) {
    if (loadedScripts[src]) {
      return Promise.resolve();
    }
    loadedScripts[src] = true;
    return new Promise(function (resolve) {
      var tag = document.createElement('script');
      tag.src = src;
      tag.addEventListener('load', function () {
        resolve();
      });
      tag.addEventListener('error', function () {
        delete loadedScripts[src];
        resolve();
      });
      document.head.appendChild(tag);
    });
  }

  /* A routed view may live in a page whose scripts this document never loaded. */
  function ensureScripts(doc) {
    var sources = SDA.qsa('script[src]', doc).map(function (tag) {
      return tag.getAttribute('src');
    });
    return sources.reduce(function (chain, src) {
      return chain.then(function () {
        return loadScript(src);
      });
    }, Promise.resolve());
  }

  function updateNavigation(url) {
    var key = routeKey(url.pathname);
    SDA.qsa('.primary-nav a').forEach(function (link) {
      var target = new URL(link.getAttribute('href'), window.location.href);
      if (routeKey(target.pathname) === key) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }

  function swapView(doc, url) {
    var current = document.querySelector('#main');
    var next = doc.querySelector('#main');
    if (!current || !next) {
      return null;
    }
    var imported = document.importNode(next, true);
    imported.classList.add('view-enter');
    current.replaceWith(imported);
    if (doc.title) {
      document.title = doc.title;
    }
    var route = routeFor(url);
    if (route) {
      document.body.dataset.page = route.page;
    }
    updateNavigation(url);
    return imported;
  }

  function focusView(view) {
    if (!view) {
      return;
    }
    view.setAttribute('tabindex', '-1');
    try {
      view.focus({ preventScroll: true });
    } catch (error) {
      view.focus();
    }
  }

  function runRoute(route) {
    var init = SDA.pages[route.page];
    if (typeof init !== 'function') {
      return;
    }
    init();
  }

  function navigate(href, options) {
    var settings = options || {};
    var url;
    try {
      url = new URL(href, window.location.href);
    } catch (error) {
      window.location.assign(href);
      return;
    }
    var route = routeFor(url);
    if (!route) {
      window.location.assign(url.href);
      return;
    }
    if (navigating) {
      return;
    }
    navigating = true;
    url = canonicalUrl(url);

    fetch(url.href, { headers: { 'X-Almanac-Route': 'client' }, cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) {
          throw new Error('route ' + url.pathname + ' answered HTTP ' + response.status);
        }
        return response.text();
      })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var view = swapView(doc, url);
        if (!view) {
          throw new Error('route ' + url.pathname + ' has no main region');
        }
        if (!settings.fromHistory) {
          window.history.pushState({ url: url.href }, '', url.href);
        }
        lastUrl = url.href;
        return ensureScripts(doc).then(function () {
          runRoute(route);
          window.scrollTo(0, 0);
          focusView(document.querySelector('#main'));
        });
      })
      .catch(function (error) {
        if (window.console && typeof window.console.warn === 'function') {
          window.console.warn('Client-side route failed, loading the page directly', error);
        }
        window.location.assign(url.href);
      })
      .then(function () {
        navigating = false;
      });
  }

  function shouldRoute(event, anchor) {
    if (event.defaultPrevented || event.button !== 0) {
      return false;
    }
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return false;
    }
    if (!anchor || !anchor.getAttribute) {
      return false;
    }
    var target = anchor.getAttribute('target');
    if (target && target !== '_self') {
      return false;
    }
    if (anchor.hasAttribute('download')) {
      return false;
    }
    var href = anchor.getAttribute('href');
    if (!href || href.charAt(0) === '#') {
      return false;
    }
    if (/^[a-z]+:/i.test(href) && href.indexOf('http') !== 0) {
      return false;
    }
    var url;
    try {
      url = new URL(anchor.href, window.location.href);
    } catch (error) {
      return false;
    }
    return Boolean(routeFor(url));
  }

  function onClick(event) {
    var target = event.target;
    if (!target || typeof target.closest !== 'function') {
      return;
    }
    var anchor = target.closest('a[href]');
    if (!shouldRoute(event, anchor)) {
      return;
    }
    event.preventDefault();
    navigate(anchor.href, {});
  }

  function onPopState() {
    if (window.location.href === lastUrl) {
      return;
    }
    navigate(window.location.href, { fromHistory: true });
  }

  function start() {
    rememberLoadedScripts();
    document.addEventListener('click', onClick, false);
    window.addEventListener('popstate', onPopState);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  SDA.router = {
    routes: ROUTES,
    navigate: navigate,
    routeKey: routeKey,
    routeFor: routeFor
  };
})();
