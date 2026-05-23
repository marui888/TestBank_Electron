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
  return (Array.isArray(nodes) ? nodes : []).flatMap((node) => [
    node,
    ...flattenNodes(node.children),
  ]);
}

function getSegmentName(path, segmentNames) {
  return path
    .map((index, indexPosition) => `${index}${segmentNames[indexPosition]}`)
    .join("");
}

function getQuestionName(path, questionIndex, segmentNames) {
  return `${getSegmentName(path, segmentNames)}第${questionIndex}题`;
}

function getOptionalNumber(value) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function normalizeMetadataNode(node, level, parent) {
  const normalizedNode = {
    ...node,
    level,
    index: Number(node.index),
    startPage: getOptionalNumber(node.startPage),
    total: getOptionalNumber(node.total),
    startQuestionID: getOptionalNumber(node.startQuestionID),
    children: [],
    parent,
  };

  normalizedNode.children = (Array.isArray(node.children) ? node.children : [])
    .map((child) => normalizeMetadataNode(child, level + 1, normalizedNode));

  return normalizedNode;
}

export function parseSourceMetadataJson(rawText) {
  const metadata = typeof rawText === "string" ? JSON.parse(rawText) : rawText;

  return {
    schemaVersion: metadata.schemaVersion || 1,
    name: metadata.name || "",
    type: metadata.type || "",
    pageGap: Number(metadata.pageGap || 0),
    segmentNames: Array.isArray(metadata.segmentNames)
      ? metadata.segmentNames
      : [],
    roots: (Array.isArray(metadata.roots) ? metadata.roots : []).map((node) =>
      normalizeMetadataNode(node, 1, null),
    ),
  };
}

export function getSourcePageFromPdfPage(pdfPage, pageGap) {
  return pdfPage - pageGap + 1;
}

export function getSecondLastSegments(metadata) {
  if (!metadata) return [];

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
  return getSecondLastSegmentGroupForPage(metadata, sourcePage).currentSegment;
}

export function getSecondLastSegmentGroupForPage(
  metadata,
  sourcePage,
  rangeMode = "default",
) {
  const segments = getSecondLastSegments(metadata);
  const currentIndex = segments.findIndex(
    (segment) =>
      sourcePage >= segment.startPage &&
      (segment.endPage === null || sourcePage <= segment.endPage),
  );

  if (currentIndex === -1) {
    return {
      currentSegment: null,
      segments: [],
    };
  }

  const currentSegment = segments[currentIndex];

  if (rangeMode === "prev") {
    return {
      currentSegment,
      segments: [segments[currentIndex - 1], currentSegment].filter(Boolean),
    };
  }

  if (rangeMode === "next") {
    return {
      currentSegment,
      segments: [currentSegment, segments[currentIndex + 1]].filter(Boolean),
    };
  }

  return {
    currentSegment,
    segments: [currentSegment],
  };
}

export function getQuestionItemsForSecondLastSegment(segmentInfo, metadata) {
  if (!segmentInfo?.node) return [];

  return segmentInfo.node.children.flatMap((child) => {
    const total = Number(child.total);
    const startQuestionID = Number(child.startQuestionID || 1);
    const path = getNodePath(child);

    if (!Number.isInteger(total) || total <= 0) return [];

    return Array.from({ length: total }, (_, itemIndex) => {
      const questionIndex = startQuestionID + itemIndex;
      const id = [...path, questionIndex].join(".");

      return {
        id,
        name: getQuestionName(path, questionIndex, metadata.segmentNames),
      };
    });
  });
}

export function getQuestionListForPdfPage(
  metadata,
  pdfPage,
  rangeMode = "default",
) {
  if (!metadata) {
    return {
      sourcePage: pdfPage,
      segment: null,
      segments: [],
      questions: [],
    };
  }

  const sourcePage = getSourcePageFromPdfPage(pdfPage, metadata.pageGap);
  const segmentGroup = getSecondLastSegmentGroupForPage(
    metadata,
    sourcePage,
    rangeMode,
  );

  return {
    sourcePage,
    segment: segmentGroup.currentSegment,
    segments: segmentGroup.segments,
    questions: segmentGroup.segments.flatMap((segment) =>
      getQuestionItemsForSecondLastSegment(segment, metadata),
    ),
  };
}
