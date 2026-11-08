export const BASE_MFPI = 99.06654
export const BASE_WEIGHTED_PRICE = 52.00
export type ConfirmedTrade = { id: string; listingId: string; price: number; kg: number; confirmed_at: string }
export function weightedPriceFromTrades(confirmedTrades: ConfirmedTrade[]): number | null { if(!confirmedTrades.length)return null;const totalKg=confirmedTrades.reduce((sum,trade)=>sum+Number(trade.kg),0);if(!totalKg)return null;return confirmedTrades.reduce((sum,trade)=>sum+Number(trade.price)*Number(trade.kg),0)/totalKg }
export function calculateMFPI(confirmedTrades: ConfirmedTrade[]){const tick=confirmedTrades.length;if(!tick)return {mfpi:BASE_MFPI,weighted:null,tick:0,isGenesis:true};const weighted=weightedPriceFromTrades(confirmedTrades)!;return {mfpi:BASE_MFPI+((weighted-BASE_WEIGHTED_PRICE)/BASE_WEIGHTED_PRICE*100),weighted,tick,isGenesis:false}}
export function mineBlock(prevHash:string,trade:ConfirmedTrade,mfpi:number,index=1){const raw=`${prevHash}|${trade.id}|${mfpi}|${trade.confirmed_at}`;let hash='';for(let index=0;index<raw.length;index+=1)hash+=raw.charCodeAt(index).toString(16);return {index,hash:hash.slice(0,16),prevHash,mfpi,activitiesCount:1,tradeId:trade.id,listingId:trade.listingId,confirmed_at:trade.confirmed_at}}
export const GENESIS_BLOCK={index:0,hash:'GENESIS-99.06654',prevHash:'',mfpi:BASE_MFPI,activitiesCount:0,confirmed_at:new Date(0).toISOString()}
export type LedgerBlock=ReturnType<typeof mineBlock>|typeof GENESIS_BLOCK
