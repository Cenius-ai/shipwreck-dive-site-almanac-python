/* ==========================================================================
   Shipwreck Dive Site Almanac - shared shell helpers
   Classic script (no modules, no build step). Exposes the SDA namespace.
   ========================================================================== */

var SDA = (function () {
  'use strict';

  /* Route controllers, keyed by <body data-page>. The router calls these
     after it swaps the view in; each page script registers its own. */
  var pages = {};

  function registerPage(name, init) {
    if (typeof name === 'string' && typeof init === 'function') {
      pages[name] = init;
    }
  }

  /* ---------------------------------------------------------------- DOM ---- */

  function el(tag, props, children) {
    var node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (key) {
        var value = props[key];
        if (value === null || value === undefined || value === false) {
          return;
        }
        if (key === 'class') {
          node.className = value;
        } else if (key === 'text') {
          node.textContent = value;
        } else if (key === 'dataset') {
          Object.keys(value).forEach(function (dataKey) {
            node.dataset[dataKey] = value[dataKey];
          });
        } else if (key === 'attrs') {
          Object.keys(value).forEach(function (attrName) {
            if (value[attrName] !== null && value[attrName] !== undefined) {
              node.setAttribute(attrName, value[attrName]);
            }
          });
        } else if (key.slice(0, 2) === 'on' && typeof value === 'function') {
          node.addEventListener(key.slice(2).toLowerCase(), value);
        } else {
          node[key] = value;
        }
      });
    }
    append(node, children);
    return node;
  }

  function append(node, children) {
    if (children === null || children === undefined) {
      return node;
    }
    var list = Array.isArray(children) ? children : [children];
    list.forEach(function (child) {
      if (child === null || child === undefined || child === false) {
        return;
      }
      node.appendChild(typeof child === 'string' || typeof child === 'number'
        ? document.createTextNode(String(child))
        : child);
    });
    return node;
  }

  function clear(node) {
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
    return node;
  }

  function qs(selector, root) {
    return (root || document).querySelector(selector);
  }

  function qsa(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  /* ---------------------------------------------------------- formatting ---- */

  function isNumber(value) {
    return typeof value === 'number' && isFinite(value);
  }

  function numberOrNull(value) {
    if (isNumber(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim() !== '') {
      var parsed = Number(value);
      return isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  function trimNumber(value) {
    var rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  }

  function metres(value) {
    var number = numberOrNull(value);
    return number === null ? 'Not published' : trimNumber(number) + ' m';
  }

  function metresOrDash(value) {
    var number = numberOrNull(value);
    return number === null ? '\u2014' : trimNumber(number) + ' m';
  }

  var MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  function isoParts(isoDate) {
    if (typeof isoDate !== 'string') {
      return null;
    }
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
    if (!match) {
      return null;
    }
    return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  }

  /* Long human date from a YYYY-MM-DD string; falls back to the raw value. */
  function formatLongDate(isoDate) {
    var parts = isoParts(isoDate);
    if (!parts || parts.month < 1 || parts.month > 12) {
      return isoDate || 'Date not published';
    }
    return parts.day + ' ' + MONTHS[parts.month - 1] + ' ' + parts.year;
  }

  /* Short human date, used in dense table rows. */
  function formatShortDate(isoDate) {
    var parts = isoParts(isoDate);
    if (!parts || parts.month < 1 || parts.month > 12) {
      return isoDate || '\u2014';
    }
    return parts.day + ' ' + MONTHS[parts.month - 1].slice(0, 3) + ' ' + parts.year;
  }

  function todayISO() {
    var now = new Date();
    var month = String(now.getMonth() + 1);
    var day = String(now.getDate());
    return now.getFullYear() + '-' + (month.length < 2 ? '0' + month : month) + '-' +
      (day.length < 2 ? '0' + day : day);
  }

  function queryParam(name) {
    try {
      return new URLSearchParams(window.location.search).get(name);
    } catch (error) {
      return null;
    }
  }

  /* ------------------------------------------------------------ storage ---- */

  function storage() {
    try {
      return window.localStorage;
    } catch (error) {
      return null;
    }
  }

  function readJSON(key) {
    var store = storage();
    if (!store) {
      return { value: null, reason: 'unavailable' };
    }
    var raw;
    try {
      raw = store.getItem(key);
    } catch (error) {
      return { value: null, reason: 'unreadable' };
    }
    if (raw === null || raw === '') {
      return { value: null, reason: 'absent' };
    }
    try {
      return { value: JSON.parse(raw), reason: 'ok' };
    } catch (error) {
      return { value: null, reason: 'corrupt' };
    }
  }

  function writeJSON(key, value) {
    var store = storage();
    if (!store) {
      return false;
    }
    try {
      store.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  }

  function removeKey(key) {
    var store = storage();
    if (!store) {
      return false;
    }
    try {
      store.removeItem(key);
      return true;
    } catch (error) {
      return false;
    }
  }

  /* -------------------------------------------------------------- state ---- */

  function siteUrl(id) {
    return './wreck.html?id=' + encodeURIComponent(id);
  }

  function briefingUrl(id) {
    return './briefing.html?id=' + encodeURIComponent(id);
  }

  function logUrl(id) {
    return './log.html' + (id ? '?id=' + encodeURIComponent(id) : '');
  }

  function findSite(data, id) {
    if (!data || !Array.isArray(data.sites) || typeof id !== 'string' || !id) {
      return null;
    }
    for (var i = 0; i < data.sites.length; i += 1) {
      if (data.sites[i] && data.sites[i].id === id) {
        return data.sites[i];
      }
    }
    return null;
  }

  /* Resolves the ?id= contract used by wreck.html, briefing.html and log.html. */
  function resolveSite(data) {
    var id = queryParam('id');
    if (!id) {
      return { id: '', site: null, reason: 'missing' };
    }
    var site = findSite(data, id);
    if (!site) {
      return { id: id, site: null, reason: 'unknown' };
    }
    return { id: id, site: site, reason: 'ok' };
  }

  /* ------------------------------------------------------------ notices ---- */

  function notice(options) {
    var panel = el('div', {
      class: 'notice' + (options.tone === 'info' ? ' notice--info' : ''),
      attrs: { role: options.tone === 'info' ? 'status' : 'alert' }
    });
    if (options.chip) {
      panel.appendChild(el('p', { class: 'chip', text: options.chip }));
    }
    panel.appendChild(el(options.headingLevel === 'h1' ? 'h1' : 'h2', { text: options.title }));
    if (options.message) {
      panel.appendChild(el('p', { text: options.message }));
    }
    if (options.actions && options.actions.length) {
      var row = el('div', { class: 'notice__actions' });
      options.actions.forEach(function (action) {
        if (typeof action.onClick === 'function') {
          row.appendChild(el('button', {
            class: 'btn ' + (action.variant === 'quiet' ? 'btn--quiet' : 'btn--primary'),
            type: 'button',
            text: action.label,
            onClick: action.onClick
          }));
        } else if (action.href) {
          row.appendChild(el('a', {
            class: 'btn ' + (action.variant === 'quiet' ? 'btn--quiet' : 'btn--primary'),
            href: action.href,
            text: action.label
          }));
        }
      });
      panel.appendChild(row);
    }
    return panel;
  }

  function loadingSkeleton(rows) {
    var count = rows || 3;
    var grid = el('div', { class: 'skeleton-grid', attrs: { 'aria-hidden': 'true' } });
    for (var i = 0; i < count; i += 1) {
      grid.appendChild(el('div', { class: 'skeleton-card' }, [
        el('div', { class: 'skeleton-line skeleton-line--tall' }),
        el('div', { class: 'skeleton-line' }),
        el('div', { class: 'skeleton-line skeleton-line--short' })
      ]));
    }
    var wrapper = el('div', { class: 'section' }, [
      el('p', { class: 'meta-line', text: 'Loading the almanac\u2026' }),
      grid
    ]);
    return wrapper;
  }

  /* --------------------------------------------------------- page parts ---- */

  function tideLine(tideReference) {
    var line = el('div', { class: 'tide-line' });
    if (!tideReference || typeof tideReference !== 'object') {
      line.appendChild(el('span', { class: 'meta-line', text: 'No tide reference published in data.json.' }));
      return line;
    }
    line.appendChild(el('span', { text: tideReference.label || 'Tide reference day' }));
    line.appendChild(el('span', {}, ['High ', el('b', { text: tideReference.highWater || '\u2014' })]));
    line.appendChild(el('span', {}, ['Low ', el('b', { text: tideReference.lowWater || '\u2014' })]));
    line.appendChild(el('span', {}, ['Second high ', el('b', { text: tideReference.secondaryHighWater || '\u2014' })]));
    line.appendChild(el('span', {}, ['Second low ', el('b', { text: tideReference.secondaryLowWater || '\u2014' })]));
    return line;
  }

  function siteMissingPanel(resolved) {
    var message = resolved.reason === 'missing'
      ? 'This page needs a site id in the address bar, for example wreck.html?id=thistlegorm.'
      : 'No wreck in this almanac has the id "' + resolved.id + '". The link may be out of date.';
    return notice({
      chip: 'Site not found',
      title: 'That wreck site could not be found',
      message: message + ' Pick a wreck from the catalog and the full page will load.',
      headingLevel: document.querySelector('h1') ? 'h2' : 'h1',
      actions: [
        { label: 'Back to the catalog', href: './index.html' },
        { label: 'Open the dive log', href: './log.html', variant: 'quiet' }
      ]
    });
  }

  /* --------------------------------------------------------- catalog page - */

  function siteCard(site) {
    var facts = el('dl', { class: 'site-card__facts' }, [
      el('div', { class: 'fact' }, [
        el('dt', { text: 'Wrecked' }),
        el('dd', { text: site.sankYear ? String(site.sankYear) : 'Not published' })
      ]),
      el('div', { class: 'fact' }, [
        el('dt', { text: 'Max depth' }),
        el('dd', { text: metres(site.seabedDepthM) })
      ]),
      el('div', { class: 'fact' }, [
        el('dt', { text: 'Certification' }),
        el('dd', { text: site.certificationRequired || 'Not published' })
      ])
    ]);
    return el('a', { class: 'site-card', href: siteUrl(site.id) }, [
      el('span', { class: 'site-card__name', text: site.name || site.id }),
      el('span', {
        class: 'site-card__region',
        text: [site.region, site.country].filter(Boolean).join(' \u00b7 ') || 'Region not published'
      }),
      facts,
      el('span', { class: 'site-card__more', text: 'Open wreck page \u2192' })
    ]);
  }

  function renderCatalog(data, region) {
    clear(region);
    region.appendChild(tideLine(data.tideReference));
    var sites = Array.isArray(data.sites) ? data.sites : [];
    if (!sites.length) {
      region.appendChild(notice({
        tone: 'info',
        chip: 'Empty catalog',
        title: 'No wreck sites are published yet',
        message: 'Add an object to the "sites" array in data.json and reload this page to publish it here.',
        actions: [{ label: 'Open data.json', href: './data.json', variant: 'quiet' }]
      }));
      return;
    }
    var grid = el('div', { class: 'site-grid' });
    sites.forEach(function (site) {
      grid.appendChild(siteCard(site));
    });
    region.appendChild(grid);
    region.appendChild(el('p', {
      class: 'table-note',
      text: sites.length + ' wreck sites published. Every slack window is computed from the single tide reference day above.'
    }));
  }

  function initCatalog() {
    var region = qs('[data-catalog-region]');
    if (!region) {
      return;
    }
    SDA.withData(region, function (data) {
      renderCatalog(data, region);
    }, { skeletonRows: 6, errorTitle: 'The wreck catalog could not be loaded' });
  }

  /* ------------------------------------------------------------- shell ----- */

  function initShell() {
    /* Delegated so buttons rendered after the data load still print. */
    document.addEventListener('click', function (event) {
      var target = event.target && event.target.closest ? event.target.closest('[data-print]') : null;
      if (target) {
        event.preventDefault();
        window.print();
      }
    });
    if (document.querySelector('[data-page="catalog"]')) {
      initCatalog();
    }
  }

  registerPage('catalog', initCatalog);
  document.addEventListener('DOMContentLoaded', initShell);

  return {
    pages: pages,
    registerPage: registerPage,
    el: el,
    append: append,
    clear: clear,
    qs: qs,
    qsa: qsa,
    isNumber: isNumber,
    numberOrNull: numberOrNull,
    trimNumber: trimNumber,
    metres: metres,
    metresOrDash: metresOrDash,
    formatLongDate: formatLongDate,
    formatShortDate: formatShortDate,
    todayISO: todayISO,
    queryParam: queryParam,
    readJSON: readJSON,
    writeJSON: writeJSON,
    removeKey: removeKey,
    siteUrl: siteUrl,
    briefingUrl: briefingUrl,
    logUrl: logUrl,
    findSite: findSite,
    resolveSite: resolveSite,
    notice: notice,
    loadingSkeleton: loadingSkeleton,
    tideLine: tideLine,
    siteMissingPanel: siteMissingPanel,
    renderCatalog: renderCatalog
  };
})();
