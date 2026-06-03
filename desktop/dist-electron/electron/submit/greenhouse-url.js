/**
 * Greenhouse application URL recognizer.
 *
 * Three families of Greenhouse-served URLs:
 *
 *   1. greenhouse.io itself — `boards.greenhouse.io/<co>/jobs/<id>`,
 *      `job-boards.greenhouse.io/<co>/jobs/<id>`.
 *   2. Greenhouse-powered postings hosted on the company's own
 *      domain — e.g. `https://www.coinbase.com/careers/positions/<id>?gh_jid=<id>`,
 *      `https://www.digitalocean.com/careers/position/apply/?gh_jid=<id>`.
 *      The `gh_jid` query param is the Greenhouse Job ID and is the
 *      canonical signal that the underlying ATS is Greenhouse — these
 *      need the Greenhouse runner, not the generic one.
 *   3. `boards-api.greenhouse.io` (API host, not user-facing).
 *
 * P17.28: previously the matcher only caught (1). Random-pick "greenhouse"
 * happily returned (2)-style URLs and they fell through to the generic
 * runner, leading to partial autofill on what the user thought was a
 * Greenhouse posting.
 */
export function isGreenhouseApplicationUrl(url) {
    if (typeof url !== 'string' || url.length === 0)
        return false;
    if (/greenhouse\.io|job-boards\.greenhouse/i.test(url))
        return true;
    // gh_jid as a query / hash param. Anchored on `?` `&` or `#` so bare
    // `gh_jid` substring inside a path can't false-match.
    if (/[?&#]gh_jid=/i.test(url))
        return true;
    return false;
}
