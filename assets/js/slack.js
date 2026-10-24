/* ==========================================================================
   Shipwreck Dive Site Almanac - slack water windows
   Deterministic: start = tide anchor time + site slackOffsetMin,
   end = start + site slackWindowMinutes, both wrapped into a 24 hour clock.
   No network, no tide service: one static reference day drives every site.
   ========================================================================== */

(function () {
  'use strict';

  var MINUTES_PER_DAY = 1440;

  var ANCHORS = {
    high: { field: 'highWater', label: 'High water' },
    low: { field: 'lowWater', label: 'Low water' },
    high2: { field: 'secondaryHighWater', label: 'Second high water' },
    low2: { field: 'secondaryLowWater', label: 'Second low water' }
  };

  var ANCHOR_ORDER = ['high', 'low', 'high2', 'low2'];

  function parseHHMM(value) {
    if (typeof value !== 'string') {
      return null;
    }
    var match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
    if (!match) {
      return null;
    }
    var hours = parseInt(match[1], 10);
    var minutes = parseInt(match[2], 10);
    if (hours > 23 || minutes > 59) {
      return null;
    }
    return hours * 60 + minutes;
  }

  function wrapMinutes(total) {
    return ((total % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  }

  function pad(value) {
    return value < 10 ? '0' + value : String(value);
  }

  function formatTime(total) {
    var wrapped = wrapMinutes(total);
    return pad(Math.floor(wrapped / 60)) + ':' + pad(wrapped % 60);
  }

  function isWholeNumber(value) {
    return typeof value === 'number' && isFinite(value) && Math.round(value) === value;
  }

  function anchorMeta(anchorKey) {
    return ANCHORS[anchorKey] || null;
  }

  function windowForAnchor(tideReference, site, anchorKey) {
    var anchor = anchorMeta(anchorKey);
    if (!anchor) {
      return { ok: false, reason: 'No slack anchor is published for this site.' };
    }
    var anchorMinutes = parseHHMM(tideReference ? tideReference[anchor.field] : null);
    if (anchorMinutes === null) {
      return { ok: false, reason: 'The tide reference day has no valid ' + anchor.label.toLowerCase() + ' time.' };
    }
    var offset = site ? site.slackOffsetMin : null;
    if (!isWholeNumber(offset)) {
      return { ok: false, reason: 'The slack offset for this site is missing or not a whole number of minutes.' };
    }
    var windowMinutes = site ? site.slackWindowMinutes : null;
    if (!isWholeNumber(windowMinutes) || windowMinutes <= 0) {
      return { ok: false, reason: 'No slack window length is published for this site.' };
    }
    var startMinutes = wrapMinutes(anchorMinutes + offset);
    var endMinutes = wrapMinutes(startMinutes + windowMinutes);
    var crossesMidnight = startMinutes + windowMinutes >= MINUTES_PER_DAY;
    return {
      ok: true,
      anchorKey: anchorKey,
      anchorLabel: anchor.label,
      anchorTime: formatTime(anchorMinutes),
      offsetMin: offset,
      windowMinutes: windowMinutes,
      start: formatTime(startMinutes),
      end: formatTime(endMinutes),
      startMinutes: startMinutes,
      endMinutes: endMinutes,
      crossesMidnight: crossesMidnight,
      windowLabel: formatTime(startMinutes) + ' \u2013 ' + formatTime(endMinutes) +
        (crossesMidnight ? ' (next day)' : ''),
      lengthLabel: windowMinutes + ' min'
    };
  }

  /* The site's own published window: its anchor, its offset, its length. */
  function siteWindow(tideReference, site) {
    if (!site) {
      return { ok: false, reason: 'No site record provided.' };
    }
    return windowForAnchor(tideReference, site, site.slackAnchor);
  }

  /* Every published reference time, same offset, for a diver checking by hand. */
  function referenceWindows(tideReference, site) {
    var own = siteWindow(tideReference, site);
    var rows = [];
    if (own.ok) {
      rows.push({ window: own, basis: 'Site window' });
    }
    ANCHOR_ORDER.forEach(function (key) {
      if (!own.ok || key !== own.anchorKey) {
        var reference = windowForAnchor(tideReference, site, key);
        if (reference.ok) {
          rows.push({ window: reference, basis: 'Reference only' });
        }
      }
    });
    return { own: own, rows: rows };
  }

  function offsetLabel(offset) {
    if (!isWholeNumber(offset)) {
      return 'Not published';
    }
    if (offset === 0) {
      return '0 min';
    }
    return (offset > 0 ? '+' : '\u2212') + Math.abs(offset) + ' min';
  }

  SDA.slack = {
    anchors: ANCHORS,
    anchorOrder: ANCHOR_ORDER,
    parseHHMM: parseHHMM,
    formatTime: formatTime,
    wrapMinutes: wrapMinutes,
    windowForAnchor: windowForAnchor,
    siteWindow: siteWindow,
    referenceWindows: referenceWindows,
    offsetLabel: offsetLabel
  };
})();
