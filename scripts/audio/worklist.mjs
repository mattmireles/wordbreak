import { AUDIO_GEN, AUDIO_SPEEDS, AUDIO_VOICE, clipKey, normalize } from "./key.mjs";
import { extractRuntime } from "../runtime-data.mjs";

export function buildAudioWorklist(root) {
  const { units, assessment, helpers } = extractRuntime(root);
  if (!Array.isArray(units) || !units.length) throw new Error("UNITS extraction returned no units");
  const core = units.filter((unit) => !helpers.isPackUnit(unit));
  const pack = units.filter(helpers.isPackUnit);
  const coreWords = core.reduce((sum, unit) => sum + unit.words.length, 0);
  const packWords = pack.reduce((sum, unit) => sum + unit.words.length, 0);
  const coreWitnesses = core.reduce((sum, unit) => sum + unit.words.filter((word) =>
    word.fork?.items?.some((item) => item.role === "witness")).length, 0);
  if (core.length !== 48 || coreWords !== 192 || coreWitnesses !== 4) {
    throw new Error(`Unexpected core shape: ${core.length} units, ${coreWords} words, ${coreWitnesses} witnesses`);
  }
  if (![0, 4].includes(pack.length) || (pack.length && packWords !== 16)) {
    throw new Error(`Unexpected field-pack shape: ${pack.length} units, ${packWords} words`);
  }
  if (assessment.version !== 2 || assessment.A.length !== 24 || assessment.B.length !== 24) {
    throw new Error("Unexpected assessment form shape");
  }

  const texts = new Map();
  for (const unit of units) {
    for (const word of unit.words) {
      texts.set(normalize(word.a), { text: normalize(word.a), ...(helpers.isPackUnit(unit) ? { kind: "field_pack" } : {}) });
      for (const item of word.fork?.items || []) {
        if (item.role === "witness") texts.set(normalize(item.w), {
          text: normalize(item.w),
          fallbackText: item.sayAs || undefined,
          ...(helpers.isPackUnit(unit) ? { kind: "field_pack" } : {}),
        });
      }
    }
  }
  for (const item of [...assessment.A, ...assessment.B]) {
    texts.set(normalize(item.audioText), { text: normalize(item.audioText), kind: "assessment", itemId: item.id });
  }

  const clips = [];
  const keys = new Map();
  for (const entry of texts.values()) {
    for (const { speed, speedTag } of AUDIO_SPEEDS) {
      const key = clipKey(entry.text, speedTag === "s");
      const file = `${key}.mp3`;
      if (keys.has(key)) throw new Error(`Audio key collision: ${key} (${entry.text} / ${keys.get(key)})`);
      keys.set(key, entry.text);
      clips.push({ key, file, text: entry.text, ...(entry.fallbackText ? { fallbackText: entry.fallbackText } : {}),
        ...(entry.kind ? { kind: entry.kind } : {}), ...(entry.itemId ? { itemId: entry.itemId } : {}), speed, speedTag });
    }
  }
  return {
    manifest: { gen: AUDIO_GEN, voice: AUDIO_VOICE, generatedFrom: "wordbreak_v2.html", clips },
    runtimeFiles: clips.map((clip) => clip.file),
    stats: { coreUnits: core.length, coreWords, packUnits: pack.length, packWords, coreWitnesses,
      clips: clips.length, uniqueTexts: texts.size, assessmentItems: assessment.A.length + assessment.B.length },
  };
}
