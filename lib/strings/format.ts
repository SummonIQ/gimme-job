export function truncateMiddle(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str; // No need to truncate
  }

  const halfLength = Math.floor((maxLength - 3) / 2); // 3 for "..."
  const start = str.slice(0, halfLength);
  const end = str.slice(-halfLength);

  return `${start}...${end}`;
}

export function formatPhoneNumber(value: string) {
  const cleaned = value.replace(/\D/g, ''); // Remove non-numeric characters
  const match = cleaned.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);

  if (!match) return value;

  return !match[2]
    ? match[1]
    : `(${match[1]}) ${match[2]}${match[3] ? `-${match[3]}` : ''}`;
}

/**
 * Formats email by allowing only valid characters and ensuring correct structure.
 */
export function formatEmail(value: string): string {
  // Remove any spaces.
  let cleaned = value.replace(/\s/g, '');

  // Remove any character not allowed in an email.
  // Allowed: letters, numbers, @, dot, underscore, and hyphen.
  cleaned = cleaned.replace(/[^a-zA-Z0-9@._-]/g, '');

  // Allow only one "@".
  const atIndex = cleaned.indexOf('@');
  if (atIndex !== -1) {
    // Keep everything before the first "@".
    const local = cleaned.slice(0, atIndex);
    // Remove any extra "@" from the remainder.
    let domain = cleaned.slice(atIndex + 1).replace(/@/g, '');

    // Remove leading dots from the domain part.
    while (domain.startsWith('.')) {
      domain = domain.slice(1);
    }

    cleaned = `${local}@${domain}`;
  }

  // Replace consecutive dots with a single dot.
  cleaned = cleaned.replace(/\.{2,}/g, '.');

  // Prevent the email from starting with "@".
  if (cleaned.startsWith('@')) {
    cleaned = '';
  }

  return cleaned;
}

export function formatUrl(value: string): string {
  // Remove leading/trailing whitespace and any spaces inside.
  let cleaned = value.trim().replace(/\s/g, '');
  if (!cleaned) return cleaned;

  let protocol = '';
  let rest = cleaned;

  // If a protocol exists, extract it.
  const protocolMatch = cleaned.match(/^(https?:\/\/)/i);
  if (protocolMatch) {
    protocol = protocolMatch[0];
    rest = cleaned.slice(protocol.length);
  } else {
    // If no protocol, assume https://
    protocol = 'https://';
  }

  // Separate hostname and path (if any)
  let hostname = rest;
  let path = '';
  const slashIndex = rest.indexOf('/');
  if (slashIndex !== -1) {
    hostname = rest.substring(0, slashIndex);
    path = rest.substring(slashIndex);
  }

  // Clean the hostname:
  // 1. Remove any characters that are not letters, digits, hyphen, or dot.
  hostname = hostname.replace(/[^a-zA-Z0-9.-]/g, '');
  // 2. Replace consecutive dots with a single dot.
  hostname = hostname.replace(/\.{2,}/g, '.');
  // 3. Remove any leading dots.
  hostname = hostname.replace(/^\.+/, '');
  // Note: We intentionally do NOT remove a trailing dot, so the user can type something like "example."

  // Reassemble the URL.
  cleaned = protocol + hostname + path;

  // Optionally, if the hostname includes a dot and appears complete, you can run a full URL regex.
  // For incremental input (like "example." or "example.c"), we don't force a match.
  if (hostname.includes('.') && !hostname.endsWith('.')) {
    const urlRegex =
      /^(https?:\/\/)(([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,})(:\d+)?(\/.*)?$/;
    if (!urlRegex.test(cleaned)) {
      // For in-progress input, just return the cleaned value.
      return cleaned;
    }
  }

  return cleaned;
}
