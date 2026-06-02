import { getDetailPropertyLeafPaths } from "./detailPropertyCommandParser";

const DETAIL_NOTE_SEPARATOR_PATTERN = /[；;\n]+/;
const OUTPUT_SEPARATOR = "；\n";
const OUTPUT_SUFFIX = "；";

function normalizeNoteItem(item) {
  return String(item || "").trim();
}

export function normalizeDetailNotes(text, metadata) {
  const sourceItems = String(text || "")
    .split(DETAIL_NOTE_SEPARATOR_PATTERN)
    .map(normalizeNoteItem)
    .filter(Boolean);

  if (sourceItems.length === 0) return "";

  const metadataPaths = getDetailPropertyLeafPaths(metadata);
  const metadataOrderMap = new Map(
    metadataPaths.map((path, index) => [path, index]),
  );
  const seenItems = new Set();
  const knownItems = [];
  const unknownItems = [];

  sourceItems.forEach((item, sourceIndex) => {
    if (seenItems.has(item)) return;

    seenItems.add(item);

    if (metadataOrderMap.has(item)) {
      knownItems.push({
        item,
        sourceIndex,
        order: metadataOrderMap.get(item),
      });
      return;
    }

    unknownItems.push({
      item,
      sourceIndex,
    });
  });

  knownItems.sort((a, b) => a.order - b.order || a.sourceIndex - b.sourceIndex);

  return [...knownItems, ...unknownItems]
    .map((entry) => entry.item)
    .join(OUTPUT_SEPARATOR)
    .concat(OUTPUT_SUFFIX);
}
