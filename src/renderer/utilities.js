function parseAttributes(rawText = "") {
  const text = rawText.trim();

  if (/^\d+$/.test(text)) {
    return {
      total: Number(text),
      startIndex: 1,
    };
  }

  const attributes = {};
  const normalizedText = text.replaceAll("；", ";").replaceAll("：", ":");

  normalizedText
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((part) => {
      const separatorIndex = part.indexOf(":");
      if (separatorIndex === -1) return;

      const key = part.slice(0, separatorIndex).trim();
      const rawValue = part.slice(separatorIndex + 1).trim();
      const unquotedValue = rawValue.replace(/^["']|["']$/g, "");
      const numericValue = Number(unquotedValue);

      attributes[key] = Number.isFinite(numericValue)
        ? numericValue
        : unquotedValue;
    });

  if (attributes.total && !attributes.startIndex) {
    attributes.startIndex = 1;
  }

  return attributes;
}

function getCodeBlockText(markdownText) {
  const match = markdownText.match(/```([\s\S]*?)```/);
  return match ? match[1] : "";
}

function getNodePath(node) {
  const path = [];
  let current = node;

  while (current) {
    path.unshift(current.index);
    current = current.parent;
  }

  return path;
}

function flattenNodes(nodes) {
  return nodes.flatMap((node) => [node, ...flattenNodes(node.children)]);
}

function getSegmentName(path, segmentNames) {
  return path
    .map((index, indexPosition) => `${index}${segmentNames[indexPosition]}`)
    .join("");
}

function getQuestionName(path, questionIndex, segmentNames) {
  return `${getSegmentName(path, segmentNames)}第${questionIndex}题`;
}

export function parseSourceMetadata(markdownText) {
  const nameMatch = markdownText.match(
    /^##\s*name:\s*([^;]+);\s*type:\s*["']?([^"'\n]+)["']?/m,
  );
  const pageGapMatch = markdownText.match(/^###\s*pageGap:\s*(\d+)/m);
  const segmentNamesMatch = markdownText.match(
    /^###\s*segmentNames:\s*([^\n]+)/m,
  );
  const segmentNames = segmentNamesMatch
    ? segmentNamesMatch[1].trim().split(":").map((name) => name.trim())
    : [];
  const roots = [];
  const stack = [];
  const codeBlockText = getCodeBlockText(markdownText);

  codeBlockText.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*(#+)\s+(\d+)\s*(?:\{([^}]*)\})?/);
    if (!match) return;

    const level = match[1].length;
    const node = {
      level,
      index: Number(match[2]),
      children: [],
      parent: null,
      ...parseAttributes(match[3] || ""),
    };

    stack.length = level - 1;

    const parent = stack[level - 2] || null;
    if (parent) {
      node.parent = parent;
      parent.children.push(node);
    } else {
      roots.push(node);
    }

    stack[level - 1] = node;
  });

  return {
    name: nameMatch?.[1]?.trim() || "",
    type: nameMatch?.[2]?.trim() || "",
    pageGap: pageGapMatch ? Number(pageGapMatch[1]) : 0,
    segmentNames,
    roots,
  };
}

export function getSourcePageFromPdfPage(pdfPage, pageGap) {
  return pdfPage - pageGap + 1;
}

export function getSecondLastSegments(metadata) {
  const secondLastLevel = metadata.segmentNames.length - 1;
  const segments = flattenNodes(metadata.roots).filter(
    (node) => node.level === secondLastLevel && Number.isFinite(node.startPage),
  );

  return segments
    .sort((a, b) => a.startPage - b.startPage)
    .map((segment, index) => {
      const nextSegment = segments[index + 1] || null;
      const path = getNodePath(segment);

      return {
        node: segment,
        id: path.join("."),
        title: segment.title || "",
        name: getSegmentName(path, metadata.segmentNames),
        startPage: segment.startPage,
        endPage: nextSegment ? nextSegment.startPage - 1 : null,
      };
    });
}

export function getSecondLastSegmentForPage(metadata, sourcePage) {
  const segments = getSecondLastSegments(metadata);

  return (
    segments.find(
      (segment) =>
        sourcePage >= segment.startPage &&
        (segment.endPage === null || sourcePage <= segment.endPage),
    ) || null
  );
}

export function getQuestionItemsForSecondLastSegment(segmentInfo, metadata) {
  if (!segmentInfo?.node) return [];

  return segmentInfo.node.children.flatMap((child) => {
    const total = Number(child.total);
    const startIndex = Number(child.startIndex || 1);
    const path = getNodePath(child);

    if (!Number.isInteger(total) || total <= 0) return [];

    return Array.from({ length: total }, (_, itemIndex) => {
      const questionIndex = startIndex + itemIndex;
      const id = [...path, questionIndex].join(".");

      return {
        id,
        name: getQuestionName(path, questionIndex, metadata.segmentNames),
      };
    });
  });
}

export function getQuestionListForPdfPage(metadata, pdfPage) {
  const sourcePage = getSourcePageFromPdfPage(pdfPage, metadata.pageGap);
  const segment = getSecondLastSegmentForPage(metadata, sourcePage);

  return {
    sourcePage,
    segment,
    questions: getQuestionItemsForSecondLastSegment(segment, metadata),
  };
}
