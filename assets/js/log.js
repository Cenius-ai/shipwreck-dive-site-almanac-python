/* ==========================================================================
   Shipwreck Dive Site Almanac - dive log
   Sign-in gate, inline validation, create/edit/delete, per-site filter and
   persistence in localStorage under sda.log.v1.
   ========================================================================== */

(function () {
  'use strict';

  var LOG_KEY = 'sda.log.v1';
  var SCHEMA_VERSION = 1;
  var FIELD_ORDER = ['siteId', 'date', 'maxDepthM', 'bottomTimeMin', 'visibilityM', 'waterTempC', 'buddy', 'notes'];

  var state = {
    sites: [],
    entries: [],
    diver: null,
    editingId: null,
    filterSiteId: '',
    submitting: false,
    filterSelect: null,
    inputs: {},
    errors: {},
    submitButton: null,
    cancelButton: null,
    status: null,
    listRegion: null,
    countLine: null,
    formNote: null
  };

  /* ------------------------------------------------------------- storage --- */

  function sanitiseEntry(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return null;
    }
    if (typeof raw.id !== 'string' || !raw.id) {
      return null;
    }
    return {
      id: raw.id,
      siteId: typeof raw.siteId === 'string' ? raw.siteId : '',
      date: typeof raw.date === 'string' ? raw.date : '',
      maxDepthM: SDA.numberOrNull(raw.maxDepthM),
      bottomTimeMin: SDA.numberOrNull(raw.bottomTimeMin),
      visibilityM: SDA.numberOrNull(raw.visibilityM),
      waterTempC: SDA.numberOrNull(raw.waterTempC),
      buddy: typeof raw.buddy === 'string' ? raw.buddy : '',
      notes: typeof raw.notes === 'string' ? raw.notes : ''
    };
  }

  function loadStore() {
    var stored = SDA.readJSON(LOG_KEY);
    var payload = stored.value;
    var entries = [];
    var diver = null;
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      if (Array.isArray(payload.entries)) {
        entries = payload.entries.map(sanitiseEntry).filter(Boolean);
      }
      if (payload.diver && typeof payload.diver === 'object' && !Array.isArray(payload.diver)) {
        diver = {
          name: typeof payload.diver.name === 'string' ? payload.diver.name : '',
          certification: typeof payload.diver.certification === 'string' ? payload.diver.certification : ''
        };
      }
    }
    return { entries: entries, diver: diver, reason: stored.reason };
  }

  function saveStore() {
    return SDA.writeJSON(LOG_KEY, {
      schemaVersion: SCHEMA_VERSION,
      diver: state.diver,
      entries: state.entries
    });
  }

  function newId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      try {
        return window.crypto.randomUUID();
      } catch (error) {
        /* older browsers throw outside a secure context - fall through */
      }
    }
    return 'entry-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  /* --------------------------------------------------------------- helpers - */

  function siteName(siteId) {
    var site = SDA.findSite({ sites: state.sites }, siteId);
    return site ? site.name : 'Site not in the almanac';
  }

  function setStatus(message, positive) {
    if (!state.status) {
      return;
    }
    state.status.textContent = message;
    state.status.classList.toggle('is-positive', Boolean(positive));
  }

  function scrollIntoView(node) {
    if (!node || typeof node.scrollIntoView !== 'function') {
      return;
    }
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    node.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
  }

  /* ----------------------------------------------------------------- form --- */

  function field(options) {
    var id = options.id || 'entry-' + options.name;
    var wrapper = SDA.el('div', { class: 'field' });
    wrapper.appendChild(SDA.el('label', { attrs: { for: id }, text: options.label }));
    var control = options.control;
    control.id = id;
    control.name = options.name;
    wrapper.appendChild(control);
    var describedBy = [];
    if (options.hint) {
      var hintId = id + '-hint';
      wrapper.appendChild(SDA.el('p', { class: 'hint', attrs: { id: hintId }, text: options.hint }));
      describedBy.push(hintId);
    }
    var errorId = 'error-' + options.name;
    wrapper.appendChild(SDA.el('p', { class: 'field-error', attrs: { id: errorId }, text: '' }));
    describedBy.push(errorId);
    control.setAttribute('aria-describedby', describedBy.join(' '));
    state.inputs[options.name] = control;
    return wrapper;
  }

  function numberControl(options) {
    return SDA.el('input', {
      type: 'number',
      attrs: {
        min: options.min,
        max: options.max,
        step: options.step,
        inputmode: 'decimal'
      }
    });
  }

  function buildForm() {
    var siteSelect = SDA.el('select', { attrs: { required: 'required' } });
    siteSelect.appendChild(SDA.el('option', { attrs: { value: '' }, text: 'Choose a site' }));
    state.sites.forEach(function (site) {
      siteSelect.appendChild(SDA.el('option', { attrs: { value: site.id }, text: site.name }));
    });

    var dateInput = SDA.el('input', { type: 'date', attrs: { required: 'required' } });
    dateInput.value = SDA.todayISO();

    var form = SDA.el('form', { class: 'form', attrs: { novalidate: 'novalidate' } });
    var heading = SDA.el('div', { class: 'section-head' }, [
      SDA.el('h2', { text: 'New dive entry' })
    ]);
    state.formNote = SDA.el('p', { class: 'section-meta', text: '' });
    heading.appendChild(state.formNote);
    form.appendChild(heading);
    form.appendChild(SDA.el('p', {
      class: 'form-rules',
      text: 'Site and date are required. Max depth 1\u2013200 m, bottom time 1\u2013300 min, ' +
        'visibility and water temperature cannot be negative, and the date cannot be in the future.'
    }));

    var grid = SDA.el('div', { class: 'form-grid' }, [
      field({ name: 'siteId', id: 'entry-site', label: 'Site', control: siteSelect }),
      field({ name: 'date', id: 'entry-date', label: 'Dive date', control: dateInput }),
      field({
        name: 'maxDepthM',
        id: 'entry-max-depth',
        label: 'Maximum depth (m)',
        control: numberControl({ min: '1', max: '200', step: '0.1' }),
        hint: 'Metres, up to 200.'
      }),
      field({
        name: 'bottomTimeMin',
        id: 'entry-bottom-time',
        label: 'Bottom time (min)',
        control: numberControl({ min: '1', max: '300', step: '1' }),
        hint: 'Minutes, up to 300.'
      }),
      field({
        name: 'visibilityM',
        id: 'entry-visibility',
        label: 'Visibility (m)',
        control: numberControl({ min: '0', max: '60', step: '1' }),
        hint: 'Optional. Cannot be negative.'
      }),
      field({
        name: 'waterTempC',
        id: 'entry-water-temp',
        label: 'Water temperature (\u00b0C)',
        control: numberControl({ min: '0', max: '40', step: '0.5' }),
        hint: 'Optional. Cannot be negative.'
      }),
      field({
        name: 'buddy',
        id: 'entry-buddy',
        label: 'Buddy',
        control: SDA.el('input', { type: 'text', attrs: { maxlength: '60', autocomplete: 'off' } }),
        hint: 'Optional. Who was on your shoulder?'
      }),
      field({
        name: 'notes',
        id: 'entry-notes',
        label: 'Notes',
        control: SDA.el('textarea', { attrs: { rows: '4', maxlength: '600' } }),
        hint: 'Optional. What the dive was like, what to remember for next time.'
      })
    ]);
    form.appendChild(grid);

    state.submitButton = SDA.el('button', { class: 'btn btn--primary', type: 'submit', text: 'Save dive entry' });
    state.cancelButton = SDA.el('button', {
      class: 'btn btn--quiet',
      type: 'button',
      text: 'Cancel edit',
      hidden: true,
      onClick: function () {
        stopEditing();
        setStatus('Edit cancelled. Nothing was changed.', false);
      }
    });
    form.appendChild(SDA.el('div', { class: 'form-actions' }, [
      state.submitButton,
      state.cancelButton
    ]));

    state.status = SDA.el('p', { class: 'status-line', attrs: { role: 'status' }, text: '' });
    form.appendChild(state.status);

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      handleSubmit();
    });

    return form;
  }

  /* ------------------------------------------------------------ validation -- */

  function readValues() {
    var values = {};
    FIELD_ORDER.forEach(function (name) {
      var control = state.inputs[name];
      values[name] = control ? String(control.value) : '';
    });
    values.buddy = values.buddy.trim();
    values.notes = values.notes.trim();
    return values;
  }

  function validate(values) {
    var errors = {};
    if (!values.siteId) {
      errors.siteId = 'Choose the site you dived.';
    }
    if (!values.date) {
      errors.date = 'Enter the date you dived.';
    } else if (values.date > SDA.todayISO()) {
      errors.date = 'The dive date cannot be in the future.';
    }

    var depth = SDA.numberOrNull(values.maxDepthM);
    if (values.maxDepthM === '' || depth === null) {
      errors.maxDepthM = 'Enter the maximum depth in metres.';
    } else if (depth <= 0) {
      errors.maxDepthM = 'Maximum depth must be greater than 0 m.';
    } else if (depth > 200) {
      errors.maxDepthM = 'Maximum depth cannot be more than 200 m.';
    }

    var bottom = SDA.numberOrNull(values.bottomTimeMin);
    if (values.bottomTimeMin === '' || bottom === null) {
      errors.bottomTimeMin = 'Enter the bottom time in minutes.';
    } else if (bottom <= 0) {
      errors.bottomTimeMin = 'Bottom time must be greater than 0 min.';
    } else if (bottom > 300) {
      errors.bottomTimeMin = 'Bottom time cannot be more than 300 min.';
    }

    if (values.visibilityM !== '') {
      var visibility = SDA.numberOrNull(values.visibilityM);
      if (visibility === null) {
        errors.visibilityM = 'Enter visibility as a number of metres.';
      } else if (visibility < 0) {
        errors.visibilityM = 'Visibility cannot be negative.';
      } else if (visibility > 60) {
        errors.visibilityM = 'Visibility above 60 m is not a plausible logged value.';
      }
    }

    if (values.waterTempC !== '') {
      var temperature = SDA.numberOrNull(values.waterTempC);
      if (temperature === null) {
        errors.waterTempC = 'Enter the water temperature as a number.';
      } else if (temperature < 0) {
        errors.waterTempC = 'Water temperature cannot be negative.';
      } else if (temperature > 40) {
        errors.waterTempC = 'Water temperature above 40 \u00b0C is not a plausible logged value.';
      }
    }
    return errors;
  }

  function renderErrors(errors) {
    state.errors = errors;
    FIELD_ORDER.forEach(function (name) {
      var control = state.inputs[name];
      var errorNode = document.getElementById('error-' + name);
      if (!control || !errorNode) {
        return;
      }
      if (errors[name]) {
        control.setAttribute('aria-invalid', 'true');
        errorNode.textContent = errors[name];
        errorNode.classList.add('is-visible');
      } else {
        control.removeAttribute('aria-invalid');
        errorNode.textContent = '';
        errorNode.classList.remove('is-visible');
      }
    });
  }

  function focusFirstError(errors) {
    for (var i = 0; i < FIELD_ORDER.length; i += 1) {
      var name = FIELD_ORDER[i];
      if (errors[name] && state.inputs[name]) {
        state.inputs[name].focus();
        return;
      }
    }
  }

  /* --------------------------------------------------------------- submit --- */

  function handleSubmit() {
    if (state.submitting) {
      return;
    }
    var values = readValues();
    var errors = validate(values);
    renderErrors(errors);
    var invalidNames = Object.keys(errors);
    if (invalidNames.length) {
      focusFirstError(errors);
      setStatus('Nothing was saved: ' + invalidNames.length + ' field' +
        (invalidNames.length === 1 ? ' needs' : 's need') + ' attention.', false);
      return;
    }

    state.submitting = true;
    if (state.submitButton) {
      state.submitButton.disabled = true;
    }

    var entry = {
      id: state.editingId || newId(),
      siteId: values.siteId,
      date: values.date,
      maxDepthM: SDA.numberOrNull(values.maxDepthM),
      bottomTimeMin: SDA.numberOrNull(values.bottomTimeMin),
      visibilityM: SDA.numberOrNull(values.visibilityM),
      waterTempC: SDA.numberOrNull(values.waterTempC),
      buddy: values.buddy,
      notes: values.notes
    };

    var previousEntries = state.entries.slice();
    var wasEditing = Boolean(state.editingId);
    if (wasEditing) {
      state.entries = state.entries.map(function (existing) {
        return existing.id === entry.id ? entry : existing;
      });
    } else {
      state.entries = [entry].concat(state.entries);
    }

    if (!saveStore()) {
      state.entries = previousEntries;
      state.submitting = false;
      if (state.submitButton) {
        state.submitButton.disabled = false;
      }
      setStatus('This browser refused to store the entry, so nothing was saved. Check storage permissions.', false);
      return;
    }

    state.editingId = null;
    state.submitting = false;
    if (state.submitButton) {
      state.submitButton.disabled = false;
    }
    resetForm();
    renderEntries();
    setStatus(wasEditing ? 'Dive entry updated.' : 'Dive entry saved to this browser.', true);
  }

  function resetForm() {
    if (state.inputs.date) {
      state.inputs.date.value = SDA.todayISO();
    }
    ['maxDepthM', 'bottomTimeMin', 'visibilityM', 'waterTempC', 'buddy', 'notes'].forEach(function (name) {
      if (state.inputs[name]) {
        state.inputs[name].value = '';
      }
    });
    if (state.inputs.siteId) {
      state.inputs.siteId.value = state.filterSiteId || '';
    }
    renderErrors({});
    state.editingId = null;
    if (state.submitButton) {
      state.submitButton.textContent = 'Save dive entry';
    }
    if (state.cancelButton) {
      state.cancelButton.hidden = true;
    }
    if (state.formNote) {
      state.formNote.textContent = '';
    }
  }

  function startEditing(entry) {
    state.editingId = entry.id;
    if (state.inputs.siteId) {
      state.inputs.siteId.value = entry.siteId;
    }
    if (state.inputs.date) {
      state.inputs.date.value = entry.date;
    }
    ['maxDepthM', 'bottomTimeMin', 'visibilityM', 'waterTempC'].forEach(function (name) {
      if (state.inputs[name]) {
        state.inputs[name].value = entry[name] === null ? '' : String(entry[name]);
      }
    });
    if (state.inputs.buddy) {
      state.inputs.buddy.value = entry.buddy;
    }
    if (state.inputs.notes) {
      state.inputs.notes.value = entry.notes;
    }
    renderErrors({});
    if (state.submitButton) {
      state.submitButton.textContent = 'Save changes';
    }
    if (state.cancelButton) {
      state.cancelButton.hidden = false;
    }
    if (state.formNote) {
      state.formNote.textContent = 'Editing the dive from ' + SDA.formatShortDate(entry.date) + ' at ' + siteName(entry.siteId);
    }
    if (state.inputs.siteId) {
      state.inputs.siteId.focus();
    }
    scrollIntoView(state.inputs.siteId);
    setStatus('Editing an existing entry. Saving will update it in place.', false);
  }

  function stopEditing() {
    resetForm();
  }

  function deleteEntry(entry) {
    var confirmed = window.confirm(
      'Delete the dive at ' + siteName(entry.siteId) + ' on ' + SDA.formatShortDate(entry.date) +
      '? This cannot be undone.'
    );
    if (!confirmed) {
      setStatus('Delete cancelled. The entry is still in your log.', false);
      return;
    }
    var previousEntries = state.entries.slice();
    state.entries = state.entries.filter(function (existing) {
      return existing.id !== entry.id;
    });
    if (!saveStore()) {
      state.entries = previousEntries;
      setStatus('This browser refused to store the change, so the entry was kept.', false);
      return;
    }
    if (state.editingId === entry.id) {
      resetForm();
    }
    renderEntries();
    setStatus('Dive entry deleted.', true);
  }

  /* ----------------------------------------------------------------- list --- */

  function filteredEntries() {
    var entries = state.filterSiteId
      ? state.entries.filter(function (entry) {
        return entry.siteId === state.filterSiteId;
      })
      : state.entries.slice();
    return entries.sort(function (left, right) {
      if (left.date === right.date) {
        return 0;
      }
      return left.date < right.date ? 1 : -1;
    });
  }

  function renderEntries() {
    if (!state.listRegion) {
      return;
    }
    SDA.clear(state.listRegion);
    var entries = filteredEntries();
    var total = state.entries.length;

    if (state.countLine) {
      state.countLine.textContent = total === 0
        ? 'No entries yet'
        : entries.length + ' of ' + total + ' ' + (total === 1 ? 'entry' : 'entries');
    }

    if (!entries.length) {
      var emptyState = SDA.el('div', { class: 'empty' });
      if (total === 0) {
        emptyState.appendChild(SDA.el('h3', { text: 'No dives logged yet' }));
        emptyState.appendChild(SDA.el('p', {
          text: 'Fill in the form above after your next dive. Entries stay in this browser and survive a reload.'
        }));
      } else {
        emptyState.appendChild(SDA.el('h3', { text: 'No dives at ' + siteName(state.filterSiteId) + ' yet' }));
        emptyState.appendChild(SDA.el('p', {
          text: 'You have ' + total + ' ' + (total === 1 ? 'entry' : 'entries') + ' logged at other sites.'
        }));
        emptyState.appendChild(SDA.el('button', {
          class: 'btn btn--quiet',
          type: 'button',
          text: 'Show all sites',
          onClick: function () {
            setFilter('');
          }
        }));
      }
      state.listRegion.appendChild(emptyState);
      return;
    }

    var wrap = SDA.el('div', { class: 'table-wrap' });
    var table = SDA.el('table', { class: 'data-table data-table--log' });
    table.appendChild(SDA.el('caption', {
      text: 'Logged dives for ' + (state.diver && state.diver.name ? state.diver.name : 'this diver') +
        ' \u00b7 ' + entries.length + ' shown'
    }));
    var headRow = SDA.el('tr');
    ['Date', 'Site', 'Max depth', 'Bottom time', 'Visibility', 'Water temp', 'Buddy', 'Notes', 'Actions']
      .forEach(function (label, index) {
        headRow.appendChild(SDA.el('th', {
          attrs: { scope: 'col' },
          class: index === 2 || index === 3 || index === 4 || index === 5 ? 'num' : '',
          text: label
        }));
      });
    table.appendChild(SDA.el('thead', {}, headRow));

    var body = SDA.el('tbody');
    entries.forEach(function (entry) {
      var tr = SDA.el('tr');
      tr.appendChild(SDA.el('td', { text: SDA.formatShortDate(entry.date) }));
      tr.appendChild(SDA.el('td', { class: 'cell-strong', text: siteName(entry.siteId) }));
      tr.appendChild(SDA.el('td', { class: 'num', text: SDA.metresOrDash(entry.maxDepthM) }));
      tr.appendChild(SDA.el('td', {
        class: 'num',
        text: entry.bottomTimeMin === null ? '\u2014' : SDA.trimNumber(entry.bottomTimeMin) + ' min'
      }));
      tr.appendChild(SDA.el('td', { class: 'num', text: SDA.metresOrDash(entry.visibilityM) }));
      tr.appendChild(SDA.el('td', {
        class: 'num',
        text: entry.waterTempC === null ? '\u2014' : SDA.trimNumber(entry.waterTempC) + ' \u00b0C'
      }));
      tr.appendChild(SDA.el('td', { text: entry.buddy || '\u2014' }));
      tr.appendChild(SDA.el('td', { class: 'cell-muted', text: entry.notes || '\u2014' }));
      tr.appendChild(SDA.el('td', { class: 'no-print' }, SDA.el('div', { class: 'entry-actions' }, [
        SDA.el('button', {
          class: 'btn btn--sm btn--quiet',
          type: 'button',
          text: 'Edit',
          onClick: function () {
            startEditing(entry);
          }
        }),
        SDA.el('button', {
          class: 'btn btn--sm btn--danger',
          type: 'button',
          text: 'Delete',
          onClick: function () {
            deleteEntry(entry);
          }
        })
      ])));
      body.appendChild(tr);
    });
    table.appendChild(body);
    wrap.appendChild(table);
    state.listRegion.appendChild(wrap);
  }

  function setFilter(siteId) {
    state.filterSiteId = siteId;
    if (state.filterSelect) {
      state.filterSelect.value = siteId;
    }
    if (state.inputs.siteId && !state.editingId) {
      state.inputs.siteId.value = siteId;
    }
    var url = siteId ? './log.html?id=' + encodeURIComponent(siteId) : './log.html';
    try {
      window.history.replaceState(null, '', url);
    } catch (error) {
      /* file:// and sandboxed contexts may refuse - the filter still works */
    }
    renderEntries();
  }

  /* --------------------------------------------------------------- render --- */

  function buildDiverHeader() {
    var name = state.diver && state.diver.name ? state.diver.name : 'Diver';
    var certification = state.diver && state.diver.certification ? state.diver.certification : 'Certification not set';
    return SDA.el('div', { class: 'log-header' }, [
      SDA.el('div', {}, [
        SDA.el('p', { class: 'log-header__diver', text: name }),
        SDA.el('p', { class: 'log-header__meta', text: certification + ' \u00b7 local demo logbook' })
      ]),
      SDA.el('div', { class: 'action-row no-print' }, [
        SDA.el('button', {
          class: 'btn btn--quiet',
          type: 'button',
          text: 'Print this log',
          attrs: { 'data-print': 'log' }
        }),
        SDA.el('a', { class: 'btn btn--quiet', href: './index.html', text: 'Back to the catalog' })
      ])
    ]);
  }

  function buildListSection() {
    var section = SDA.el('section', { class: 'section' });
    state.filterSelect = SDA.el('select', { attrs: { 'aria-label': 'Filter the log by site' } });
    state.filterSelect.appendChild(SDA.el('option', { attrs: { value: '' }, text: 'All sites' }));
    state.sites.forEach(function (site) {
      state.filterSelect.appendChild(SDA.el('option', { attrs: { value: site.id }, text: site.name }));
    });
    state.filterSelect.value = state.filterSiteId;
    state.filterSelect.addEventListener('change', function () {
      setFilter(state.filterSelect.value);
    });

    state.countLine = SDA.el('p', { class: 'section-meta', text: '' });
    section.appendChild(SDA.el('div', { class: 'section-head no-print' }, [
      SDA.el('h2', { text: 'Logged dives' }),
      SDA.el('label', { class: 'visually-hidden', attrs: { for: 'log-filter' }, text: 'Filter by site' }),
      state.filterSelect,
      state.countLine
    ]));
    state.filterSelect.id = 'log-filter';
    section.appendChild(SDA.el('div', { class: 'print-only' }, [
      SDA.el('h2', { text: 'Logged dives' })
    ]));
    state.listRegion = SDA.el('div', { class: 'list-region' });
    section.appendChild(state.listRegion);
    return section;
  }

  function renderLog(data) {
    var region = SDA.qs('[data-log-region]');
    if (!region) {
      return;
    }
    SDA.clear(region);

    var stored = loadStore();
    var session = SDA.session.read();
    state.sites = Array.isArray(data.sites) ? data.sites : [];
    state.entries = stored.entries;
    state.diver = session
      ? { name: session.name, certification: session.certification }
      : (stored.diver || { name: '', certification: '' });
    state.editingId = null;

    var requested = SDA.queryParam('id');
    state.filterSiteId = requested && SDA.findSite(data, requested) ? requested : '';

    region.appendChild(buildDiverHeader());
    region.appendChild(buildForm());
    region.appendChild(buildListSection());
    resetForm();
    renderEntries();

    if (stored.reason === 'corrupt') {
      setStatus('The saved log in this browser could not be read, so the logbook opened empty. New entries are stored from now on.', false);
    } else if (!state.entries.length) {
      setStatus('Your logbook is empty. Add your first dive above.', false);
    }
  }

  function initLog() {
    var region = SDA.qs('[data-log-region]');
    if (!region) {
      return;
    }
    if (!SDA.session.read()) {
      SDA.session.redirectToSignIn('required');
      return;
    }
    SDA.withData(region, function (data) {
      renderLog(data);
    }, { skeletonRows: 2, errorTitle: 'The dive log could not be loaded' });
  }

  SDA.registerPage('log', initLog);
  document.addEventListener('DOMContentLoaded', initLog);
})();
