/* ==========================================================================
   Shipwreck Dive Site Almanac - wreck page
   Vessel identity, proportional depth profile, sinking history, the slack
   water table for the site, and cross-links to briefing and log.
   ========================================================================== */

(function () {
  'use strict';

  function identityLine(site) {
    var parts = [];
    if (site.vesselType) {
      parts.push(site.vesselType);
    }
    if (site.builtYear) {
      parts.push('Built ' + site.builtYear);
    }
    if (SDA.numberOrNull(site.lengthM) !== null) {
      parts.push(SDA.trimNumber(site.lengthM) + ' m long');
    }
    return parts.join(' \u00b7 ');
  }

  function positionFact(site) {
    var position = site.position || {};
    if (SDA.numberOrNull(position.lat) === null || SDA.numberOrNull(position.lon) === null) {
      return null;
    }
    return SDA.trimNumber(position.lat) + '\u00b0, ' + SDA.trimNumber(position.lon) + '\u00b0';
  }

  function factGrid(site) {
    var facts = [
      { label: 'Wreck year', value: site.sankYear ? String(site.sankYear) : 'Not published' },
      { label: 'Max depth', value: SDA.metres(site.seabedDepthM) },
      { label: 'Certification', value: site.certificationRequired || 'Not published' }
    ];
    var position = positionFact(site);
    if (position) {
      facts.push({ label: 'Position', value: position });
    }
    var list = SDA.el('dl', { class: 'fact-grid' });
    facts.forEach(function (fact) {
      list.appendChild(SDA.el('div', {}, [
        SDA.el('dt', { text: fact.label }),
        SDA.el('dd', { text: fact.value })
      ]));
    });
    return list;
  }

  function depthProfile(site) {
    var seabed = SDA.numberOrNull(site.seabedDepthM);
    var deck = SDA.numberOrNull(site.deckDepthM);
    var shallowest = SDA.numberOrNull(site.shallowestDepthM);

    if (seabed === null || seabed <= 0) {
      return SDA.el('p', { class: 'depth-empty', text: 'No depth profile is published for this site.' });
    }

    function clamp(depth) {
      if (depth === null || depth < 0) {
        return null;
      }
      return depth > seabed ? seabed : depth;
    }

    var deckDepth = clamp(deck);
    var shallowDepth = clamp(shallowest);
    var figure = SDA.el('figure', { class: 'depth' });
    var track = SDA.el('div', { class: 'depth-track', attrs: { 'aria-hidden': 'true' } });

    var labels = SDA.el('div', { class: 'depth-labels' });
    if (shallowDepth !== null) {
      track.appendChild(SDA.el('div', {
        class: 'depth-band',
        attrs: { style: 'left:' + (shallowDepth / seabed) * 100 + '%;width:' + (100 - (shallowDepth / seabed) * 100) + '%' }
      }));
      track.appendChild(SDA.el('div', {
        class: 'depth-marker',
        attrs: { style: 'left:' + (shallowDepth / seabed) * 100 + '%' }
      }));
      labels.appendChild(SDA.el('span', {
        attrs: { style: 'left:' + (shallowDepth / seabed) * 100 + '%' },
        text: 'Shallowest ' + SDA.trimNumber(shallowDepth) + ' m'
      }));
    }

    if (deckDepth !== null && deckDepth !== shallowDepth) {
      track.appendChild(SDA.el('div', {
        class: 'depth-marker',
        attrs: { style: 'left:' + (deckDepth / seabed) * 100 + '%' }
      }));
      labels.appendChild(SDA.el('span', {
        attrs: { style: 'left:' + (deckDepth / seabed) * 100 + '%' },
        text: 'Deck ' + SDA.trimNumber(deckDepth) + ' m'
      }));
    }

    track.appendChild(SDA.el('div', {
      class: 'depth-marker depth-marker--edge',
      attrs: { style: 'left:100%' }
    }));
    labels.appendChild(SDA.el('span', {
      class: 'is-edge',
      attrs: { style: 'left:100%' },
      text: 'Seabed ' + SDA.trimNumber(seabed) + ' m'
    }));

    figure.appendChild(track);
    figure.appendChild(labels);

    var legend = SDA.el('div', { class: 'depth-legend' }, [
      SDA.el('span', {}, ['Shallowest ', SDA.el('b', { text: SDA.metresOrDash(shallowest) })]),
      SDA.el('span', {}, ['Deck ', SDA.el('b', { text: SDA.metresOrDash(deck) })]),
      SDA.el('span', {}, ['Seabed ', SDA.el('b', { text: SDA.metresOrDash(seabed) })])
    ]);
    figure.appendChild(legend);
    figure.appendChild(SDA.el('figcaption', {
      class: 'table-note',
      text: 'Scale runs from the surface at 0 m to the seabed at ' + SDA.trimNumber(seabed) + ' m.'
    }));

    return figure;
  }

  function depthSection(site) {
    var section = SDA.el('section', { class: 'section' });
    section.appendChild(SDA.el('h2', { class: 'chip', text: 'Depth profile' }));
    section.appendChild(depthProfile(site));
    return section;
  }

  function historySection(site) {
    var section = SDA.el('section', { class: 'section' });
    section.appendChild(SDA.el('h2', { class: 'chip', text: 'Sinking history' }));
    var head = SDA.el('div', { class: 'section-head' });
    head.appendChild(SDA.el('h3', {
      text: site.sinkingCause || 'Cause not published'
    }));
    head.appendChild(SDA.el('p', {
      class: 'section-meta',
      text: site.sankDate ? SDA.formatLongDate(site.sankDate) : (site.sankYear ? String(site.sankYear) : '')
    }));
    section.appendChild(head);
    var prose = SDA.el('div', { class: 'prose' });
    prose.appendChild(SDA.el('p', {
      text: site.sinkingHistory || 'No narrative account is published for this wreck yet.'
    }));
    section.appendChild(prose);
    return section;
  }

  function slackSection(data, site) {
    var section = SDA.el('section', { class: 'section' });
    section.appendChild(SDA.el('h2', { class: 'chip', text: 'Slack water' }));
    var reference = data.tideReference || {};
    var label = reference.label || 'the tide reference day';
    var result = SDA.slack.referenceWindows(reference, site);
    var caution = reference.caution || 'Slack windows are a planning aid only, not for navigation.';

    var wrap = SDA.el('div', { class: 'table-wrap' });
    var table = SDA.el('table', { class: 'data-table' });
    table.appendChild(SDA.el('caption', {
      text: 'Slack water windows for ' + (site.name || site.id) + ', computed from ' + label +
        '. ' + caution
    }));
    var headRow = SDA.el('tr');
    ['Tide reference', 'Offset', 'Slack window', 'Length', 'Basis'].forEach(function (heading) {
      headRow.appendChild(SDA.el('th', { attrs: { scope: 'col' }, text: heading }));
    });
    table.appendChild(SDA.el('thead', {}, headRow));
    var body = SDA.el('tbody');

    if (!result.own.ok) {
      var message = 'No slack window published \u2014 ' + result.own.reason;
      body.appendChild(SDA.el('tr', {}, SDA.el('td', {
        attrs: { colspan: '5' },
        text: message
      })));
    } else {
      result.rows.forEach(function (row) {
        var isOwn = row.basis === 'Site window';
        var tr = SDA.el('tr');
        tr.appendChild(SDA.el('td', {}, [
          SDA.el('span', { class: 'cell-strong', text: row.window.anchorLabel }),
          SDA.el('br'),
          SDA.el('span', { class: 'cell-muted', text: 'Anchor ' + row.window.anchorTime })
        ]));
        tr.appendChild(SDA.el('td', { class: 'cell-strong', text: SDA.slack.offsetLabel(row.window.offsetMin) }));
        tr.appendChild(SDA.el('td', {
          class: isOwn ? 'cell-strong' : 'cell-muted',
          text: row.window.windowLabel
        }));
        tr.appendChild(SDA.el('td', { class: 'num', text: row.window.lengthLabel }));
        tr.appendChild(SDA.el('td', { class: isOwn ? 'cell-strong' : 'cell-muted', text: row.basis }));
        body.appendChild(tr);
      });
    }

    table.appendChild(body);
    wrap.appendChild(table);
    section.appendChild(wrap);

    if (result.own.ok) {
      section.appendChild(SDA.el('p', {
        class: 'table-note',
        text: 'Site window = ' + result.own.anchorLabel.toLowerCase() + ' at ' + result.own.anchorTime +
          ' ' + SDA.slack.offsetLabel(result.own.offsetMin).replace('\u2212', 'minus ').replace('+', 'plus ') +
          ', then the published ' + result.own.windowMinutes + ' min slack length.'
      }));
    }
    return section;
  }

  function nextSection(site) {
    var section = SDA.el('section', { class: 'section' });
    section.appendChild(SDA.el('h2', { class: 'chip', text: 'Next' }));
    section.appendChild(SDA.el('div', { class: 'action-row' }, [
      SDA.el('a', {
        class: 'btn btn--primary',
        href: SDA.briefingUrl(site.id),
        text: 'Dive briefing'
      }),
      SDA.el('a', {
        class: 'btn btn--quiet',
        href: SDA.logUrl(site.id),
        text: 'Log this dive'
      }),
      SDA.el('a', {
        class: 'btn btn--quiet',
        href: './index.html',
        text: 'All wreck sites'
      })
    ]));
    return section;
  }

  function renderWreck(data, site, region) {
    SDA.clear(region);
    region.appendChild(SDA.el('div', { class: 'page-head' }, [
      SDA.el('h1', { text: site.name || site.id }),
      identityLine(site) ? SDA.el('p', { class: 'meta-line', text: identityLine(site) }) : null,
      SDA.el('p', { class: 'lede', text: [site.region, site.country].filter(Boolean).join(', ') +
        (site.sankYear ? ' \u00b7 lost ' + site.sankYear : '') })
    ]));
    region.appendChild(factGrid(site));
    region.appendChild(depthSection(site));
    region.appendChild(historySection(site));
    region.appendChild(slackSection(data, site));
    region.appendChild(nextSection(site));
    document.title = (site.name || site.id) + ' \u00b7 Shipwreck Dive Site Almanac';
  }

  function initWreck() {
    var region = SDA.qs('[data-wreck-region]');
    if (!region) {
      return;
    }
    SDA.withData(region, function (data) {
      var resolved = SDA.resolveSite(data);
      if (!resolved.site) {
        SDA.clear(region);
        region.appendChild(SDA.siteMissingPanel(resolved));
        return;
      }
      renderWreck(data, resolved.site, region);
    }, { skeletonRows: 2, errorTitle: 'This wreck page could not be loaded' });
  }

  SDA.registerPage('wreck', initWreck);
  document.addEventListener('DOMContentLoaded', initWreck);
})();
