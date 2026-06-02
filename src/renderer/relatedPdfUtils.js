export const DOCUMENT_ROLES = {
  stemOnly: "stemOnly",
  stemAndAnswer: "stemAndAnswer",
  answerOnly: "answerOnly",
  mixed: "mixed",
};

function normalizePathSeparators(pathValue) {
  return String(pathValue || "").replaceAll("\\", "/");
}

function getDirectoryName(pathValue) {
  const normalizedPath = normalizePathSeparators(pathValue);
  const lastSlashIndex = normalizedPath.lastIndexOf("/");

  return lastSlashIndex >= 0 ? normalizedPath.slice(0, lastSlashIndex) : "";
}

function getFileName(pathValue) {
  const normalizedPath = normalizePathSeparators(pathValue);
  const lastSlashIndex = normalizedPath.lastIndexOf("/");

  return lastSlashIndex >= 0
    ? normalizedPath.slice(lastSlashIndex + 1)
    : normalizedPath;
}

function joinPath(directory, fileName) {
  if (!directory) return fileName;

  return `${directory}/${fileName}`;
}

function normalizeComparablePath(pathValue) {
  return normalizePathSeparators(pathValue).toLowerCase();
}

function getRelatedPdfPath(currentPdfPath, relatedPdfFileName) {
  const relatedFileName = String(relatedPdfFileName || "").trim();

  if (!relatedFileName) return "";

  if (/^[a-z]:[\\/]/i.test(relatedFileName) || relatedFileName.startsWith("/")) {
    return normalizePathSeparators(relatedFileName);
  }

  return joinPath(getDirectoryName(currentPdfPath), relatedFileName);
}

function getOpenedTabByPath(pdfTabs, pdfPath) {
  const comparablePath = normalizeComparablePath(pdfPath);

  return (
    (Array.isArray(pdfTabs) ? pdfTabs : []).find(
      (tab) => normalizeComparablePath(tab.pdfPath) === comparablePath,
    ) || null
  );
}

function createSourceFromTab(tab, role) {
  return {
    role,
    tabId: tab.id,
    pdfPath: tab.pdfPath,
    pdfName: tab.pdfName || getFileName(tab.pdfPath),
    sourceMetadata: tab.sourceMetadata || null,
    sourceMetadataError: tab.sourceMetadataError || "",
    freeRectangles: tab.freeRectangles || [],
    detectedRectangles: tab.detectedRectangles || [],
  };
}

function createMissingFile({ role, pdfPath, fileName }) {
  return {
    role,
    pdfPath,
    fileName,
  };
}

function getCurrentSource(currentTab, currentPdfPath, role) {
  if (currentTab) {
    return createSourceFromTab(currentTab, role);
  }

  return {
    role,
    tabId: "",
    pdfPath: currentPdfPath,
    pdfName: getFileName(currentPdfPath),
    sourceMetadata: null,
    sourceMetadataError: "",
    freeRectangles: [],
    detectedRectangles: [],
  };
}

export function getRelatedPdfResolution({
  currentPdfPath,
  sourceMetadata,
  pdfTabs,
  activePdfTabId,
}) {
  const role = sourceMetadata?.documentRole || "";
  const currentTab =
    (Array.isArray(pdfTabs) ? pdfTabs : []).find(
      (tab) => tab.id === activePdfTabId,
    ) || getOpenedTabByPath(pdfTabs, currentPdfPath);
  const readySources = [];
  const missingRelatedFiles = [];
  const warnings = [];
  const errors = [];

  if (!currentPdfPath) {
    return {
      role,
      readySources,
      missingRelatedFiles,
      warnings,
      errors: ["当前 PDF 路径为空。"],
    };
  }

  if (!sourceMetadata) {
    return {
      role,
      readySources: [getCurrentSource(currentTab, currentPdfPath, "current")],
      missingRelatedFiles,
      warnings,
      errors: ["当前 PDF 没有可用的 metaJson 元数据。"],
    };
  }

  if (!role || role === DOCUMENT_ROLES.stemAndAnswer) {
    readySources.push(getCurrentSource(currentTab, currentPdfPath, "stemAndAnswer"));
  } else if (role === DOCUMENT_ROLES.stemOnly) {
    readySources.push(getCurrentSource(currentTab, currentPdfPath, "stem"));

    const fileName = String(sourceMetadata.answerPdfFileName || "").trim();

    if (!/答案|answer/i.test(fileName)) {
      errors.push("答案 PDF 文件名必须包含“答案”或“answer”。");
    } else {
      const pdfPath = getRelatedPdfPath(currentPdfPath, fileName);
      const openedTab = getOpenedTabByPath(pdfTabs, pdfPath);

      if (openedTab) {
        readySources.push(createSourceFromTab(openedTab, "answer"));
      } else {
        missingRelatedFiles.push(createMissingFile({ role: "answer", pdfPath, fileName }));
      }
    }
  } else if (role === DOCUMENT_ROLES.answerOnly) {
    readySources.push(getCurrentSource(currentTab, currentPdfPath, "answer"));

    const fileName = String(sourceMetadata.stemPdfFileName || "").trim();

    if (!fileName) {
      errors.push("题干 PDF 文件名不能为空。");
    } else {
      const pdfPath = getRelatedPdfPath(currentPdfPath, fileName);
      const openedTab = getOpenedTabByPath(pdfTabs, pdfPath);

      if (openedTab) {
        readySources.push(createSourceFromTab(openedTab, "stem"));
      } else {
        missingRelatedFiles.push(createMissingFile({ role: "stem", pdfPath, fileName }));
      }
    }
  } else if (role === DOCUMENT_ROLES.mixed) {
    readySources.push(getCurrentSource(currentTab, currentPdfPath, "mixed"));
    warnings.push("综合类型暂不自动推断关联 PDF。");
  } else {
    readySources.push(getCurrentSource(currentTab, currentPdfPath, "current"));
    warnings.push(`未知 PDF 类型：${role}`);
  }

  return {
    role,
    readySources,
    missingRelatedFiles,
    warnings,
    errors,
  };
}
