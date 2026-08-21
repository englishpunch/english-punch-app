import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const TARGET_SECTIONS = new Set(["frontend", "mcp"]);

export const updateEnglishPunchValues = (content, imageTag) => {
  if (!/^sha-[0-9a-f]{7,40}$/.test(imageTag)) {
    throw new Error(`Invalid image tag: ${imageTag}`);
  }

  const updatedTags = new Set();
  let enabledMcp = false;
  let currentSection = null;
  let inImage = false;

  const lines = content.split("\n").map((originalLine) => {
    let line = originalLine;
    const stripped = line.trim();
    const indent = line.length - line.trimStart().length;

    if (stripped.endsWith(":") && indent === 0) {
      currentSection = stripped.slice(0, -1);
      inImage = false;
    } else if (TARGET_SECTIONS.has(currentSection) && indent === 2) {
      inImage = stripped === "image:";
      if (currentSection === "mcp" && stripped.startsWith("enabled:")) {
        line = "  enabled: true";
        enabledMcp = true;
      }
    } else if (
      TARGET_SECTIONS.has(currentSection) &&
      inImage &&
      indent === 4 &&
      stripped.startsWith("tag:")
    ) {
      line = `    tag: ${imageTag}`;
      updatedTags.add(currentSection);
    }

    return line;
  });

  const missingSections = [...TARGET_SECTIONS].filter(
    (section) => !updatedTags.has(section)
  );
  if (missingSections.length > 0) {
    throw new Error(
      `Image tag fields not found for: ${missingSections.join(", ")}`
    );
  }
  if (!enabledMcp) {
    throw new Error("mcp.enabled not found");
  }

  return lines.join("\n");
};

const isCli =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCli) {
  const [, , valuesPath, imageTag] = process.argv;
  if (!valuesPath || !imageTag) {
    throw new Error(
      "Usage: update-infra-images.mjs <values.yaml path> <sha-image-tag>"
    );
  }
  const content = readFileSync(valuesPath, "utf8");
  writeFileSync(valuesPath, updateEnglishPunchValues(content, imageTag));
}
