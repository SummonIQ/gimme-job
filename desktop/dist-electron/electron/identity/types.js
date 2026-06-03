/**
 * P5.6 - identity-store type surface.
 *
 * The `IdentityStore` is the ONE place identity values enter the desktop
 * runtime. Everything else (the `identity_load` tool, the fill-field
 * driver, prompt-trace serialization) goes through it. Raw values never
 * pass through AI prompts; the store returns a value by logical key only.
 */
export {};
