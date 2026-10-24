/* ==========================================================================
   Shipwreck Dive Site Almanac - local demo session
   A clearly-labelled, browser-only gate that gives the dive log a diver
   identity. Nothing leaves this machine and no real account exists.
   ========================================================================== */

(function () {
  'use strict';

  var SESSION_KEY = 'sda.session.v1';
  var DEMO_PASSPHRASE = 'cenius';
  var DEMO_EMAIL = 'cenius@cenius.ai';
  var DEMO_USERNAME = 'cenius';
  var CERTIFICATIONS = [
    'Open Water',
    'Advanced Open Water',
    'Deep Specialty',
    'Rescue Diver',
    'Divemaster',
    'Technical'
  ];

  function read() {
    var stored = SDA.readJSON(SESSION_KEY);
    var parsed = stored.value;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    var name = typeof parsed.name === 'string' ? parsed.name.trim() : '';
    if (!name) {
      return null;
    }
    return {
      name: name,
      certification: typeof parsed.certification === 'string' && parsed.certification
        ? parsed.certification
        : CERTIFICATIONS[0],
      signedInAt: typeof parsed.signedInAt === 'string' ? parsed.signedInAt : ''
    };
  }

  function write(session) {
    return SDA.writeJSON(SESSION_KEY, {
      name: session.name,
      certification: session.certification,
      signedInAt: session.signedInAt || new Date().toISOString()
    });
  }

  function clear() {
    return SDA.removeKey(SESSION_KEY);
  }

  /* The demo identity is printed on the card; both spellings land on "Cenius". */
  function normaliseName(raw) {
    var name = String(raw || '').trim().replace(/\s+/g, ' ');
    if (/^cenius(@cenius\.ai)?$/i.test(name)) {
      return 'Cenius';
    }
    return name;
  }

  function safeNext(raw) {
    var fallback = './log.html';
    if (typeof raw !== 'string' || !raw) {
      return fallback;
    }
    var value = raw.trim();
    if (!/^\.?\/?(index|wreck|briefing|log|signin)\.html(\?[A-Za-z0-9=&_%.\-]*)?$/.test(value)) {
      return fallback;
    }
    if (value.indexOf('signin.html') !== -1) {
      return fallback;
    }
    return value;
  }

  function redirectToSignIn(reason) {
    var next = './log.html' + window.location.search;
    window.location.replace('./signin.html?next=' + encodeURIComponent(next) + '&reason=' + reason);
  }

  function signOut() {
    clear();
    renderChip();
    if (document.querySelector('[data-page="log"]')) {
      redirectToSignIn('signed-out');
    }
  }

  function renderChip() {
    var slot = SDA.qs('[data-session-slot]');
    if (!slot) {
      return;
    }
    SDA.clear(slot);
    var session = read();
    if (!session) {
      slot.appendChild(SDA.el('a', {
        class: 'session-link',
        href: './signin.html',
        text: 'Sign in to the logbook'
      }));
      return;
    }
    slot.appendChild(SDA.el('div', { class: 'diver-chip' }, [
      SDA.el('p', { class: 'diver-chip__label', text: 'Signed in' }),
      SDA.el('p', { class: 'diver-chip__name', text: session.name }),
      SDA.el('p', { class: 'diver-chip__meta', text: session.certification }),
      SDA.el('button', {
        class: 'btn btn--sm btn--on-dark',
        type: 'button',
        text: 'Sign out',
        onClick: signOut
      })
    ]));
  }

  /* ---------------------------------------------------------- sign-in page - */

  function initSignIn() {
    var form = SDA.qs('[data-signin-form]');
    if (!form) {
      return;
    }

    var next = safeNext(SDA.queryParam('next'));
    var reason = SDA.queryParam('reason');
    var reasonSlot = SDA.qs('[data-signin-reason]');
    if (reasonSlot) {
      if (reason === 'signed-out') {
        reasonSlot.textContent = 'You have been signed out. Sign in again to reopen the dive log.';
        reasonSlot.hidden = false;
      } else if (reason === 'required') {
        reasonSlot.textContent = 'The dive log needs a diver identity before it can be opened.';
        reasonSlot.hidden = false;
      }
    }

    if (read()) {
      window.location.replace(next);
      return;
    }

    var nameInput = SDA.qs('#diver-name', form);
    var passInput = SDA.qs('#diver-passphrase', form);
    var certSelect = SDA.qs('#diver-certification', form);
    var showPass = SDA.qs('#show-passphrase', form);
    var submitButton = SDA.qs('button[type="submit"]', form);
    var errorSlot = SDA.qs('[data-signin-error]', form);
    var submitting = false;

    function showError(message, field) {
      errorSlot.textContent = message;
      errorSlot.classList.add('is-visible');
      if (field) {
        field.setAttribute('aria-invalid', 'true');
        field.focus();
      }
    }

    function clearError() {
      errorSlot.textContent = '';
      errorSlot.classList.remove('is-visible');
      [nameInput, passInput].forEach(function (field) {
        if (field) {
          field.removeAttribute('aria-invalid');
        }
      });
    }

    [nameInput, passInput].forEach(function (field) {
      if (field) {
        field.addEventListener('input', clearError);
      }
    });

    if (showPass && passInput) {
      showPass.addEventListener('change', function () {
        passInput.type = showPass.checked ? 'text' : 'password';
      });
    }

    SDA.qsa('[data-demo-fill]', form).forEach(function (button) {
      button.addEventListener('click', function () {
        if (nameInput) {
          nameInput.value = DEMO_EMAIL;
        }
        if (passInput) {
          passInput.value = DEMO_PASSPHRASE;
        }
        clearError();
        if (typeof form.requestSubmit === 'function') {
          form.requestSubmit();
        } else {
          form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }
      });
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (submitting) {
        return;
      }
      clearError();
      var name = nameInput ? nameInput.value.trim() : '';
      var passphrase = passInput ? passInput.value : '';
      if (!name) {
        showError('Enter the name you want on the logbook.', nameInput);
        return;
      }
      if (!passphrase) {
        showError('Enter the demo passphrase printed on this card.', passInput);
        return;
      }
      if (passphrase !== DEMO_PASSPHRASE) {
        showError('Those details do not match the demo logbook.', passInput);
        return;
      }
      submitting = true;
      if (submitButton) {
        submitButton.disabled = true;
      }
      var saved = write({
        name: normaliseName(name),
        certification: certSelect ? certSelect.value : CERTIFICATIONS[0],
        signedInAt: new Date().toISOString()
      });
      if (!saved) {
        submitting = false;
        if (submitButton) {
          submitButton.disabled = false;
        }
        showError('This browser blocked local storage, so the logbook cannot keep a session.');
        return;
      }
      window.location.assign(next);
    });
  }

  function initSiteCount() {
    var slot = SDA.qs('[data-site-count]');
    if (!slot) {
      return;
    }
    SDA.withData(slot, function (data) {
      SDA.clear(slot);
      var count = Array.isArray(data.sites) ? data.sites.length : 0;
      var reference = data.tideReference && data.tideReference.label
        ? data.tideReference.label
        : 'a static tide reference day';
      slot.appendChild(SDA.el('p', {
        class: 'meta-line',
        text: count + ' wreck sites are published in this almanac, all planned from ' + reference.toLowerCase() + '.'
      }));
    }, { skeletonRows: 1, errorTitle: 'The almanac data could not be loaded' });
  }

  function initSignInPage() {
    renderChip();
    initSignIn();
    initSiteCount();
  }

  SDA.registerPage('signin', initSignInPage);
  document.addEventListener('DOMContentLoaded', initSignInPage);

  SDA.session = {
    key: SESSION_KEY,
    certifications: CERTIFICATIONS,
    demoEmail: DEMO_EMAIL,
    demoUsername: DEMO_USERNAME,
    demoPassphrase: DEMO_PASSPHRASE,
    read: read,
    write: write,
    clear: clear,
    signOut: signOut,
    renderChip: renderChip,
    safeNext: safeNext,
    redirectToSignIn: redirectToSignIn
  };
})();
