// @ts-check

/**
 * @typedef {{
 *   student_external_ref: string;
 *   login_code: string;
 *   qr_secret_hash?: string;
 * }} LoginCardCredential
 */

/**
 * @param {LoginCardCredential} credential
 * @param {string} currentOrigin
 * @param {string | undefined} configuredOrigin
 */
export function loginCardURL(credential, currentOrigin, configuredOrigin) {
  const params = new URLSearchParams({ pupil: credential.student_external_ref, code: credential.login_code || "" });
  if (credential.qr_secret_hash) params.set("card", credential.qr_secret_hash);
  const appOrigin = validHTTPOrigin(configuredOrigin) || validHTTPOrigin(currentOrigin);
  if (!appOrigin) return "";
  return `${appOrigin}/login?${params.toString()}`;
}

/** @param {string | undefined} candidate */
function validHTTPOrigin(candidate) {
  if (!candidate) return "";
  try {
    const parsed = new URL(candidate);
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) return "";
    return parsed.origin;
  } catch {
    return "";
  }
}
