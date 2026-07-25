import * as OTPAuth from 'otpauth';

/**
 * Generate a new TOTP secret
 */
export const generateSecret = (): string => {
  const secret = new OTPAuth.Secret({ size: 20 });
  return secret.base32;
};

/**
 * Generate a TOTP URI for authenticator apps
 */
export const generateTOTPUri = (secret: string, email: string): string => {
  const totp = new OTPAuth.TOTP({
    issuer: 'p4no',
    label: email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
  return totp.toString();
};

/**
 * Verify a TOTP code against a secret.
 * Allows a window of 1 period (30s) before and after to account for clock skew.
 */
export const verifyTOTP = (token: string, secret: string): boolean => {
  const totp = new OTPAuth.TOTP({
    issuer: 'p4no',
    label: 'user',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
  
  // delta returns null if invalid, or the time step difference
  const delta = totp.validate({ token, window: 1 });
  return delta !== null;
};

/**
 * Format secret key for display (groups of 4)
 */
export const formatSecret = (secret: string): string => {
  return secret.match(/.{1,4}/g)?.join(' ') || secret;
};
