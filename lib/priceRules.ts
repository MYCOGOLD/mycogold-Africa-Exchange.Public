export const BOLLINGER_FLOOR_USD = 3
export const BOLLINGER_FLOOR_KES = 300
export function validatePriceFloor(price: number, currency: 'USD'|'KES' = 'KES') { const floor=currency==='USD'?BOLLINGER_FLOOR_USD:BOLLINGER_FLOOR_KES; return {ok:Number(price)>=floor,floor,currency,message:Number(price)<floor?'Below $3 floor - blocked':null} }
export function formatPrice(price: number, currency='KES') { return `${currency} ${Number(price||0).toFixed(2)}` }
export function formatMFPI(value: number) { return Number(value).toFixed(5) }
