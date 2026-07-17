import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { clipKey, fnv1a32, normalize } from "./key.mjs";

const vectors = ["", "hello", "café", "  two   words  ", "g1|af_heart|n|definition"];
const browserCopy = `(function(){
  function normalize(text){ return String(text).normalize("NFC").trim().replace(/\\s+/g," "); }
  function fnv1a32(input){
    const bytes=new TextEncoder().encode(input); let hash=0x811c9dc5;
    for(const byte of bytes){ hash^=byte; hash=Math.imul(hash,0x01000193)>>>0; }
    return hash.toString(16).padStart(8,"0");
  }
  globalThis.result = { normalize, fnv1a32 };
})()`;
const browser = { TextEncoder, globalThis: null };
browser.globalThis = browser;
runInNewContext(browserCopy, browser);
for (const vector of vectors) {
  assert.equal(browser.result.normalize(vector), normalize(vector));
  assert.equal(browser.result.fnv1a32(vector), fnv1a32(vector));
}
assert.equal(clipKey("definition", false), "63d9c4c2");
assert.equal(clipKey("definition", true), "f4ecf9d3");
console.log(`key vectors passed (${vectors.length}); browser copy matches Node`);
