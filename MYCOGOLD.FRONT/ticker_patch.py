import json
# Update quant_core_essential to have proper mapping for UI
path="MYCOGOLD.FRONT/quant_core_essential.json"
try:
  with open(path) as f: j=json.load(f)
  j["ui_fix"]="Product sits respective on price - column layout centered - floor/premium highlighted"
  j["layout"]="flex-direction: column; align-items:center; product on top, price bottom"
  with open(path,"w") as f: json.dump(j,f,indent=2)
  print("patched essential")
except: print("no essential yet")
