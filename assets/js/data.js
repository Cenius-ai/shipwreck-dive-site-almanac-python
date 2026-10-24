/* ==========================================================================
   Shipwreck Dive Site Almanac - data loading
   One fetch of /data.json with validation, a cached result and a shared
   error panel that offers a Retry action instead of a blank page.
   ========================================================================== */

(function () {
  'use strict';

  var ALMANAC_URL = './data.json';
  var cache = null;

  function dataError(kind, message, status) {
    var error = new Error(message);
    error.kind = kind;
    error.status = status || 0;
    return error;
  }

  function validate(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw dataError('shape', 'The almanac data is not an object.');
    }
    if (!payload.tideReference || typeof payload.tideReference !== 'object') {
      throw dataError('shape', 'The almanac data has no tideReference.');
    }
    if (!Array.isArray(payload.sites)) {
      throw dataError('shape', 'The almanac data has no sites array.');
    }
    if (!Array.isArray(payload.checklist)) {
      throw dataError('shape', 'The almanac data has no checklist array.');
    }
    return payload;
  }

  function describe(error) {
    if (error && error.kind === 'parse') {
      return 'The data file could not be read: data.json is not valid JSON. Fix the file next to index.html and choose Retry.';
    }
    if (error && error.kind === 'shape') {
      return 'The data file loaded but is missing something this page needs (sites, checklist or tideReference). Check data.json and choose Retry.';
    }
    if (error && error.status) {
      return 'The almanac data file returned HTTP ' + error.status +
        '. Check that data.json sits next to index.html, then choose Retry.';
    }
    return 'The almanac data file (data.json) could not be fetched. Check the connection to this site, then choose Retry.';
  }

  function fetchData(force) {
    if (cache && !force) {
      return Promise.resolve(cache);
    }
    return fetch(ALMANAC_URL, { cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) {
          throw dataError('fetch', 'data.json responded with HTTP ' + response.status, response.status);
        }
        return response.text().then(function (text) {
          try {
            return JSON.parse(text);
          } catch (parseFailure) {
            throw dataError('parse', 'data.json is not valid JSON.');
          }
        });
      })
      .then(function (payload) {
        cache = validate(payload);
        return cache;
      });
  }

  /*
   * Renders a loading skeleton into `region`, then either the page content or
   * the shared error panel. `render` receives the validated payload.
   */
  function withData(region, render, options) {
    var settings = options || {};
    var attempt = 0;

    function run() {
      attempt += 1;
      region.setAttribute('aria-busy', 'true');
      SDA.clear(region);
      region.appendChild(SDA.loadingSkeleton(settings.skeletonRows || 3));

      fetchData(attempt > 1)
        .then(function (data) {
          region.removeAttribute('aria-busy');
          SDA.clear(region);
          render(data);
        })
        .catch(function (error) {
          region.removeAttribute('aria-busy');
          SDA.clear(region);
          if (window.console && typeof window.console.warn === 'function') {
            window.console.warn('Almanac data load failed', error);
          }
          region.appendChild(SDA.notice({
            chip: 'Data file',
            title: settings.errorTitle || 'The almanac data could not be loaded',
            message: describe(error),
            headingLevel: document.querySelector('h1') ? 'h2' : 'h1',
            actions: [
              { label: 'Retry', onClick: run },
              { label: 'Back to the catalog', href: './index.html', variant: 'quiet' }
            ]
          }));
        });
    }

    run();
  }

  SDA.fetchData = fetchData;
  SDA.withData = withData;
  SDA.describeDataError = describe;
})();
