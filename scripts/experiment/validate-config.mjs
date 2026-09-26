#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";

const configPath = resolve(process.argv[2] || "experiment/config/experiment.v1.json");
const schemaPath = resolve("experiment/schemas/experiment-config.schema.json");
const parse = (path) => JSON.parse(readFileSync(path, "utf8"));
const schema = parse(schemaPath);
const config = parse(configPath);
const ajv = new Ajv2020({ allErrors: true, strict: true });
if (!ajv.validateSchema(schema)) {
  console.error(ajv.errorsText(ajv.errors, { separator: "\n" }));
  process.exit(1);
}
const validate = ajv.compile(schema);
if (!validate(config)) {
  console.error(ajv.errorsText(validate.errors, { separator: "\n" }));
  process.exit(1);
}
const flags = config.featureFlags;
if (config.mode === "OBSERVE" && (flags.agentWrite || flags.automatedInstall)) {
  throw new Error("OBSERVE cannot enable agent writes or automated installation");
}
if (!flags.agentWrite && flags.automatedInstall) {
  throw new Error("automatedInstall requires agentWrite");
}
if (!flags.capture && flags.upload) throw new Error("upload requires capture");
if (!flags.upload && flags.analysis) throw new Error("analysis requires upload");
console.log(`Validated experiment config ${config.experimentId}@${config.configVersion} (${config.mode}).`);

