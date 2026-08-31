const lastAction = new Map();
function waitForSlot(key, intervalMs = 3000) {
  const now=Date.now(); const previous=lastAction.get(key)||0; const wait=Math.max(0,previous+intervalMs-now); lastAction.set(key,now+wait);
  return wait;
}
function reset(){lastAction.clear();}
module.exports={waitForSlot,reset};
