import { load } from 'cheerio';
import { NextResponse, type NextRequest } from 'next/server';

import { resolveCanonicalField } from '@/lib/assist-training/field-synonyms';
import { getUserKnowledge } from '@/lib/user/knowledge';
import { getCurrentUser } from '@/lib/user/query';

const MAX_HTML_CHARS = 120000;

interface FieldPlanEntry {
  selector: string;
  label: string;
  fieldType:
    | 'text'
    | 'textarea'
    | 'select'
    | 'radio'
    | 'checkbox'
    | 'file'
    | 'button';
  inputType?: string;
  maxLength?: number;
  required: boolean;
  suggestedValue?: string;
}

/**
 * Analyze the full page once and return an ordered list of all empty fields
 * with suggested values from user knowledge. The client steps through this
 * plan locally without re-calling the API per field.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser({ include: { profile: true } });
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as {
      html?: string;
      url?: string;
    };

    if (!body.html) {
      return NextResponse.json({ error: 'HTML is required' }, { status: 400 });
    }

    const html = body.html.slice(0, MAX_HTML_CHARS);
    const $ = load(html);

    const knowledge = await getUserKnowledge(user.id);
    const profile = user.profile;

    // Build a lookup of known values by field pattern
    const knownValues = buildKnownValues(
      knowledge,
      profile as Record<string, unknown> | null,
      user as unknown as Record<string, unknown>,
    );

    const fieldQuery =
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="image"]):not([type="reset"]):not([type="search"]), textarea, select';

    const isChrome = (el: ReturnType<typeof $>['0']) =>
      $(el).closest(
        'nav, header, footer, [role="navigation"], [role="banner"], [role="contentinfo"]',
      ).length > 0;

    const isSearchField = (el: ReturnType<typeof $>['0']) => {
      const hints = [
        $(el).attr('name') ?? '',
        $(el).attr('placeholder') ?? '',
        $(el).attr('aria-label') ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return /\b(search|find.?jobs?|job.?title|keyword|company|where|what)\b/.test(
        hints,
      );
    };

    const buildSelector = (el: ReturnType<typeof $>['0']): string => {
      const tagName = String($(el).prop('tagName') ?? '').toLowerCase();
      const id = $(el).attr('id');
      const dataTestId = $(el).attr('data-testid');
      const name = $(el).attr('name');
      const ariaLabel = $(el).attr('aria-label');
      const autocomplete = $(el).attr('autocomplete');
      const placeholder = $(el).attr('placeholder');
      const type = $(el).attr('type');

      if (id) return `${tagName}#${id}`;
      if (dataTestId) return `${tagName}[data-testid="${dataTestId}"]`;
      if (name && type) return `${tagName}[name="${name}"][type="${type}"]`;
      if (name) return `${tagName}[name="${name}"]`;
      if (autocomplete && autocomplete !== 'off')
        return `${tagName}[autocomplete="${autocomplete}"]`;
      if (ariaLabel) return `${tagName}[aria-label="${ariaLabel}"]`;
      if (placeholder) return `${tagName}[placeholder="${placeholder}"]`;
      return '';
    };

    const isGenericName = (value: string): boolean =>
      /^(field|input|question|answer|q|item|control)[-_]?\d+$/i.test(value);

    const getLabel = (el: ReturnType<typeof $>['0']): string => {
      const id = $(el).attr('id');
      if (id) {
        const label = $(`label[for="${id}"]`).first().text().trim();
        if (label && !isGenericName(label)) return label;
      }
      const parentLabel = $(el).closest('label').text().trim();
      if (parentLabel && !isGenericName(parentLabel)) return parentLabel;
      const ariaLabel = $(el).attr('aria-label')?.trim();
      if (ariaLabel && !isGenericName(ariaLabel)) return ariaLabel;
      const ariaLabelledBy = $(el).attr('aria-labelledby')?.trim();
      if (ariaLabelledBy) {
        const labelText = ariaLabelledBy
          .split(/\s+/)
          .map(refId => $(`#${refId}`).first().text().trim())
          .filter(Boolean)
          .join(' ');
        if (labelText && !isGenericName(labelText)) return labelText;
      }
      // Walk up ancestors looking for a sibling label/legend/heading with text
      let current = $(el).parent();
      for (let i = 0; i < 4 && current.length > 0; i++) {
        const siblingText = current
          .find(
            'label, legend, .label, [class*="label" i], h1, h2, h3, h4, h5, h6',
          )
          .first()
          .text()
          .trim();
        if (
          siblingText &&
          !isGenericName(siblingText) &&
          siblingText.length < 120
        ) {
          return siblingText;
        }
        current = current.parent();
      }
      const placeholder = $(el).attr('placeholder')?.trim();
      if (placeholder && !isGenericName(placeholder)) return placeholder;
      const name = $(el).attr('name')?.trim();
      if (name && !isGenericName(name)) return name;
      return 'field';
    };

    const isEmpty = (el: ReturnType<typeof $>['0']): boolean => {
      const tagName = String($(el).prop('tagName') ?? '').toLowerCase();
      const type = ($(el).attr('type') ?? 'text').toLowerCase();
      if (type === 'radio' || type === 'checkbox') {
        return !$(el).is('[checked]');
      }
      if (tagName === 'select') {
        const selectedOption = $(el).find('option[selected]');
        const val = selectedOption.attr('value') ?? '';
        return !val || /^select/i.test(val);
      }
      const val = ($(el).attr('value') ?? $(el).text() ?? '').trim();
      return val === '';
    };

    // Honeypot detection — ATS systems sometimes inject invisible fields
    // that flag bots when filled. We never want the trainer or assist
    // runtime touching these.
    const HONEYPOT_NAME_PATTERNS =
      /^(bot[-_ ]?field|honeypot|hp|nickname|website|url|homepage|company_name|fax|email_confirm)$/i;
    const isHoneypot = (el: ReturnType<typeof $>['0']): boolean => {
      const style = ($(el).attr('style') ?? '').toLowerCase();
      if (/display\s*:\s*none/.test(style)) return true;
      if (/visibility\s*:\s*hidden/.test(style)) return true;
      if (/opacity\s*:\s*0\b/.test(style)) return true;
      // Positioned off-screen
      if (/left\s*:\s*-\d{3,}/.test(style)) return true;
      if (/top\s*:\s*-\d{3,}/.test(style)) return true;
      if ($(el).attr('tabindex') === '-1' && $(el).attr('type') !== 'hidden') {
        // tabindex=-1 alone isn't a honeypot signal, but combined with
        // suspicious name patterns it often is.
        const hpName = $(el).attr('name') ?? '';
        if (HONEYPOT_NAME_PATTERNS.test(hpName)) return true;
      }
      if ($(el).attr('aria-hidden') === 'true') return true;
      // Parent walker: a wrapper with display:none / sr-only / screen-reader-only
      const hiddenAncestor = $(el)
        .parents()
        .filter((_, parent) => {
          const cls = $(parent).attr('class') ?? '';
          if (
            /sr[-_]?only|visually[-_]?hidden|screen[-_]?reader[-_]?only/i.test(
              cls,
            )
          ) {
            return true;
          }
          const parentStyle = ($(parent).attr('style') ?? '').toLowerCase();
          return (
            /display\s*:\s*none/.test(parentStyle) ||
            /visibility\s*:\s*hidden/.test(parentStyle)
          );
        });
      if (hiddenAncestor.length > 0) return true;
      // Name pattern with no visible label
      const nameAttr = $(el).attr('name') ?? '';
      if (HONEYPOT_NAME_PATTERNS.test(nameAttr)) {
        const hasVisibleLabel =
          Boolean($(el).attr('aria-label')?.trim()) ||
          ($(el).attr('id') &&
            $(`label[for="${$(el).attr('id')}"]`)
              .text()
              .trim().length > 0);
        if (!hasVisibleLabel) return true;
      }
      return false;
    };

    const seenRadioGroups = new Set<string>();
    const plan: FieldPlanEntry[] = [];

    const allFields = $(fieldQuery)
      .toArray()
      .filter(el => !isChrome(el) && !isSearchField(el));

    for (const el of allFields) {
      const tagName = String($(el).prop('tagName') ?? '').toLowerCase();
      const type = ($(el).attr('type') ?? 'text').toLowerCase();

      // Skip file inputs (resume uploads handled separately)
      if (type === 'file') continue;
      // Skip honeypot fields — filling these marks the user as a bot.
      if (isHoneypot(el)) continue;

      // Group radios — only process first radio per group
      if (type === 'radio') {
        const name = $(el).attr('name') ?? '';
        if (!name || seenRadioGroups.has(name)) continue;
        seenRadioGroups.add(name);
        const anyChecked =
          $(`input[type="radio"][name="${name}"][checked]`).length > 0;
        if (anyChecked) continue;
      } else if (!isEmpty(el)) {
        continue;
      }

      const selector = buildSelector(el);
      if (!selector) continue;

      const label = getLabel(el);
      const maxLengthAttr = $(el).attr('maxlength');
      const maxLength = maxLengthAttr ? parseInt(maxLengthAttr, 10) : undefined;
      const required =
        $(el).is('[required]') || $(el).attr('aria-required') === 'true';

      const fieldType: FieldPlanEntry['fieldType'] =
        tagName === 'select'
          ? 'select'
          : tagName === 'textarea'
            ? 'textarea'
            : type === 'radio'
              ? 'radio'
              : type === 'checkbox'
                ? 'checkbox'
                : 'text';

      // Match against known values
      const suggestedValue = matchKnownValue(
        label,
        type,
        tagName,
        maxLength,
        knownValues,
      );

      plan.push({
        selector,
        label,
        fieldType,
        inputType: tagName === 'input' ? type : undefined,
        maxLength: maxLength && maxLength > 0 ? maxLength : undefined,
        required,
        suggestedValue,
      });
    }

    // Also find submit/continue buttons
    const submitBtn = $(
      'button[type="submit"], input[type="submit"], button:contains("Submit"), button:contains("Apply"), button:contains("Continue"), button:contains("Next")',
    )
      .filter((_, el) => !isChrome(el))
      .first();

    let submitSelector: string | undefined;
    if (submitBtn.length > 0) {
      submitSelector = buildSelector(submitBtn.get(0)!);
    }

    return NextResponse.json({
      fields: plan,
      submitSelector,
      totalEmpty: plan.length,
    });
  } catch (error) {
    console.error('Assist mode field plan error:', error);
    return NextResponse.json(
      { error: 'Failed to generate field plan' },
      { status: 500 },
    );
  }
}

interface KnownValues {
  [pattern: string]: string;
}

function buildKnownValues(
  knowledge: Record<string, string>,
  profile: Record<string, unknown> | null,
  user: Record<string, unknown>,
): KnownValues {
  const values: KnownValues = {};

  // From knowledge
  if (knowledge.fullName) values.fullName = knowledge.fullName;
  if (knowledge.firstName) values.firstName = knowledge.firstName;
  if (knowledge.lastName) values.lastName = knowledge.lastName;
  if (knowledge.email) values.email = knowledge.email;
  if (knowledge.phone) values.phone = knowledge.phone;
  if (knowledge.city) values.city = knowledge.city;
  if (knowledge.state) values.state = knowledge.state;
  if (knowledge.country) values.country = knowledge.country;
  if (knowledge.zipCode) values.zipCode = knowledge.zipCode;
  if (knowledge.streetAddress) values.streetAddress = knowledge.streetAddress;
  if (knowledge.linkedinUrl) values.linkedinUrl = knowledge.linkedinUrl;
  if (knowledge.githubUrl) values.githubUrl = knowledge.githubUrl;
  if (knowledge.websiteUrl) values.websiteUrl = knowledge.websiteUrl;
  if (knowledge.currentCompany)
    values.currentCompany = knowledge.currentCompany;
  if (knowledge.currentTitle) values.currentTitle = knowledge.currentTitle;
  if (knowledge.yearsOfExperience)
    values.yearsOfExperience = knowledge.yearsOfExperience;
  if (knowledge.highestDegree) values.highestDegree = knowledge.highestDegree;
  if (knowledge.university) values.university = knowledge.university;
  if (knowledge.graduationYear)
    values.graduationYear = knowledge.graduationYear;
  if (knowledge.workAuthorization)
    values.workAuthorization = knowledge.workAuthorization;
  if (knowledge.requiresSponsorship)
    values.requiresSponsorship = knowledge.requiresSponsorship;
  if (knowledge.hispanicLatino)
    values.hispanicLatino = knowledge.hispanicLatino;
  if (knowledge.race) values.race = knowledge.race;
  if (knowledge.gender) values.gender = knowledge.gender;
  if (knowledge.veteranStatus) values.veteranStatus = knowledge.veteranStatus;
  if (knowledge.disabilityStatus)
    values.disabilityStatus = knowledge.disabilityStatus;
  if (knowledge.applicationAccountPassword)
    values.password = knowledge.applicationAccountPassword;

  // Fill from profile as fallback
  const p = profile as Record<string, unknown> | null;
  if (p) {
    if (!values.email && typeof p.emailAddress === 'string')
      values.email = p.emailAddress;
    if (!values.phone && typeof p.phoneNumber === 'string')
      values.phone = p.phoneNumber;
    if (!values.firstName && typeof p.firstName === 'string')
      values.firstName = p.firstName;
    if (!values.lastName && typeof p.lastName === 'string')
      values.lastName = p.lastName;
    if (!values.linkedinUrl && typeof p.linkedinUrl === 'string')
      values.linkedinUrl = p.linkedinUrl;
    if (!values.githubUrl && typeof p.githubUrl === 'string')
      values.githubUrl = p.githubUrl;
    if (!values.websiteUrl && typeof p.websiteUrl === 'string')
      values.websiteUrl = p.websiteUrl;
    if (!values.workAuthorization && typeof p.workAuthorization === 'string') {
      values.workAuthorization = p.workAuthorization;
    }
    if (
      !values.requiresSponsorship &&
      typeof p.requiresSponsorship === 'boolean'
    ) {
      values.requiresSponsorship = p.requiresSponsorship ? 'Yes' : 'No';
    }
    if (!values.race && typeof p.race === 'string') values.race = p.race;
    if (!values.gender && typeof p.gender === 'string')
      values.gender = p.gender;
    if (!values.veteranStatus && typeof p.veteranStatus === 'string')
      values.veteranStatus = p.veteranStatus;
    if (!values.disabilityStatus && typeof p.disabilityStatus === 'string')
      values.disabilityStatus = p.disabilityStatus;
  }

  // Fill from user record as fallback
  if (!values.email && user.email) values.email = user.email as string;
  if (!values.fullName && user.name) values.fullName = user.name as string;
  if (!values.country) values.country = 'United States';
  if (!values.password) values.password = 'GimmeJob23!';

  return values;
}

function matchKnownValue(
  label: string,
  inputType: string,
  tagName: string,
  maxLength: number | undefined,
  known: KnownValues,
): string | undefined {
  const l = label.toLowerCase();
  const isSelect = tagName === 'select';
  const isShort = maxLength != null && maxLength <= 5;

  // Fast-path: canonical field matching catches "Given Name", "Legal
  // First Name", "Applicant First Name", and ~200 other synonyms
  // without needing regex for each one.
  const canonical = resolveCanonicalField(label);
  if (canonical) {
    const canonicalMap: Record<string, string | undefined> = {
      first_name: known.firstName,
      last_name: known.lastName,
      full_name: known.fullName,
      email: known.email,
      phone: known.phone,
      location:
        known.city && known.state
          ? `${known.city}, ${known.state}`
          : known.city,
      state: known.state,
      zip: known.zipCode,
      country:
        (isSelect || isShort) &&
        (known.country ?? 'United States') === 'United States'
          ? 'US'
          : known.country,
      linkedin: known.linkedinUrl,
      website: known.websiteUrl,
      github: known.githubUrl,
    };
    const matched = canonicalMap[canonical];
    if (matched) return matched;
  }

  // Password
  if (/\b(password|passcode)\b/.test(l) && inputType === 'password') {
    return known.password;
  }

  // Email
  if (/\b(email|e-mail)\b/.test(l)) {
    return known.email;
  }

  // Phone
  if (/\b(phone|telephone|mobile|cell)\b/.test(l)) {
    return known.phone;
  }

  // Name fields
  if (/\bfirst\s*name\b/.test(l)) return known.firstName;
  if (/\blast\s*name\b/.test(l) || /\bsurname\b/.test(l)) return known.lastName;
  if (/\bfull\s*name\b/.test(l) || (l === 'name' && !l.includes('company'))) {
    return known.fullName;
  }

  // Location
  if (/\bcountry\b/.test(l)) {
    const country = known.country ?? 'United States';
    return (isSelect || isShort) && country === 'United States'
      ? 'US'
      : country;
  }
  if (/\bcity\b/.test(l) && !/\bcity.*state\b/.test(l)) return known.city;
  if (/\bstate\b/.test(l) || /\bprovince\b/.test(l)) return known.state;
  if (/\bzip\b/.test(l) || /\bpostal\b/.test(l)) return known.zipCode;
  if (/\bstreet\b/.test(l) || /\baddress\s*(line)?\s*1?\b/.test(l)) {
    return known.streetAddress;
  }

  // URLs
  if (/\blinkedin\b/.test(l)) return known.linkedinUrl;
  if (/\bgithub\b/.test(l)) return known.githubUrl;
  if (/\b(website|portfolio|personal\s*url)\b/.test(l)) return known.websiteUrl;

  // Professional
  if (/\bcurrent\s*(company|employer)\b/.test(l)) return known.currentCompany;
  if (/\bcurrent\s*(title|role|position)\b/.test(l)) return known.currentTitle;
  if (/\byears?\s*(of)?\s*experience\b/.test(l)) return known.yearsOfExperience;

  // Education
  if (/\b(degree|education\s*level)\b/.test(l)) return known.highestDegree;
  if (/\b(university|school|college|institution)\b/.test(l))
    return known.university;
  if (/\bgraduat(ion|ed)\s*(year|date)\b/.test(l)) return known.graduationYear;

  // Authorization
  if (/\bsponsorship\b/.test(l)) return known.requiresSponsorship;
  if (
    /\b(work\s*authorization|authorized\s*to\s*work|able\s*to\s*work|legally\s*authorized)\b/.test(
      l,
    )
  ) {
    return known.workAuthorization;
  }

  // Equal employment opportunity
  if (/\bhispanic|latino|latina|latinx\b/.test(l)) return known.hispanicLatino;
  if (/\bgender|sex\b/.test(l)) return known.gender;
  if (/\bdisability|disabled\b/.test(l)) return known.disabilityStatus;
  if (/\bveteran|military\b/.test(l)) return known.veteranStatus;
  if (/\brace|ethnicity|ethnic\b/.test(l)) return known.race;

  return undefined;
}

export { buildKnownValues, matchKnownValue };
