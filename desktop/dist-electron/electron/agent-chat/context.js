export async function collectAssistPageContext({ lastSubmitResult, webContents, }) {
    const rawContext = await readPageContext(webContents);
    const fields = annotateAutofilledFields(sanitizeFields(rawContext.fields), lastSubmitResult);
    const contextWithoutIssues = {
        capturedAt: new Date().toISOString(),
        fields,
        issues: [],
        lastSubmitResult,
        screenshotDataUrl: await captureScreenshotDataUrl(webContents),
        title: rawContext.title ?? webContents.getTitle() ?? '',
        url: rawContext.url ?? webContents.getURL() ?? '',
    };
    return {
        ...contextWithoutIssues,
        issues: derivePageIssues(contextWithoutIssues),
    };
}
export async function highlightAssistPageField(webContents, selector) {
    try {
        return Boolean(await webContents.executeJavaScript(createFieldHighlightScript(selector), true));
    }
    catch {
        return false;
    }
}
async function readPageContext(webContents) {
    try {
        const value = (await webContents.executeJavaScript(PAGE_CONTEXT_SCRIPT, true));
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return {};
        }
        return value;
    }
    catch {
        return {
            title: webContents.getTitle() ?? '',
            url: webContents.getURL() ?? '',
        };
    }
}
async function captureScreenshotDataUrl(webContents) {
    try {
        const image = await webContents.capturePage();
        const size = image.getSize();
        const boundedImage = size.width > 1200
            ? image.resize({
                height: Math.round((1200 / size.width) * size.height),
                width: 1200,
            })
            : image;
        return boundedImage.toDataURL();
    }
    catch {
        return null;
    }
}
function sanitizeFields(fields) {
    if (!Array.isArray(fields)) {
        return [];
    }
    // Drop hidden / fallback `<input type="file">` elements whose label
    // duplicates another field that's already represented as the real
    // input type (tel, email, text, select, etc.). Greenhouse renders
    // these as a fallback path under the same label as the visible
    // typed input, which leaves the State tab showing two rows for the
    // same question — a real "Phone (tel)" + a phantom "Phone (file)".
    // The phantom isn't actionable and shouldn't be surfaced.
    //
    // Important exception: a Resume / CV / Cover Letter file input is the
    // primary attach control — it must survive even when another field
    // (e.g. an "Enter manually" textarea) carries the same label. Keep
    // any file input that is visible (the harvester marks attach buttons
    // visible via isVisibleFileInput) OR whose label clearly names a
    // recognized upload target. Only truly phantom hidden file inputs
    // get dropped.
    const RECOGNIZED_UPLOAD_LABEL = /\b(resume|cv|curriculum\s*vitae|cover\s*letter|portfolio|transcript|writing\s*sample|work\s*sample)\b/i;
    const labelsByNonFile = new Set();
    for (const field of fields) {
        const inputType = typeof field?.inputType === 'string' ? field.inputType.toLowerCase() : '';
        if (inputType === 'file')
            continue;
        const label = typeof field?.label === 'string' ? field.label.trim().toLowerCase() : '';
        if (label)
            labelsByNonFile.add(label);
    }
    const deduped = fields.filter(field => {
        const inputType = typeof field?.inputType === 'string' ? field.inputType.toLowerCase() : '';
        if (inputType !== 'file')
            return true;
        const label = typeof field?.label === 'string' ? field.label.trim() : '';
        if (!label)
            return true;
        if (field?.visible)
            return true;
        if (RECOGNIZED_UPLOAD_LABEL.test(label))
            return true;
        return !labelsByNonFile.has(label.toLowerCase());
    });
    return deduped.slice(0, 120).map(field => ({
        ariaLabel: stringOrNull(field.ariaLabel),
        autocomplete: stringOrNull(field.autocomplete),
        candidateSelectors: Array.isArray(field.candidateSelectors)
            ? field.candidateSelectors.filter(isString).slice(0, 8)
            : [],
        checked: typeof field.checked === 'boolean' || field.checked === null
            ? field.checked
            : null,
        disabled: field.disabled === true,
        id: stringOrNull(field.id),
        inputType: stringOrNull(field.inputType),
        label: stringOrNull(field.label),
        name: stringOrNull(field.name),
        options: Array.isArray(field.options)
            ? field.options.filter(isString).slice(0, 25)
            : [],
        optionValues: Array.isArray(field.optionValues)
            ? field.optionValues.filter(isString).slice(0, 25)
            : undefined,
        placeholder: stringOrNull(field.placeholder),
        required: field.required === true,
        selector: typeof field.selector === 'string' ? field.selector : '',
        shouldAvoid: typeof field.shouldAvoid === 'boolean' ? field.shouldAvoid : undefined,
        tagName: typeof field.tagName === 'string' ? field.tagName : '',
        value: stringOrNull(field.value),
        visible: field.visible !== false,
    }));
}
function annotateAutofilledFields(fields, lastSubmitResult) {
    if (!lastSubmitResult) {
        return fields;
    }
    return fields.map(field => {
        const matchingCall = [...lastSubmitResult.toolCalls]
            .reverse()
            .find(call => call.selector === field.selector);
        if (!matchingCall?.input?.value) {
            return field;
        }
        return {
            ...field,
            wasAutofilled: {
                action: matchingCall.tool,
                ok: matchingCall.ok,
                reason: matchingCall.reason,
                value: matchingCall.input.value,
            },
        };
    });
}
function derivePageIssues(context) {
    const issues = [];
    for (const field of context.fields) {
        if (field.visible &&
            field.required &&
            !field.disabled &&
            !field.shouldAvoid &&
            !field.value?.trim() &&
            field.checked !== false) {
            issues.push({
                fieldSelector: field.selector,
                kind: 'required-empty',
                message: `${field.label ?? field.name ?? field.selector} is required and currently empty.`,
                severity: 'warning',
            });
        }
    }
    const failedCalls = context.lastSubmitResult?.toolCalls.filter(call => !call.ok) ?? [];
    for (const call of failedCalls.slice(-5)) {
        issues.push({
            fieldSelector: call.selector,
            kind: 'tool-error',
            message: `${call.tool} failed${call.reason ? ` while trying to ${call.reason}` : ''}: ${call.errorMessage ?? 'unknown error'}`,
            severity: 'warning',
        });
    }
    return issues.slice(0, 20);
}
function stringOrNull(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}
function isString(value) {
    return typeof value === 'string';
}
function createFieldHighlightScript(selector) {
    return `
(() => {
  const selector = ${JSON.stringify(selector)};
  const element = document.querySelector(selector);
  if (!element) return false;

  const styleId = 'gimme-job-state-highlight-style';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = [
      '.gimme-job-state-highlight {',
      'outline: 3px solid #43d492 !important;',
      'outline-offset: 3px !important;',
      'box-shadow: 0 0 0 6px rgba(67, 212, 146, 0.26) !important;',
      'transition: outline-color 120ms ease, box-shadow 120ms ease !important;',
      '}',
    ].join('');
    document.head.appendChild(style);
  }

  document
    .querySelectorAll('.gimme-job-state-highlight')
    .forEach(node => node.classList.remove('gimme-job-state-highlight'));

  element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
  if (typeof element.focus === 'function') {
    element.focus({ preventScroll: true });
  }
  element.classList.add('gimme-job-state-highlight');

  window.clearTimeout(window.__gimmeJobStateHighlightTimer);
  window.__gimmeJobStateHighlightTimer = window.setTimeout(() => {
    element.classList.remove('gimme-job-state-highlight');
  }, 2200);

  return true;
})()
`;
}
const PAGE_CONTEXT_SCRIPT = `
(() => {
  const FIELD_SELECTOR = [
    'input',
    'textarea',
    'select',
    '[contenteditable="true"]',
    '[role="combobox"]',
    '[role="textbox"]',
    '[role="checkbox"]',
    '[role="radio"]'
  ].join(',');

  const normalize = value =>
    typeof value === 'string' ? value.trim().replace(/\\s+/g, ' ') : '';

  const cssEscape = value => {
    if (window.CSS && typeof window.CSS.escape === 'function') {
      return window.CSS.escape(value);
    }
    return String(value).replace(/["\\\\]/g, '\\\\$&');
  };

  const structuralSelectorFor = element => {
    const tagName = element.tagName.toLowerCase();
    const parent = element.parentElement;
    if (!parent) return tagName;
    const siblings = Array.from(parent.children).filter(
      sibling => sibling.tagName === element.tagName,
    );
    const index = siblings.indexOf(element) + 1;
    return structuralSelectorFor(parent) + ' > ' + tagName + ':nth-of-type(' + index + ')';
  };

  const candidateSelectorsFor = element => {
    const tagName = element.tagName.toLowerCase();
    const candidates = [];
    const seen = new Set();
    const push = value => {
      if (value && !seen.has(value)) {
        seen.add(value);
        candidates.push(value);
      }
    };
    if (element.id) push(tagName + '#' + cssEscape(element.id));
    if (element.getAttribute('name')) {
      push(tagName + '[name="' + cssEscape(element.getAttribute('name')) + '"]');
    }
    if (element.getAttribute('data-testid')) {
      push(
        tagName +
          '[data-testid="' +
          cssEscape(element.getAttribute('data-testid')) +
          '"]',
      );
    }
    if (element.getAttribute('aria-label')) {
      push(
        tagName +
          '[aria-label="' +
          cssEscape(element.getAttribute('aria-label')) +
          '"]',
      );
    }
    if (element.getAttribute('autocomplete')) {
      push(
        tagName +
          '[autocomplete="' +
          cssEscape(element.getAttribute('autocomplete')) +
          '"]',
      );
    }
    if (element.getAttribute('placeholder')) {
      push(
        tagName +
          '[placeholder="' +
          cssEscape(element.getAttribute('placeholder')) +
          '"]',
      );
    }
    push(structuralSelectorFor(element));
    return candidates;
  };

  const selectorFor = element => {
    const candidates = candidateSelectorsFor(element);
    return candidates[0] || structuralSelectorFor(element);
  };

  // Generic action-verb text that file-input parents almost always use.
  // When a file input's nearest <label> resolves to one of these, fall
  // through to the section-heading walk so the label becomes "Resume" or
  // "Cover Letter" instead of just "Attach".
  const GENERIC_ATTACH_LABEL = /^(attach(?:\\s+a\\s+file)?|choose\\s+file|upload(?:\\s+file)?|browse(?:\\s*\\.{3})?|select\\s+file|drag\\s+and\\s+drop)$/i;

  const findAttachmentSectionLabel = element => {
    let scope = element.parentElement;
    for (let depth = 0; depth < 8 && scope; depth += 1) {
      const candidates = Array.from(
        scope.querySelectorAll('label, h1, h2, h3, h4, h5, h6, legend'),
      );
      for (const candidate of candidates) {
        if (candidate.tagName === 'LABEL') {
          const forAttr = candidate.getAttribute('for');
          if (
            forAttr &&
            forAttr !== element.getAttribute('id') &&
            document.getElementById(forAttr) !== element
          ) {
            continue;
          }
        }
        const text = normalize(candidate.textContent ?? '');
        if (!text || GENERIC_ATTACH_LABEL.test(text)) continue;
        if (text.length <= 120) return text;
      }
      scope = scope.parentElement;
    }
    return null;
  };

  const labelFor = element => {
    const isFileInput =
      element instanceof HTMLInputElement && element.type === 'file';

    const id = element.getAttribute('id');
    if (id) {
      const label = document.querySelector('label[for="' + cssEscape(id) + '"]');
      const labelText = normalize(label?.textContent ?? '');
      if (labelText) {
        // Same generic-verb suppression as the parentLabel branch — Greenhouse
        // wires <label for="resume_input">Attach</label> for the file input
        // even though the actual section heading sits in a sibling label.
        if (!isFileInput || !GENERIC_ATTACH_LABEL.test(labelText)) {
          return labelText;
        }
      }
    }

    const ariaLabel = normalize(element.getAttribute('aria-label') ?? '');
    if (ariaLabel && (!isFileInput || !GENERIC_ATTACH_LABEL.test(ariaLabel))) {
      return ariaLabel;
    }

    const labelledBy = element.getAttribute('aria-labelledby');
    if (labelledBy) {
      const text = labelledBy
        .split(/\\s+/)
        .map(idPart => normalize(document.getElementById(idPart)?.textContent ?? ''))
        .filter(Boolean)
        .join(' ');
      if (text && (!isFileInput || !GENERIC_ATTACH_LABEL.test(text))) {
        return text;
      }
    }

    const parentLabel = element.closest('label');
    const parentLabelText = normalize(parentLabel?.textContent ?? '');
    if (parentLabelText) {
      if (!isFileInput || !GENERIC_ATTACH_LABEL.test(parentLabelText)) {
        return parentLabelText;
      }
    }

    if (isFileInput) {
      const sectionLabel = findAttachmentSectionLabel(element);
      if (sectionLabel) return sectionLabel;
      // Last-ditch: derive from name/id. Greenhouse names file inputs
      // job_application[resume] / job_application[cover_letter] /
      // attachments[][file] etc. so we can usually recover the intent.
      const haystack = (
        (element.getAttribute('name') ?? '') +
        ' ' +
        (element.getAttribute('id') ?? '')
      ).toLowerCase();
      if (/cover[\\s_-]*letter/.test(haystack)) return 'Cover Letter';
      if (/(^|[^a-z])(resume|cv|curriculum)([^a-z]|$)/.test(haystack)) {
        return 'Resume';
      }
    }

    const placeholder = normalize(element.getAttribute('placeholder') ?? '');
    if (placeholder) return placeholder;

    let parent = element.parentElement;
    for (let depth = 0; depth < 3 && parent; depth += 1) {
      const directText = Array.from(parent.childNodes)
        .filter(node => node.nodeType === Node.TEXT_NODE)
        .map(node => normalize(node.textContent ?? ''))
        .filter(Boolean)
        .join(' ');
      if (directText && directText.length <= 160) return directText;
      parent = parent.parentElement;
    }

    // Walk up further to find a section heading (Resume/CV, Cover Letter,
    // Voluntary Self-Identification, ...). File inputs in particular often
    // have only a button "Attach" as visible text and rely on the section
    // header to convey what file the form actually wants.
    let scope = element.parentElement;
    for (let depth = 0; depth < 6 && scope; depth += 1) {
      const heading = scope.querySelector('h1, h2, h3, h4, h5, h6, legend');
      if (heading && scope.contains(element)) {
        const headingText = normalize(heading.textContent ?? '');
        if (headingText && headingText.length <= 160) return headingText;
      }
      scope = scope.parentElement;
    }

    return normalize(
      [element.getAttribute('name'), element.getAttribute('id')]
        .filter(Boolean)
        .join(' '),
    ) || null;
  };

  const isVisible = element => {
    if (element.hasAttribute('hidden')) return false;
    if (element.getAttribute('aria-hidden') === 'true') return false;
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    return element.getClientRects().length > 0;
  };

  // <input type="file"> is almost always display:none — the actual UI is a
  // sibling <label> or wrapper button (resume/cover-letter dropzones). Treat
  // such inputs as visible when their label/wrapper is visible, otherwise
  // they get filtered out of the State tab as invisible noise.
  //
  // A file input named or labelled as a recognized upload target
  // (resume / CV / cover letter / portfolio / transcript / etc.) is the
  // primary attach control for the form by definition — surface it
  // regardless of whether its wrapper passes the size heuristic.
  const RECOGNIZED_UPLOAD_PATTERN = /(resume|cv|curriculum|cover[\\s_-]*letter|portfolio|transcript|writing[\\s_-]*sample|work[\\s_-]*sample)/i;
  const isVisibleFileInput = element => {
    if (!(element instanceof HTMLInputElement)) return false;
    if (element.type !== 'file') return false;
    const id = element.getAttribute('id');
    if (id) {
      const label = document.querySelector('label[for="' + cssEscape(id) + '"]');
      if (label && isVisible(label)) return true;
    }
    const parentLabel = element.closest('label, button, [role="button"]');
    if (parentLabel && isVisible(parentLabel)) return true;
    let walker = element.parentElement;
    for (let depth = 0; depth < 5 && walker; depth += 1) {
      if (isVisible(walker)) {
        const rect = walker.getBoundingClientRect();
        if (rect.height >= 24 && rect.width >= 80) return true;
      }
      walker = walker.parentElement;
    }
    // Last-resort: name/id matches a recognized upload target. The form
    // is asking for this file, so the user needs it surfaced even if the
    // physical input + its wrapper are off-screen.
    const haystack =
      (element.getAttribute('name') ?? '') +
      ' ' +
      (element.getAttribute('id') ?? '') +
      ' ' +
      (element.getAttribute('aria-label') ?? '');
    if (RECOGNIZED_UPLOAD_PATTERN.test(haystack)) return true;
    return false;
  };

  const valueFor = element => {
    if (element instanceof HTMLInputElement) {
      if (element.type === 'checkbox' || element.type === 'radio') {
        return element.checked ? element.value || 'checked' : '';
      }
      if (element.type === 'file') {
        return Array.from(element.files ?? []).map(file => file.name).join(', ');
      }
      return element.value;
    }
    if (element instanceof HTMLTextAreaElement) return element.value;
    if (element instanceof HTMLSelectElement) {
      return Array.from(element.selectedOptions)
        .map(option => option.text || option.value)
        .join(', ');
    }
    if (element.getAttribute('contenteditable') === 'true') {
      return element.textContent ?? '';
    }
    return element.getAttribute('aria-valuetext') ?? element.textContent ?? '';
  };

  // Greenhouse / react-select / radix style custom dropdowns render the form
  // value into a plain <input type="text"> sitting next to the visible widget.
  // Without this check the agent treats them like free-text fields and types
  // the answer in instead of opening the listbox and clicking an option.
  const findCustomSelectAncestor = element => {
    let walker = element instanceof Element ? element.parentElement : null;
    for (let depth = 0; depth < 6 && walker; depth += 1) {
      const role = walker.getAttribute && walker.getAttribute('role');
      const ariaHaspopup =
        walker.getAttribute && walker.getAttribute('aria-haspopup');
      const cls = (walker.getAttribute && walker.getAttribute('class')) || '';
      if (
        role === 'combobox' ||
        role === 'listbox' ||
        ariaHaspopup === 'listbox' ||
        ariaHaspopup === 'menu' ||
        /select__control|select-control|combobox|dropdown|listbox/i.test(cls)
      ) {
        return walker;
      }
      walker = walker.parentElement;
    }
    return null;
  };

  const customSelectOptionsFor = element => {
    const ancestor = findCustomSelectAncestor(element);
    if (!ancestor) return [];
    const controls =
      ancestor.getAttribute && ancestor.getAttribute('aria-controls');
    const root = controls
      ? document.getElementById(controls) ?? ancestor
      : ancestor;
    return Array.from(root.querySelectorAll('[role="option"]'))
      .map(option => {
        const label = normalize(option.textContent ?? '');
        const value =
          option.getAttribute('data-value') ??
          option.getAttribute('value') ??
          option.getAttribute('id') ??
          label;
        return { label, value: normalize(value) || label };
      })
      .filter(option => Boolean(option.label))
      .slice(0, 25);
  };

  // A typeahead input is a text input whose suggestions are produced
  // dynamically as the user types (Greenhouse location autocomplete,
  // Algolia Places, etc). Distinguishing a typeahead from a plain
  // react-select Yes-No combobox: the latter wraps the input inside
  // a select-flavoured container (select__control class, or a
  // combobox ancestor with aria-haspopup=listbox), while a bare
  // typeahead exposes role=combobox right on the input with no
  // select container around it.
  const isTypeaheadInput = element => {
    if (!(element instanceof HTMLInputElement)) return false;
    const type = (element.type ?? '').toLowerCase();
    if (!['text', 'search'].includes(type)) return false;

    // react-select / Greenhouse Boards renders a hidden search input
    // inside .select__control with aria-autocomplete="list" — that
    // attribute on its own would otherwise classify the input as a
    // typeahead and we'd skip the customSelect value-reading path,
    // leaving Country / "Are you eligible to work" stuck as empty.
    // A select-flavoured ancestor always wins: it means the input is
    // part of a fixed-option dropdown widget, not a free-form typeahead.
    if (findCustomSelectAncestor(element)) return false;

    const ariaAuto = (element.getAttribute('aria-autocomplete') ?? '').toLowerCase();
    if (ariaAuto === 'list' || ariaAuto === 'both' || ariaAuto === 'inline') {
      return true;
    }

    const role = (element.getAttribute('role') ?? '').toLowerCase();
    if (role === 'combobox') return true;

    // Greenhouse's "Location (City)" Google-Places input is a plain
    // text <input id="candidate-location"> with no aria-autocomplete
    // and no role=combobox — its dropdown is mounted by Google's
    // Places script as the user types. Tag it (and similar Google-
    // Places-flavoured inputs) as a typeahead so the State tab gives
    // the user a real text input + live suggestions instead of a
    // dead "Load options" button.
    const id = (element.id ?? '').toLowerCase();
    const name = (element.getAttribute('name') ?? '').toLowerCase();
    const looksLikeLocation =
      id === 'candidate-location' ||
      id === 'candidate_location' ||
      /(?:^|[\b_-])location(?:[\b_-]|$)/i.test(id) ||
      /location/i.test(name);
    if (looksLikeLocation) {
      // Confirm it's a typeahead by looking for the canonical
      // Greenhouse "Locate me" button rendered next to it. The button
      // text is stable across templates.
      const root = element.closest('label, .field, .form-field, fieldset, div');
      const locateMe = root
        ? Array.from(root.querySelectorAll('button, a')).some(node =>
            /locate\s+me/i.test(node.textContent ?? ''),
          )
        : false;
      if (locateMe) return true;
    }

    return false;
  };

  const isCustomSelectInput = element => {
    if (!(element instanceof HTMLInputElement)) return false;
    const type = (element.type ?? '').toLowerCase();
    if (!['text', 'hidden', 'search'].includes(type)) return false;
    if (isTypeaheadInput(element)) return false;
    return Boolean(findCustomSelectAncestor(element));
  };

  // react-select / Greenhouse renders the chosen option text into
  // .select__single-value (or .select__multi-value__label for multi).
  // The underlying input is the search field and stays empty unless the
  // user is actively typing, so reading element.value would falsely show
  // a filled select as empty in the State tab. EOC questions also show
  // the chosen value in a sibling .select__single-value but use a
  // [role=combobox] button (not an input) — the same scan handles both.
  const customSelectValueFor = element => {
    const ancestor = findCustomSelectAncestor(element) ?? element;
    if (!(ancestor instanceof Element)) return '';
    const single = ancestor.querySelector(
      '.select__single-value, [class*="singleValue"], [class*="single-value"]',
    );
    if (single) {
      const text = normalize(single.textContent ?? '');
      if (text) return text;
    }
    const multi = Array.from(
      ancestor.querySelectorAll(
        '.select__multi-value__label, [class*="multiValue"] [class*="label"], [class*="multi-value"] [class*="label"]',
      ),
    )
      .map(node => normalize(node.textContent ?? ''))
      .filter(Boolean);
    if (multi.length > 0) return multi.join(', ');
    // Button-style comboboxes (Radix / shadcn / GH Boards EOC widgets)
    // keep the chosen text inside the button itself and the placeholder
    // in aria-placeholder / data-placeholder. If the visible text isn't
    // the placeholder, treat it as the selected value.
    if (
      element instanceof HTMLElement &&
      !(element instanceof HTMLInputElement) &&
      !(element instanceof HTMLTextAreaElement)
    ) {
      const own = normalize(element.textContent ?? '');
      const placeholder = normalize(
        element.getAttribute('aria-placeholder') ??
          element.getAttribute('data-placeholder') ??
          '',
      );
      if (own && own !== placeholder) return own;
    }
    return '';
  };

  // Fields the agent must never try to fill: bot-detection sentinels and
  // search inputs inside dropdown widgets / page-search bars. These get
  // surfaced in the State tab so the user can see they were skipped on
  // purpose, not missed.
  const shouldAvoidField = element => {
    if (!(element instanceof Element)) return false;
    const id = element.getAttribute('id') ?? '';
    const name = element.getAttribute('name') ?? '';
    const cls = element.getAttribute('class') ?? '';
    const role = element.getAttribute('role') ?? '';
    if (
      id === 'g-recaptcha-response' ||
      /g-recaptcha-response/.test(name) ||
      /g-recaptcha|h-captcha|cf-turnstile/i.test(cls)
    ) {
      return true;
    }
    if (role === 'searchbox') return true;
    if (
      element instanceof HTMLInputElement &&
      element.type === 'search'
    ) {
      return true;
    }
    return false;
  };

  const matchedElements = new Set(document.querySelectorAll(FIELD_SELECTOR));

  // Greenhouse / react-select widgets pair a visible [role="combobox"] (with
  // the human label) with an off-screen <input> that holds the form value.
  // Both match FIELD_SELECTOR, which is why the panel showed a phantom
  // "html > body:nth-of-type(1) > ..." row beneath each labelled dropdown.
  // Skip the off-screen input when an ancestor is already in the match set.
  const isShadowedByAncestor = element => {
    let walker = element instanceof Element ? element.parentElement : null;
    for (let depth = 0; depth < 8 && walker; depth += 1) {
      if (matchedElements.has(walker)) return true;
      walker = walker.parentElement;
    }
    return false;
  };

  // A field is only useful in the panel if we can name it. When labelFor()
  // can't find anything (no <label for>, no aria-label, no surrounding text),
  // the row falls back to the raw "html > body:nth-of-type(...)" structural
  // selector — which is just noise. Drop those when the field is invisible
  // anyway, since the user can't act on them.
  const isUnlabelledNoise = element => {
    if (!(element instanceof HTMLElement)) return false;
    if (isVisible(element)) return false;
    // File inputs are hidden by design (display:none + a styled button on
    // top). Their wrapper is what's visible. Don't treat them as noise —
    // labelFor + section-heading walk usually finds the upload target,
    // and the panel needs them surfaced so the user can see what the
    // form is asking for.
    if (element instanceof HTMLInputElement && element.type === 'file') {
      return false;
    }
    if (labelFor(element)) return false;
    if (element.id) return false;
    if (element.getAttribute('name')) return false;
    if (element.getAttribute('aria-label')) return false;
    if (element.getAttribute('placeholder')) return false;
    return true;
  };

  // Group sibling checkboxes that belong to the same "Please click all that
  // apply" question into a single virtual field. Walks each checkbox up to
  // find the nearest ancestor that contains two or more checkboxes AND has
  // a question-shaped parent label (h-tag / legend / sibling text ending in
  // "?" or "*"). Returns a Map of checkbox-element → group-key (the shared
  // ancestor element). Checkboxes without a meaningful group are not in the
  // map.
  const checkboxGroupAncestor = element => {
    if (!(element instanceof HTMLInputElement)) return null;
    if (element.type !== 'checkbox') return null;
    let scope = element.parentElement;
    for (let depth = 0; depth < 8 && scope; depth += 1) {
      const checkboxes = scope.querySelectorAll('input[type="checkbox"]');
      if (checkboxes.length >= 2) {
        // Walk siblings looking for a labelled question. Greenhouse uses a
        // <label> sibling with the question text + asterisk, OR a heading.
        const question =
          scope.querySelector('legend, h1, h2, h3, h4, h5, h6') ??
          (() => {
            const labels = scope.querySelectorAll('label');
            for (const label of labels) {
              const forAttr = label.getAttribute && label.getAttribute('for');
              const text = normalize(label.textContent ?? '');
              if (!text || text.length > 200) continue;
              // Skip the per-checkbox labels — those are option labels, not
              // the question. The question label has no for-attribute or
              // points to nothing inside this scopes checkbox set.
              if (forAttr) {
                const target = document.getElementById(forAttr);
                if (target && target.tagName === 'INPUT') continue;
              }
              if (/[?*]/.test(text)) return label;
              if (
                /please\s+(select|click|check|choose)/i.test(text) ||
                /(select|check)\s+(all|any)\s+that\s+apply/i.test(text)
              ) {
                return label;
              }
            }
            return null;
          })();
        if (question) return scope;
      }
      scope = scope.parentElement;
    }
    return null;
  };
  const checkboxGroups = new Map();
  const checkboxGroupKey = new WeakMap();
  for (const element of matchedElements) {
    const ancestor = checkboxGroupAncestor(element);
    if (!ancestor) continue;
    checkboxGroupKey.set(element, ancestor);
    let bucket = checkboxGroups.get(ancestor);
    if (!bucket) {
      bucket = [];
      checkboxGroups.set(ancestor, bucket);
    }
    bucket.push(element);
  }

  const fields = Array.from(matchedElements)
    .filter(element => {
      if (element instanceof HTMLInputElement) {
        // Always drop pure type="hidden" inputs — they're never user-facing.
        if (element.type === 'hidden') return false;
        // Drop invisible value-holder inputs inside custom select widgets;
        // their visible parent already represents the field.
        if (!isVisible(element) && isShadowedByAncestor(element)) return false;
        // Drop individual grouped checkboxes — the group emits a single
        // virtual row below that represents the whole question.
        if (checkboxGroupKey.has(element)) return false;
      }
      // Drop any leftover invisible/unlabelled rows — these are honeypots,
      // sentinels, or framework internals that the user can't fill anyway
      // and would otherwise appear as raw nth-of-type structural rows.
      if (isUnlabelledNoise(element)) return false;
      return true;
    })
    .slice(0, 120)
    .map(element => {
      const candidateSelectors = candidateSelectorsFor(element);
      const typeahead = isTypeaheadInput(element);
      const customSelect = !typeahead && isCustomSelectInput(element);
      const customOptions = customSelect ? customSelectOptionsFor(element) : [];
      const nativeSelectOptions =
        element instanceof HTMLSelectElement
          ? Array.from(element.options).slice(0, 25).map(option => ({
              label: option.text || option.value,
              value: option.value,
            }))
          : [];
      const sourceOptions = nativeSelectOptions.length
        ? nativeSelectOptions
        : customOptions;
      return {
        ariaLabel: normalize(element.getAttribute('aria-label') ?? '') || null,
        autocomplete: normalize(element.getAttribute('autocomplete') ?? '') || null,
        candidateSelectors,
        checked:
          element instanceof HTMLInputElement &&
          (element.type === 'checkbox' || element.type === 'radio')
            ? element.checked
            : null,
        disabled: Boolean(element.disabled || element.getAttribute('aria-disabled') === 'true'),
        id: normalize(element.getAttribute('id') ?? '') || null,
        inputType: customSelect
          ? 'select'
          : element instanceof HTMLInputElement
            ? element.type
            : normalize(element.getAttribute('role') ?? '') || null,
        label: labelFor(element),
        name: normalize(element.getAttribute('name') ?? '') || null,
        options: sourceOptions.map(option => option.label),
        optionValues: sourceOptions.map(option => option.value),
        placeholder: normalize(element.getAttribute('placeholder') ?? '') || null,
        required: Boolean(element.required || element.getAttribute('aria-required') === 'true'),
        selector: candidateSelectors[0] || selectorFor(element),
        shouldAvoid: shouldAvoidField(element),
        tagName: customSelect ? 'select' : element.tagName.toLowerCase(),
        value:
          (customSelect ||
          (!(element instanceof HTMLInputElement) &&
            !(element instanceof HTMLTextAreaElement) &&
            !(element instanceof HTMLSelectElement) &&
            (element.getAttribute('role') ?? '').toLowerCase() === 'combobox')
            ? normalize(customSelectValueFor(element))
            : '') ||
          normalize(valueFor(element)) ||
          null,
        visible: isVisible(element) || isVisibleFileInput(element),
      };
    });

  // Emit one virtual field per checkbox group. Label = the parent question;
  // options = each checkbox's per-item label; optionValues = each checkbox's
  // CSS selector (so the inline editor can target the right one when the
  // user toggles an option). Value = labels of currently-checked items.
  const groupQuestionLabel = scope => {
    const heading = scope.querySelector('legend, h1, h2, h3, h4, h5, h6');
    if (heading) {
      const text = normalize(heading.textContent ?? '');
      if (text) return text;
    }
    const labels = scope.querySelectorAll('label');
    for (const label of labels) {
      const forAttr = label.getAttribute && label.getAttribute('for');
      const text = normalize(label.textContent ?? '');
      if (!text || text.length > 200) continue;
      if (forAttr) {
        const target = document.getElementById(forAttr);
        if (target && target.tagName === 'INPUT') continue;
      }
      if (/[?*]/.test(text)) return text;
    }
    return null;
  };
  const checkboxOptionLabel = checkbox => {
    const id = checkbox.getAttribute('id');
    if (id) {
      const explicit = document.querySelector(
        'label[for="' + cssEscape(id) + '"]',
      );
      const text = normalize(explicit?.textContent ?? '');
      if (text) return text;
    }
    const wrapping = checkbox.closest('label');
    const wrappingText = normalize(wrapping?.textContent ?? '');
    if (wrappingText) return wrappingText;
    return checkbox.value || checkbox.getAttribute('name') || '(option)';
  };
  // Dedupe by question label so the same Greenhouse question (which can
  // resolve to two different ancestor scopes — fieldset + an inner div with
  // a "please click all that apply" label) only emits one virtual row.
  // Prefer scopes with the most visible checkboxes; tiebreak by depth so
  // the deepest matching scope wins (closer to the actual checkbox cluster).
  const normalizeQuestionKey = text =>
    text
      .toLowerCase()
      .replace(/[\\s\\u00a0]+/g, ' ')
      .replace(/[?*:!.,]+/g, '')
      .replace(/\\(required\\)/g, '')
      .trim();
  const groupsByQuestion = new Map();
  for (const [scope, checkboxes] of checkboxGroups) {
    if (checkboxes.length < 2) continue;
    const question = groupQuestionLabel(scope);
    if (!question) continue;
    const key = normalizeQuestionKey(question);
    const visibleCount = checkboxes.filter(isVisible).length;
    let depth = 0;
    let walker = scope.parentElement;
    while (walker) {
      depth += 1;
      walker = walker.parentElement;
    }
    const existing = groupsByQuestion.get(key);
    if (
      !existing ||
      visibleCount > existing.visibleCount ||
      (visibleCount === existing.visibleCount && depth > existing.depth)
    ) {
      groupsByQuestion.set(key, { checkboxes, depth, scope, visibleCount });
    }
  }
  for (const { checkboxes, scope } of groupsByQuestion.values()) {
    const question = groupQuestionLabel(scope);
    if (!question) continue;
    const visibleCheckboxes = checkboxes.filter(isVisible);
    const items = (visibleCheckboxes.length ? visibleCheckboxes : checkboxes).map(
      checkbox => ({
        checked: checkbox.checked === true,
        label: checkboxOptionLabel(checkbox),
        selector: candidateSelectorsFor(checkbox)[0] || selectorFor(checkbox),
      }),
    );
    const checkedLabels = items
      .filter(item => item.checked)
      .map(item => item.label);
    const required = checkboxes.some(
      checkbox =>
        checkbox.required ||
        checkbox.getAttribute('aria-required') === 'true',
    );
    const groupSelector =
      'fieldset_or_group:' +
      (scope.id ? '#' + scope.id : selectorFor(scope));
    fields.push({
      ariaLabel: null,
      autocomplete: null,
      candidateSelectors: items.map(item => item.selector),
      checked: null,
      disabled: false,
      id: scope.id || null,
      inputType: 'checkbox-group',
      label: question,
      name: null,
      options: items.map(item => item.label),
      optionValues: items.map(item => item.selector),
      placeholder: null,
      required,
      selector: groupSelector,
      shouldAvoid: false,
      tagName: 'checkbox-group',
      value: checkedLabels.join(', ') || null,
      visible: items.some(item => item.checked) || items.length > 0,
    });
  }

  return {
    fields,
    title: document.title,
    url: window.location.href,
  };
})()
`;
