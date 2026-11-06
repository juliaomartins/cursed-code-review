/**
 * Fake credentials for testing secret detection. They are built from fragments at runtime so the source
 * never contains a credential-shaped literal (secret scanners such as GitGuardian would flag it). None of
 * these are real.
 */
const j = (...parts: string[]) => parts.join("");

export const FAKE = {
  dbPassword: j("pr0d", "-S3", "cret!2026"),
  awsKeyId: j("AKIA", "ABCDEFGH", "IJKLMNOP"),
  stripeLive: j("sk", "_live_", "51HxABCDEFGHijklmnop"),
  generic: j("f3a9c1e8", "b7d24c6a", "9e0f1b2c"),
  github: j("ghp", "_abcdefghijklmnop"),
};
