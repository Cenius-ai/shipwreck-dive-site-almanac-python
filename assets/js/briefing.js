/* ==========================================================================
   Shipwreck Dive Site Almanac - dive briefing page
   Hazards, entry and exit, boat traffic, emergency plan, plus the shared
   pre-dive checklist ticked in place for the length of the visit.
   ========================================================================== */

(function () {
  'use strict';

  var ticked = Object.create(null);
  var statusLine = null;
  var checklistItems = [];

  function textSection(chipLabel, title, body, meta) {
    var section = SDA.el('section', { class: 'section' });
    section.appendChild(SDA.el('h2', { class: 'chip', text: chipLabel }));
    var head = SDA.el('div', { class: 'section-head' });
    head.appendChild(SDA.el('h3', { text: title }));
    if (meta) {
      head.appendChild(SDA.el('p', { class: 'section-meta', text: meta }));
    }
    section.appendChild(head);
    var prose = SDA.el('div', { class: 'prose' });
    prose.appendChild(SDA.el('p', { text: body || 'Not published for this site yet.' }));
    section.appendChild(prose);
    return section;
  }

  function hazardSection(site) {
    var hazards = Array.isArray(site.hazards) ? site.hazards.filter(Boolean) : [];
    var section = SDA.el('section', { class: 'section' });
    section.appendChild(SDA.el('h2', { class: 'chip', text: 'Hazards' }));
    if (!hazards.length) {
      section.appendChild(SDA.el('p', { class: 'meta-line', text: 'No hazards are published for this site yet.' }));
      return section;
    }
    var list = SDA.el('ul', { class: 'bullet-list' });
    hazards.forEach(function (hazard) {
      list.appendChild(SDA.el('li', { text: hazard }));
    });
    section.appendChild(list);
    return section;
  }

  function checklistSection(data) {
    var section = SDA.el('section', { class: 'section' });
    section.appendChild(SDA.el('h2', { class: 'chip', text: 'Pre-dive checklist' }));
    var items = Array.isArray(data.checklist) ? data.checklist.slice() : [];
    items.sort(function (left, right) {
      var a = SDA.numberOrNull(left.order);
      var b = SDA.numberOrNull(right.order);
      return (a === null ? 0 : a) - (b === null ? 0 : b);
    });
    checklistItems = items;

    if (!items.length) {
      section.appendChild(SDA.el('p', {
        class: 'meta-line',
        text: 'No checklist items are published in data.json yet.'
      }));
      return section;
    }

    section.appendChild(SDA.el('p', {
      class: 'form-rules',
      text: 'Tick each row as you brief it. Ticks last for this visit only and are not saved.'
    }));

    var list = SDA.el('ul', { class: 'checklist' });
    items.forEach(function (item, index) {
      var id = 'check-' + (item.id || index);
      var checkbox = SDA.el('input', {
        type: 'checkbox',
        id: id,
        checked: Boolean(ticked[item.id])
      });
      var row = SDA.el('label', {
        class: 'check-row' + (ticked[item.id] ? ' is-ticked' : ''),
        attrs: { for: id }
      }, [
        checkbox,
        SDA.el('span', { class: 'check-text', text: item.text || 'Checklist item ' + (index + 1) })
      ]);
      checkbox.addEventListener('change', function () {
        if (checkbox.checked) {
          ticked[item.id] = true;
        } else {
          delete ticked[item.id];
        }
        row.classList.toggle('is-ticked', checkbox.checked);
        updateStatus();
      });
      list.appendChild(SDA.el('li', {}, row));
    });
    section.appendChild(list);

    statusLine = SDA.el('p', { class: 'status-line', attrs: { role: 'status' }, text: '' });
    section.appendChild(statusLine);
    updateStatus();
    return section;
  }

  function updateStatus() {
    if (!statusLine) {
      return;
    }
    var done = checklistItems.filter(function (item) {
      return Boolean(ticked[item.id]);
    }).length;
    statusLine.textContent = done + ' of ' + checklistItems.length + ' pre-dive checks ticked.';
    statusLine.classList.toggle('is-positive', done === checklistItems.length && done > 0);
  }

  function actionsSection(site) {
    var section = SDA.el('section', { class: 'section' });
    section.appendChild(SDA.el('h2', { class: 'chip', text: 'Take it with you' }));
    section.appendChild(SDA.el('div', { class: 'action-row no-print' }, [
      SDA.el('button', {
        class: 'btn btn--primary',
        type: 'button',
        text: 'Print this briefing',
        attrs: { 'data-print': 'briefing' }
      }),
      SDA.el('a', {
        class: 'btn btn--quiet',
        href: SDA.siteUrl(site.id),
        text: 'Back to the wreck'
      }),
      SDA.el('a', {
        class: 'btn btn--quiet',
        href: SDA.logUrl(site.id),
        text: 'Log this dive'
      })
    ]));
    section.appendChild(SDA.el('p', {
      class: 'table-note print-only',
      text: 'Printed from the Shipwreck Dive Site Almanac. Planning aid only, not for navigation.'
    }));
    return section;
  }

  function renderBriefing(data, site, region) {
    SDA.clear(region);
    region.appendChild(SDA.el('div', { class: 'page-head' }, [
      SDA.el('h1', { text: site.name || site.id }),
      SDA.el('p', {
        class: 'meta-line',
        text: 'Dive briefing \u00b7 ' + ([site.region, site.country].filter(Boolean).join(', ') || 'Region not published') +
          (site.certificationRequired ? ' \u00b7 ' + site.certificationRequired : '')
      }),
      SDA.el('p', {
        class: 'lede',
        text: 'Read this on the boat before you kit up. It carries the hazards, the entry and exit plan, ' +
          'the traffic to expect and what to do if the dive goes wrong.'
      })
    ]));
    region.appendChild(hazardSection(site));
    region.appendChild(textSection('Entry and exit', 'Getting in and getting out', site.entryExit));
    region.appendChild(textSection('Boat traffic', 'What else is on the water', site.boatTraffic));
    region.appendChild(textSection('Emergency plan', 'If something goes wrong', site.emergencyPlan));
    region.appendChild(checklistSection(data));
    region.appendChild(actionsSection(site));
    document.title = (site.name || site.id) + ' dive briefing \u00b7 Shipwreck Dive Site Almanac';
  }

  function initBriefing() {
    var region = SDA.qs('[data-briefing-region]');
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
      renderBriefing(data, resolved.site, region);
    }, { skeletonRows: 2, errorTitle: 'This dive briefing could not be loaded' });
  }

  SDA.registerPage('briefing', initBriefing);
  document.addEventListener('DOMContentLoaded', initBriefing);
})();
