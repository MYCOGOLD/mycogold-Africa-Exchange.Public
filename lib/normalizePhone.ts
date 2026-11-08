export function normalizePhone(value: string | null | undefined = '') {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.startsWith('254')) return `+${digits}`
  if (digits.startsWith('0')) return `+254${digits.slice(1)}`
  if (digits.startsWith('7') && digits.length === 9) return `+254${digits}`
  return digits ? `+${digits}` : ''
}
export function maskPhone(value: string | null | undefined = '') { const phone = normalizePhone(value); return phone.length > 5 ? `*** *** ${phone.slice(-3)}` : 'Phone on file' }
export function firstName(value = '') { return value.trim().split(/\s+/)[0] || 'Trader' }
export function phoneToEmail(value = '') { return `${normalizePhone(value).replace(/\D/g, '')}@mycogold.africa` }
export function normalizeForCompare(value = '') { return normalizePhone(value).replace(/\D/g, '') }
