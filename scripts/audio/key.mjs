export const AUDIO_GEN = "g1";
export const AUDIO_VOICE = "af_heart";
export const AUDIO_SPEEDS = [
  { speed: 1.0, speedTag: "n" },
  { speed: 0.7, speedTag: "s" },
];

export function normalize(text) {
  return String(text).normalize("NFC").trim().replace(/\s+/g, " ");
}

// Keep this byte-for-byte identical to the inline client copy in wordbreak_v2.html.
export function fnv1a32(input) {
  const bytes = new TextEncoder().encode(input);
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function clipKey(text, slow) {
  const speedTag = slow ? "s" : "n";
  return fnv1a32([AUDIO_GEN, AUDIO_VOICE, speedTag, normalize(text)].join("|"));
}
