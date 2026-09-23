import { generateMFPI_Tick } from "../../MYCOGOLD.PVT/cprng-engine/index.js";

console.log("MYCOGOLD MFPI LIVE - Base 100 KES | Anchor 129 | Tick 1s");
let last = 100;
setInterval(() => {
  const realChange = (Math.random() - 0.5) * 0.3;
  const newPrice = generateMFPI_Tick(realChange);
  const dir = newPrice > last ? "UP" : "DOWN";
  console.log(`${dir} - Price: ${newPrice} KES | Diff: ${(newPrice-last).toFixed(4)} | ${new Date().toLocaleTimeString()}`);
  last = newPrice;
}, 1000);
