# Hostname blocklist

Hosts listed here are explicitly NOT eligible for automated submission,
regardless of ATS posture / trust / tier. The safety gate
(`scripts/safety-gate.ts`, P16.1) fails with reason `HOST_BLOCKLISTED`
when `--target=<hostname>` matches any entry below.

## Format

One hostname per bullet. Wildcards are not supported yet — add every
subdomain variant explicitly.

## Entries

- example.blocked.invalid

<!--
Do not remove the bullet above. The safety-gate CLI requires a parseable
entry in this file (it asserts the file exists and contains the
`## Entries` header with a bulleted list). The placeholder makes that
trivial to enforce without committing any real target.
-->
