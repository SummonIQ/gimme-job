const REPORT_PREFIX = '__GIMMEJOB_USER_ACTION_REPORT__:';
export const USER_ACTION_REPORT_PREFIX = REPORT_PREFIX;
const TRACKER_SCRIPT = `
(function () {
  if (window.__gimmeJobActionTracker) {
    window.__gimmeJobActionTracker.reset();
    return;
  }

  function fieldId(el) {
    return (
      el.name ||
      el.id ||
      el.getAttribute('aria-label') ||
      el.getAttribute('data-qa') ||
      (el.outerHTML || '').slice(0, 80)
    );
  }

  function fieldLabel(el) {
    if (el.labels && el.labels.length > 0) {
      return (el.labels[0].textContent || '').trim();
    }
    var aria = el.getAttribute('aria-label');
    if (aria) return aria.trim();
    var ph = el.getAttribute('placeholder');
    if (ph) return ph.trim();
    return el.name || el.id || '';
  }

  function fieldValue(el) {
    if (el.type === 'checkbox' || el.type === 'radio') {
      return el.checked ? (el.value || 'on') : '';
    }
    if (el.tagName === 'SELECT') {
      var opt = el.options[el.selectedIndex];
      return opt ? (opt.textContent || opt.value || '').trim() : '';
    }
    return el.value || '';
  }

  function snapshot() {
    var out = {};
    document
      .querySelectorAll('input, textarea, select')
      .forEach(function (el) {
        if (el.type === 'hidden' || el.disabled) return;
        var id = fieldId(el);
        if (!id) return;
        out[id] = {
          id: id,
          label: fieldLabel(el),
          type: el.type || el.tagName.toLowerCase(),
          value: fieldValue(el),
        };
      });
    return out;
  }

  var state = {
    baseline: snapshot(),
    final: null,
  };

  function captureFinal() {
    state.final = snapshot();
  }

  function report(trigger) {
    captureFinal();
    var baseline = state.baseline || {};
    var final = state.final || {};
    var aiBaseline = [];
    var unchangedFields = [];
    var userChangedFields = [];
    var userFilledFields = [];
    var emptyFields = [];

    Object.keys(baseline).forEach(function (id) {
      var b = baseline[id];
      aiBaseline.push(b);
      var f = final[id];
      var aiHadValue = b.value && b.value.length > 0;
      var finalValue = f ? f.value : '';
      if (aiHadValue && finalValue === b.value) unchangedFields.push(b);
      else if (aiHadValue && finalValue !== b.value)
        userChangedFields.push({
          aiValue: b.value,
          id: b.id,
          label: b.label,
          type: b.type,
          userValue: finalValue,
        });
    });

    Object.keys(final).forEach(function (id) {
      var f = final[id];
      var b = baseline[id];
      var aiHadValue = b && b.value && b.value.length > 0;
      var finalValue = f.value || '';
      if (!aiHadValue && finalValue.length > 0) userFilledFields.push(f);
      if (!aiHadValue && finalValue.length === 0) emptyFields.push(f);
    });

    var payload = {
      aiBaseline: aiBaseline,
      capturedAt: new Date().toISOString(),
      emptyFields: emptyFields,
      trigger: trigger,
      unchangedFields: unchangedFields,
      url: location.href,
      userChangedFields: userChangedFields,
      userFilledFields: userFilledFields,
    };
    console.log(${JSON.stringify(REPORT_PREFIX)} + JSON.stringify(payload));
  }

  function isSubmitButton(el) {
    if (!el) return false;
    if (el.type === 'submit') return true;
    var text = (el.textContent || '').trim().toLowerCase();
    return /^(submit|apply|send application|continue)$/.test(text);
  }

  document.addEventListener(
    'submit',
    function () {
      report('submit');
    },
    true,
  );

  document.addEventListener(
    'click',
    function (event) {
      var target = event.target;
      while (target && target !== document) {
        if (isSubmitButton(target)) {
          setTimeout(function () {
            report('submit');
          }, 50);
          return;
        }
        target = target.parentElement;
      }
    },
    true,
  );

  window.__gimmeJobActionTracker = {
    reset: function () {
      state = { baseline: snapshot(), final: null };
    },
    snapshot: snapshot,
    report: report,
  };
})();
`;
export async function injectUserActionTracker(webContents) {
    try {
        await webContents.executeJavaScript(TRACKER_SCRIPT, true);
    }
    catch (error) {
        console.warn('Failed to inject user action tracker:', error);
    }
}
export function parseUserActionReport(message) {
    if (!message.startsWith(REPORT_PREFIX))
        return null;
    const json = message.slice(REPORT_PREFIX.length);
    try {
        return JSON.parse(json);
    }
    catch (error) {
        console.warn('Failed to parse user action report:', error);
        return null;
    }
}
