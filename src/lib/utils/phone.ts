/**
 * Normalize a phone number to E.164 format.
 * @param raw     - User-entered phone string
 * @param country - Default country code if none provided (e.g. '+91')
 */
export function normalizePhone(raw: string, country = '+91'): string | null {
  let cleaned = raw.replace(/[^\d+]/g, '')

  // Already E.164
  if (cleaned.startsWith('+')) {
    return cleaned.length >= 10 ? cleaned : null
  }

  // Strip leading 0 (Indian STD convention)
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1)
  }

  // 10 digits → add default country code
  if (cleaned.length === 10) {
    return `${country}${cleaned}`
  }

  // 11-15 digits → assume includes country code
  if (cleaned.length >= 11 && cleaned.length <= 15) {
    return `+${cleaned}`
  }

  return null
}
