import { useEffect, useMemo, useRef, useState } from "react";
import PdfCompositeRegionView from "./PdfCompositeRegionView";
import {
  getQuestionRegionsById,
  getQuestionRegionsByIdAcrossSources,
} from "../questionRegionUtils";
import {
  collectQuestionEntitiesFromTabs,
  createDefaultQuestionSearchFilters,
  searchQuestionEntities,
} from "../questionEntitySearchUtils";
import { exportCompositeRegionsToPngDataUrl } from "../pdfCompositeExportUtils";

const MIN_STEM_PERCENT = 20;
const MAX_STEM_PERCENT = 65;
const LAYOUT_MODE_OPTIONS = [
  { value: "auto", label: "自动排列" },
  { value: "vertical", label: "竖向排列" },
  { value: "horizontal", label: "横向排列" },
];
const REGION_GAP_OPTIONS = [0, 4, 8, 12, 16, 24];
const DASHSCOPE_BASE_URL_OPTIONS = [
  {
    label: "华北2（北京）",
    value: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  },
  {
    label: "美国（弗吉尼亚）",
    value: "https://dashscope-us.aliyuncs.com/compatible-mode/v1",
  },
];
const DASHSCOPE_VISION_MODEL_OPTIONS = [
  "qwen3-vl-plus",
  "qwen-vl-ocr-latest",
  "qwen-vl-ocr",
  "qwen3-vl-flash",
];
const DASHSCOPE_CLIENT_OPTIONS = [
  { value: "openai", label: "OpenAI SDK" },
  { value: "fetch", label: "Fetch" },
];
const CONVERT_OUTPUT_FORMAT_OPTIONS = [
  {
    value: "latex-to-typst-local-math-only",
    label: "LatexToTypst_Local_MathOnly",
  },
  { value: "typst", label: "Typst片段" },
  { value: "latex", label: "LaTeX片段" },
  { value: "latex-to-typst-local-all", label: "LatexToTypst_Local_All" },
];

function getPathFileName(filePath) {
  return String(filePath || "").split(/[\\/]/).pop() || "";
}

function getDashscopeClientLabel(client) {
  return (
    DASHSCOPE_CLIENT_OPTIONS.find((option) => option.value === client)?.label ||
    client ||
    "-"
  );
}

function getConvertOutputFormatLabel(outputFormat) {
  return (
    CONVERT_OUTPUT_FORMAT_OPTIONS.find((option) => option.value === outputFormat)
      ?.label ||
    outputFormat ||
    "-"
  );
}

const questionTypeLabels = {
  choice: "选择",
  blank: "填空",
  solution: "解答",
  undetermined: "未定",
};

export default function QuestionBrowseView({
  pdfDoc,
  pdfDocsByTabId,
  resetToken = 0,
  questionRegionGapDefault = 0,
  onQuestionRegionGapDefaultChange,
  questionId,
  onQuestionIdChange,
  pdfTabs = [],
  onSearchResultSelect,
  onSearchResultJump,
  freeRectangles,
  detectedRectangles,
  sources = [],
  missingRelatedFiles = [],
  relatedErrors = [],
  relatedWarnings = [],
  onExitQuery,
}) {
  const contentRef = useRef(null);
  const stemCompositeRef = useRef(null);
  const answerCompositeRef = useRef(null);
  const [activeSolutionNo, setActiveSolutionNo] = useState("");
  const [stemPercent, setStemPercent] = useState(34);
  const [isDraggingSplitter, setIsDraggingSplitter] = useState(false);
  const [stemLayoutMode, setStemLayoutMode] = useState("auto");
  const [answerLayoutModes, setAnswerLayoutModes] = useState({});
  const [stemRegionGapOverride, setStemRegionGapOverride] = useState(null);
  const [answerRegionGapOverrides, setAnswerRegionGapOverrides] = useState({});
  const [layoutMenu, setLayoutMenu] = useState(null);
  const [searchResultMenu, setSearchResultMenu] = useState(null);
  const [searchFilters, setSearchFilters] = useState(() =>
    createDefaultQuestionSearchFilters(),
  );
  const [searchResults, setSearchResults] = useState([]);
  const [selectedSearchResultKey, setSelectedSearchResultKey] = useState("");
  const [activeSearchTab, setActiveSearchTab] = useState("filters");
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportDialogMode, setExportDialogMode] = useState("current");
  const [componentExportTarget, setComponentExportTarget] = useState("");
  const [isExportingQuestion, setIsExportingQuestion] = useState(false);
  const [exportOutputDir, setExportOutputDir] = useState("");
  const [dashscopeBaseUrl, setDashscopeBaseUrl] = useState(
    DASHSCOPE_BASE_URL_OPTIONS[0].value,
  );
  const [dashscopeVisionModel, setDashscopeVisionModel] = useState(
    DASHSCOPE_VISION_MODEL_OPTIONS[0],
  );
  const [dashscopeClient, setDashscopeClient] = useState(
    DASHSCOPE_CLIENT_OPTIONS[0].value,
  );
  const [convertOutputFormat, setConvertOutputFormat] = useState(
    CONVERT_OUTPUT_FORMAT_OPTIONS[0].value,
  );
  const [typstImagePath, setTypstImagePath] = useState("");
  const [isConvertingTypst, setIsConvertingTypst] = useState(false);
  const [typstConvertResult, setTypstConvertResult] = useState(null);
  const questionEntities = useMemo(
    () => collectQuestionEntitiesFromTabs(pdfTabs),
    [pdfTabs],
  );

  useEffect(() => {
    setActiveSolutionNo("");
    setStemPercent(34);
    setIsDraggingSplitter(false);
    setStemLayoutMode("auto");
    setAnswerLayoutModes({});
    setStemRegionGapOverride(null);
    setAnswerRegionGapOverrides({});
    setLayoutMenu(null);
    setSearchResultMenu(null);
    setSearchFilters(createDefaultQuestionSearchFilters());
    setSearchResults([]);
    setSelectedSearchResultKey("");
    setActiveSearchTab("filters");
    setExportDialogOpen(false);
    setExportDialogMode("current");
    setComponentExportTarget("");
    setIsExportingQuestion(false);
  }, [resetToken]);
  const questionRegions = useMemo(
    () => {
      if (sources.length > 0) {
        return getQuestionRegionsByIdAcrossSources(questionId, sources);
      }

      return getQuestionRegionsById(questionId, {
        freeRectangles,
        detectedRectangles,
      });
    },
    [questionId, freeRectangles, detectedRectangles, sources],
  );
  const sourceSummary = useMemo(() => {
    const sourceNames = Array.from(
      new Set(
        [
          ...questionRegions.stemRegions,
          ...questionRegions.answerGroups.flatMap((group) => group.regions),
        ]
          .map((region) => region.sourcePdfName)
          .filter(Boolean),
      ),
    );

    return sourceNames.join(" / ");
  }, [questionRegions]);
  const activeAnswerGroup =
    questionRegions.answerGroups.find(
      (group) => group.solutionNo === activeSolutionNo,
    ) ||
    questionRegions.answerGroups[0] ||
    null;
  const exportFilePrefix = getExportFilePrefix();
  const activeAnswerSolutionNo = activeAnswerGroup?.solutionNo || "1";
  const activeAnswerLayoutMode =
    answerLayoutModes[activeAnswerGroup?.solutionNo] || "auto";
  const stemRegionGap = stemRegionGapOverride ?? questionRegionGapDefault;
  const activeAnswerRegionGap =
    answerRegionGapOverrides[activeAnswerGroup?.solutionNo] ??
    questionRegionGapDefault;

  function handleQuestionIdChange(event) {
    setActiveSolutionNo("");
    onQuestionIdChange?.(event.target.value);
  }

  function updateSearchFilter(fieldName, nextValue) {
    setSearchFilters((oldFilters) => ({
      ...oldFilters,
      [fieldName]: nextValue,
    }));
  }

  function runQuestionSearch() {
    setSearchResults(searchQuestionEntities(questionEntities, searchFilters));
    setSelectedSearchResultKey("");
  }

  function clearQuestionSearch() {
    setSearchFilters(createDefaultQuestionSearchFilters());
    setSearchResults([]);
    setSelectedSearchResultKey("");
  }

  function selectSearchResult(result) {
    setActiveSolutionNo("");
    setSelectedSearchResultKey(result.key || "");
    onSearchResultSelect?.(result);
  }

  function openSearchResultMenu(event, result) {
    event.preventDefault();
    event.stopPropagation();
    setSearchResultMenu({
      x: event.clientX,
      y: event.clientY,
      result,
    });
  }

  function closeSearchResultMenu() {
    setSearchResultMenu(null);
  }

  function jumpToSearchResultSource() {
    if (!searchResultMenu?.result) return;

    onSearchResultJump?.(searchResultMenu.result);
    closeSearchResultMenu();
  }

  function openExportDialog(mode) {
    setExportDialogMode(mode);
    setExportDialogOpen(true);
  }

  async function selectTypstImage() {
    if (!window.electronPdf?.selectTypstImage) return;

    try {
      const result = await window.electronPdf.selectTypstImage();

      if (result?.canceled || !result?.imagePath) return;

      setTypstImagePath(result.imagePath);
    } catch (error) {
      console.error("[typst-convert] select image failed:", error);
      window.alert("选择图片失败，请查看控制台。");
    }
  }

  async function convertTypstImage() {
    if (!typstImagePath || !window.electronPdf?.convertTypstImage) return;

    try {
      const startedAt = performance.now();
      setTypstConvertResult(null);
      setIsConvertingTypst(true);
      const result = await window.electronPdf.convertTypstImage({
        imagePath: typstImagePath,
        baseUrl: dashscopeBaseUrl,
        model: dashscopeVisionModel,
        client: dashscopeClient,
        outputFormat: convertOutputFormat,
      });

      setTypstConvertResult(result || null);
      const elapsedSeconds = ((performance.now() - startedAt) / 1000).toFixed(1);
      window.alert(
        `转换完成：\n格式：${getConvertOutputFormatLabel(result?.outputFormat || convertOutputFormat)}\n方式：${getDashscopeClientLabel(result?.clientUsed || dashscopeClient)}\n文件：${getPathFileName(result?.sourcePath || result?.typstPath) || "-"}\n耗时：${elapsedSeconds} 秒`,
      );
    } catch (error) {
      console.error("[typst-convert] convert failed:", error);
      window.alert(error?.message || "图片转 Typst 失败，请查看控制台。");
    } finally {
      setIsConvertingTypst(false);
    }
  }

  function getExportDialogTitle() {
    if (exportDialogMode === "all") return "全部导出";
    if (exportDialogMode === "component") return "导出当前组件";

    return "导出当前题目";
  }

  function getExportDialogSubtitle() {
    if (exportDialogMode === "all") {
      return "将导出当前查询结果列表中的所有题目。";
    }

    if (exportDialogMode === "component") {
      return "将导出右键菜单对应区域的当前显示内容。";
    }

    return "将导出题干和全部答案图片。";
  }

  async function selectExportOutputDir() {
    if (!window.electronPdf?.selectOutputPictureDir) {
      return {
        canceled: false,
        outputDir: exportOutputDir,
      };
    }

    const result = await window.electronPdf.selectOutputPictureDir(
      exportOutputDir,
    );

    if (result?.canceled || !result?.outputDir) {
      return { canceled: true };
    }

    setExportOutputDir(result.outputDir);

    return {
      canceled: false,
      outputDir: result.outputDir,
    };
  }

  async function saveCompositeImage({
    regions,
    layoutMode,
    regionGap,
    fileName,
    outputDir,
  }) {
    if (!window.electronPdf?.saveOutputPicture) {
      return {
        ok: false,
        reason: "saveOutputPicture IPC 不可用，请重启应用后再试。",
      };
    }

    if (!regions?.length) {
      return {
        ok: false,
        reason: `没有可导出的矩形内容：${fileName}`,
      };
    }

    try {
      const dataUrl = await exportCompositeRegionsToPngDataUrl({
        pdfDoc,
        pdfDocsByTabId,
        regions,
        layoutMode,
        regionGap,
      });

      if (!dataUrl) {
        return {
          ok: false,
          reason: `没有生成图片数据：${fileName}`,
        };
      }

      const savedResult = await window.electronPdf.saveOutputPicture(
        fileName,
        dataUrl,
        outputDir,
      );

      return {
        ok: true,
        ...savedResult,
      };
    } catch (error) {
      console.error("[question-export] failed:", error);
      return {
        ok: false,
        reason: error?.message || String(error),
      };
    }
  }

  function withEntitySource(region, entity) {
    return {
      ...region,
      sourceTabId: region.sourceTabId || entity.tabId || "",
      sourcePdfPath: region.sourcePdfPath || entity.pdfPath || "",
      sourcePdfName: region.sourcePdfName || entity.pdfName || "",
    };
  }

  function getExportableEntity(entity) {
    return {
      ...entity,
      stemRegions: (entity.stemRegions || []).map((region) =>
        withEntitySource(region, entity),
      ),
      answerGroups: (entity.answerGroups || []).map((group) => ({
        ...group,
        regions: (group.regions || []).map((region) =>
          withEntitySource(region, entity),
        ),
      })),
      analysisRegions: (entity.analysisRegions || []).map((region) =>
        withEntitySource(region, entity),
      ),
    };
  }

  function getSearchResultEntity(result) {
    if (result?.entity?.stemRegions || result?.entity?.answerGroups) {
      return getExportableEntity({
        ...result.entity,
        tabId: result.entity.tabId || result.tabId || "",
        pdfPath: result.entity.pdfPath || result.pdfPath || "",
        pdfName: result.entity.pdfName || result.pdfName || "",
        questionId: result.questionId || result.entity.questionId || "",
      });
    }

    const matchedEntity = questionEntities.find(
      (entity) =>
        entity.key === result?.key ||
        (entity.pdfPath === result?.pdfPath &&
          entity.questionId === result?.questionId),
    );

    return matchedEntity ? getExportableEntity(matchedEntity) : null;
  }

  function getCrossSourceExportEntity(result) {
    const resultQuestionId = result?.questionId || "";

    if (!resultQuestionId || sources.length === 0) return null;

    const regions = getQuestionRegionsByIdAcrossSources(
      resultQuestionId,
      sources,
    );
    const firstRegion =
      regions.stemRegions[0] ||
      regions.answerGroups[0]?.regions?.[0] ||
      regions.analysisRegions[0];

    if (!firstRegion) return null;

    return {
      key: result?.key || `${firstRegion.sourcePdfPath || ""}::${resultQuestionId}`,
      tabId: firstRegion.sourceTabId || result?.tabId || "",
      pdfPath: firstRegion.sourcePdfPath || result?.pdfPath || "",
      pdfName: firstRegion.sourcePdfName || result?.pdfName || "",
      questionId: resultQuestionId,
      stemRegions: regions.stemRegions,
      answerGroups: regions.answerGroups,
      analysisRegions: regions.analysisRegions,
    };
  }

  function getExportFilePrefixForEntity(entity) {
    const safePdfName =
      sanitizeExportNamePart(entity?.pdfName || entity?.pdfPath?.split(/[\\/]/).pop()) ||
      "question";
    const safeQuestionId =
      sanitizeExportNamePart(entity?.questionId) || "unknown";

    return `${safePdfName}_${safeQuestionId}`;
  }

  function canExportEntity(entity) {
    if (!entity) return false;
    if (!entity.tabId) return true;
    return pdfDocsByTabId?.has?.(entity.tabId);
  }

  async function exportQuestionEntity(entity, outputDir) {
    if (!entity) {
      return {
        imageResults: [],
        failures: ["没有找到题目实体。"],
      };
    }

    if (!canExportEntity(entity)) {
      return {
        imageResults: [],
        failures: [
          `${entity.pdfName || entity.pdfPath || "unknown"} / ${
            entity.questionId || "unknown"
          }：PDF 文档尚未加载。`,
        ],
      };
    }

    const filePrefix = getExportFilePrefixForEntity(entity);
    const imageResults = [];
    const failures = [];

    imageResults.push(
      await saveCompositeImage({
        regions: entity.stemRegions || [],
        layoutMode: stemLayoutMode,
        regionGap: stemRegionGap,
        fileName: `${filePrefix}_stem.png`,
        outputDir,
      }),
    );

    for (const answerGroup of entity.answerGroups || []) {
      const solutionNo = answerGroup.solutionNo || "1";
      imageResults.push(
        await saveCompositeImage({
          regions: answerGroup.regions || [],
          layoutMode: answerLayoutModes[solutionNo] || "auto",
          regionGap:
            answerRegionGapOverrides[solutionNo] ?? questionRegionGapDefault,
          fileName: `${filePrefix}_answer_${solutionNo}.png`,
          outputDir,
        }),
      );
    }

    imageResults
      .filter((result) => !result?.ok)
      .forEach((result) => failures.push(result?.reason || "导出失败。"));

    return {
      imageResults,
      failures,
    };
  }

  async function exportCurrentQuestionImages() {
    try {
      setIsExportingQuestion(true);
      const dirResult = await selectExportOutputDir();

      if (dirResult.canceled) {
        return;
      }

      const exportResults = [];

      exportResults.push(
        await saveCompositeImage({
          regions: questionRegions.stemRegions,
          layoutMode: stemLayoutMode,
          regionGap: stemRegionGap,
          fileName: `${exportFilePrefix}_stem.png`,
          outputDir: dirResult.outputDir,
        }),
      );

      for (const answerGroup of questionRegions.answerGroups) {
        const solutionNo = answerGroup.solutionNo || "1";
        exportResults.push(
          await saveCompositeImage({
            regions: answerGroup.regions,
            layoutMode: answerLayoutModes[solutionNo] || "auto",
            regionGap:
              answerRegionGapOverrides[solutionNo] ?? questionRegionGapDefault,
            fileName: `${exportFilePrefix}_answer_${solutionNo}.png`,
            outputDir: dirResult.outputDir,
          }),
        );
      }

      const successfulResults = exportResults.filter((result) => result?.ok);

      if (successfulResults.length > 0) {
        window.alert(
          `导出完成：\n${successfulResults
            .map((result) => result.outputPath || result.fileName)
            .filter(Boolean)
            .join("\n")}`,
        );
        return;
      }

      const reason = exportResults
        .map((result) => result?.reason)
        .filter(Boolean)
        .join("\n");

      window.alert(
        reason ||
          "没有可导出的题干或答案，请先输入 questionId 并等待题目渲染完成。",
      );
    } catch (error) {
      console.error("[question-export] failed:", error);
        window.alert("导出当前题目失败，请查看控制台。");
    } finally {
      setIsExportingQuestion(false);
      setExportDialogOpen(false);
    }
  }

  async function exportAllSearchResultImages() {
    try {
      setIsExportingQuestion(true);
      const dirResult = await selectExportOutputDir();

      if (dirResult.canceled) {
        return;
      }

      let successImageCount = 0;
      const failures = [];

      for (const result of searchResults) {
        const entity = getCrossSourceExportEntity(result) || getSearchResultEntity(result);
        const exportResult = await exportQuestionEntity(
          entity,
          dirResult.outputDir,
        );

        successImageCount += exportResult.imageResults.filter(
          (item) => item?.ok,
        ).length;

        failures.push(...exportResult.failures);
      }

      window.alert(
        [
          `全部导出完成：成功 ${successImageCount} 张图片。`,
          failures.length > 0 ? `失败 ${failures.length} 项：` : "",
          ...failures.slice(0, 12),
          failures.length > 12 ? `还有 ${failures.length - 12} 项失败未显示。` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      );
    } catch (error) {
      console.error("[question-export-all] failed:", error);
      window.alert("全部导出失败，请查看控制台。");
    } finally {
      setIsExportingQuestion(false);
      setExportDialogOpen(false);
    }
  }

  async function exportCurrentComponentImage() {
    try {
      setIsExportingQuestion(true);
      const dirResult = await selectExportOutputDir();

      if (dirResult.canceled) {
        return;
      }

      const isStem = componentExportTarget === "stem";
      const result = await saveCompositeImage({
        regions: isStem ? questionRegions.stemRegions : activeAnswerGroup?.regions,
        layoutMode: isStem ? stemLayoutMode : activeAnswerLayoutMode,
        regionGap: isStem ? stemRegionGap : activeAnswerRegionGap,
        fileName: isStem
          ? `${exportFilePrefix}_stem.png`
          : `${exportFilePrefix}_answer_${activeAnswerSolutionNo}.png`,
        outputDir: dirResult.outputDir,
      });

      if (result?.ok) {
        window.alert(`图片已保存：${result.outputPath || result.fileName || ""}`);
      } else if (result?.reason) {
        window.alert(result.reason);
      } else {
        window.alert("没有可导出的组件内容。");
      }
    } catch (error) {
      console.error("[question-export-component] failed:", error);
      window.alert("导出当前组件失败，请查看控制台。");
    } finally {
      setIsExportingQuestion(false);
      setExportDialogOpen(false);
    }
  }

  function getQuestionTypeLabel(value) {
    return questionTypeLabels[value] || value || "-";
  }

  function sanitizeExportNamePart(value) {
    return String(value || "")
      .trim()
      .replace(/\.pdf$/i, "")
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
      .replace(/\s+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function getExportFilePrefix() {
    const firstRegion =
      questionRegions.stemRegions[0] ||
      activeAnswerGroup?.regions?.[0] ||
      questionRegions.analysisRegions?.[0];
    const pdfName =
      firstRegion?.sourcePdfName ||
      firstRegion?.sourcePdfPath?.split(/[\\/]/).pop() ||
      "question";
    const safePdfName = sanitizeExportNamePart(pdfName) || "question";
    const safeQuestionId = sanitizeExportNamePart(questionId) || "unknown";

    return `${safePdfName}_${safeQuestionId}`;
  }

  function serializeSearchResults(results) {
    return results.map((result) => ({
      key: result.key,
      tabId: result.tabId || "",
      pdfPath: result.pdfPath || "",
      pdfName: result.pdfName || "",
      questionId: result.questionId || "",
      businessProps: result.businessProps || {},
      detailHitLabels: result.detailHitLabels || [],
      detailHitText: result.detailHitText || "",
    }));
  }

  function hydrateSearchResults(results) {
    return (Array.isArray(results) ? results : []).map((result) => {
      const openedTab = pdfTabs.find((tab) => tab.pdfPath === result.pdfPath);

      return {
        ...result,
        key: result.key || `${result.pdfPath || ""}::${result.questionId || ""}`,
        tabId: openedTab?.id || result.tabId || "",
        entity: {
          tabId: openedTab?.id || result.tabId || "",
          pdfPath: result.pdfPath || "",
          pdfName: result.pdfName || "",
        },
      };
    });
  }

  async function saveQuestionSearchState() {
    if (!window.electronPdf?.saveQuestionSearch) return;

    try {
      await window.electronPdf.saveQuestionSearch({
        version: 1,
        savedAt: new Date().toISOString(),
        filters: searchFilters,
        results: serializeSearchResults(searchResults),
      });
    } catch (error) {
      console.error("[question-search] save failed:", error);
      window.alert("保存查询失败，请查看控制台。");
    }
  }

  async function restoreQuestionSearchState() {
    if (!window.electronPdf?.openQuestionSearch) return;

    try {
      const result = await window.electronPdf.openQuestionSearch();
      if (result?.canceled) return;

      const data = result?.data || {};
      setSearchFilters({
        ...createDefaultQuestionSearchFilters(),
        ...(data.filters || {}),
      });
      setSearchResults(hydrateSearchResults(data.results));
      setSelectedSearchResultKey("");
      setActiveSearchTab("results");
    } catch (error) {
      console.error("[question-search] restore failed:", error);
      window.alert("恢复查询失败，请查看控制台。");
    }
  }

  function handleSplitterMouseDown(event) {
    setIsDraggingSplitter(true);
    event.preventDefault();
  }

  function openLayoutMenu(event, target) {
    event.preventDefault();
    event.stopPropagation();
    setLayoutMenu({
      target,
      x: event.clientX,
      y: event.clientY,
      solutionNo: activeAnswerGroup?.solutionNo || "",
    });
  }

  function closeLayoutMenu() {
    setLayoutMenu(null);
  }

  function applyLayoutMode(nextLayoutMode) {
    if (!layoutMenu) return;

    if (layoutMenu.target === "stem") {
      setStemLayoutMode(nextLayoutMode);
    }

    if (layoutMenu.target === "answer" && layoutMenu.solutionNo) {
      setAnswerLayoutModes((oldModes) => ({
        ...oldModes,
        [layoutMenu.solutionNo]: nextLayoutMode,
      }));
    }

    closeLayoutMenu();
  }

  function getLayoutMenuGapValue() {
    if (!layoutMenu) return questionRegionGapDefault;

    if (layoutMenu.target === "stem") {
      return stemRegionGapOverride ?? questionRegionGapDefault;
    }

    return (
      answerRegionGapOverrides[layoutMenu.solutionNo] ??
      questionRegionGapDefault
    );
  }

  function applyRegionGapOverride(nextGap) {
    if (!layoutMenu) return;
    const numericGap = Number(nextGap);
    const safeGap = Number.isFinite(numericGap) && numericGap > 0 ? numericGap : 0;

    if (layoutMenu.target === "stem") {
      setStemRegionGapOverride(safeGap);
    } else if (layoutMenu.solutionNo) {
      setAnswerRegionGapOverrides((oldOverrides) => ({
        ...oldOverrides,
        [layoutMenu.solutionNo]: safeGap,
      }));
    }

    closeLayoutMenu();
  }

  function clearRegionGapOverride() {
    if (!layoutMenu) return;

    if (layoutMenu.target === "stem") {
      setStemRegionGapOverride(null);
    } else if (layoutMenu.solutionNo) {
      setAnswerRegionGapOverrides((oldOverrides) => {
        const nextOverrides = { ...oldOverrides };
        delete nextOverrides[layoutMenu.solutionNo];
        return nextOverrides;
      });
    }

    closeLayoutMenu();
  }

  function saveRegionGapAsDefault() {
    onQuestionRegionGapDefaultChange?.(getLayoutMenuGapValue());
    closeLayoutMenu();
  }

  function exportLayoutMenuCompositeImage() {
    if (!layoutMenu) return;
    setComponentExportTarget(layoutMenu.target);
    closeLayoutMenu();
    openExportDialog("component");
  }

  useEffect(() => {
    if (!isDraggingSplitter) return undefined;

    function handleMouseMove(event) {
      const content = contentRef.current;
      if (!content) return;

      const rect = content.getBoundingClientRect();
      const nextPercent = ((event.clientX - rect.left) / rect.width) * 100;
      const clampedPercent = Math.min(
        MAX_STEM_PERCENT,
        Math.max(MIN_STEM_PERCENT, nextPercent),
      );

      setStemPercent(clampedPercent);
    }

    function handleMouseUp() {
      setIsDraggingSplitter(false);
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingSplitter]);

  useEffect(() => {
    if (!layoutMenu) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        closeLayoutMenu();
      }
    }

    window.addEventListener("click", closeLayoutMenu);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("click", closeLayoutMenu);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [layoutMenu]);

  useEffect(() => {
    if (!searchResultMenu) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        closeSearchResultMenu();
      }
    }

    window.addEventListener("click", closeSearchResultMenu);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("click", closeSearchResultMenu);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [searchResultMenu]);

  return (
    <section className="question-browse-view">
      <aside className="question-browse-sidebar">
        <div className="question-browse-title-block">
          <div className="question-browse-title">题目查询</div>
          {sourceSummary && (
            <div className="question-browse-source-summary">
              {sourceSummary}
            </div>
          )}
        </div>

        <div className="question-search-tabs" role="tablist">
          <button
            type="button"
            className={activeSearchTab === "filters" ? "active" : ""}
            onClick={() => setActiveSearchTab("filters")}
          >
            查询条件
          </button>
          <button
            type="button"
            className={activeSearchTab === "results" ? "active" : ""}
            onClick={() => setActiveSearchTab("results")}
          >
            查询结果
          </button>
          <button
            type="button"
            className={activeSearchTab === "convert" ? "active" : ""}
            onClick={() => setActiveSearchTab("convert")}
          >
            转换
          </button>
        </div>

        {activeSearchTab === "filters" && (
          <section className="question-search-panel filters-panel">
            <label className="question-browse-id-field">
              <span>测试ID</span>
              <input value={questionId} onChange={handleQuestionIdChange} />
            </label>
            <div className="question-search-form">
              <div className="question-search-field-row">
                <label className="question-search-field">
                  <span>题目ID</span>
                  <input
                    value={searchFilters.questionId}
                    onChange={(event) =>
                      updateSearchFilter("questionId", event.target.value)
                    }
                  />
                </label>
                <label className="question-search-field">
                  <span>学段</span>
                  <select
                    value={searchFilters.stage}
                    onChange={(event) =>
                      updateSearchFilter("stage", event.target.value)
                    }
                  >
                    <option value="any">任意</option>
                    <option value="primary">小学</option>
                    <option value="junior">初中</option>
                    <option value="senior">高中</option>
                    <option value="undetermined">未定</option>
                  </select>
                </label>
              </div>
              <div className="question-search-field-row">
                <label className="question-search-field">
                  <span>科目</span>
                  <input
                    value={searchFilters.subject}
                    onChange={(event) =>
                      updateSearchFilter("subject", event.target.value)
                    }
                  />
                </label>
                <label className="question-search-field">
                  <span>题型</span>
                  <select
                    value={searchFilters.questionType}
                    onChange={(event) =>
                      updateSearchFilter("questionType", event.target.value)
                    }
                  >
                    <option value="any">任意</option>
                    <option value="choice">选择</option>
                    <option value="blank">填空</option>
                    <option value="solution">解答</option>
                    <option value="undetermined">未定</option>
                  </select>
                </label>
              </div>
              <div className="question-search-field-row">
                <label className="question-search-field">
                  <span>年级</span>
                  <input
                    value={searchFilters.grade}
                    onChange={(event) =>
                      updateSearchFilter("grade", event.target.value)
                    }
                  />
                </label>
                <label className="question-search-field">
                  <span>章节</span>
                  <input
                    value={searchFilters.chapter}
                    onChange={(event) =>
                      updateSearchFilter("chapter", event.target.value)
                    }
                  />
                </label>
              </div>
              <div className="question-search-time-group">
                <span>创建时间</span>
                <input
                  type="datetime-local"
                  value={searchFilters.createdAtFrom}
                  onChange={(event) =>
                    updateSearchFilter("createdAtFrom", event.target.value)
                  }
                />
                <input
                  type="datetime-local"
                  value={searchFilters.createdAtTo}
                  onChange={(event) =>
                    updateSearchFilter("createdAtTo", event.target.value)
                  }
                />
              </div>
              <div className="question-search-time-group">
                <span>修改时间</span>
                <input
                  type="datetime-local"
                  value={searchFilters.updatedAtFrom}
                  onChange={(event) =>
                    updateSearchFilter("updatedAtFrom", event.target.value)
                  }
                />
                <input
                  type="datetime-local"
                  value={searchFilters.updatedAtTo}
                  onChange={(event) =>
                    updateSearchFilter("updatedAtTo", event.target.value)
                  }
                />
              </div>
              <label className="question-search-field detail-field">
                <span>详细属性</span>
                <textarea
                  value={searchFilters.detailNotes}
                  onChange={(event) =>
                    updateSearchFilter("detailNotes", event.target.value)
                  }
                />
              </label>
              <div className="question-search-action-row">
                <button type="button" onClick={runQuestionSearch}>
                  查询
                </button>
                <button type="button" onClick={clearQuestionSearch}>
                  清空
                </button>
                <button type="button" onClick={saveQuestionSearchState}>
                  保存
                </button>
                <button type="button" onClick={restoreQuestionSearchState}>
                  恢复
                </button>
              </div>
            </div>
          </section>
        )}

        {activeSearchTab === "convert" && (
          <section className="question-search-panel convert-panel">
            <div className="question-search-form">
              <label className="question-search-field">
                <span>API地址</span>
                <select
                  value={dashscopeBaseUrl}
                  onChange={(event) => setDashscopeBaseUrl(event.target.value)}
                >
                  {DASHSCOPE_BASE_URL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="question-search-field">
                <span>视觉模型</span>
                <select
                  value={dashscopeVisionModel}
                  onChange={(event) =>
                    setDashscopeVisionModel(event.target.value)
                  }
                >
                  {DASHSCOPE_VISION_MODEL_OPTIONS.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </label>
              <label className="question-search-field">
                <span>调用方式</span>
                <select
                  value={dashscopeClient}
                  onChange={(event) => setDashscopeClient(event.target.value)}
                >
                  {DASHSCOPE_CLIENT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="question-search-field">
                <span>转换格式</span>
                <select
                  value={convertOutputFormat}
                  onChange={(event) =>
                    setConvertOutputFormat(event.target.value)
                  }
                >
                  {CONVERT_OUTPUT_FORMAT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="question-convert-image-path">
                {getPathFileName(typstImagePath) || "尚未选择图片"}
              </div>
              <div className="question-search-action-row">
                <button
                  type="button"
                  disabled={isConvertingTypst}
                  onClick={selectTypstImage}
                >
                  选择图片
                </button>
                <button
                  type="button"
                  disabled={!typstImagePath || isConvertingTypst}
                  onClick={convertTypstImage}
                >
                  {isConvertingTypst ? "识别中..." : "开始识别"}
                </button>
              </div>
              {typstConvertResult && (
                <div className="question-convert-result">
                  <div className="question-convert-result-title">转换结果</div>
                  <label className="question-search-field question-convert-preview">
                    <span>
                      {getConvertOutputFormatLabel(
                        typstConvertResult.outputFormat || convertOutputFormat,
                      )}
                      源码预览
                    </span>
                    <textarea
                      readOnly
                      value={
                        typstConvertResult.sourceCode ||
                        typstConvertResult.typstCode ||
                        ""
                      }
                    />
                  </label>
                </div>
              )}
            </div>
          </section>
        )}

        {activeSearchTab === "results" && (
          <section className="question-search-panel result-panel">
            <div className="question-search-result-table-wrap">
            {searchResults.length === 0 ? (
              <div className="question-search-result-placeholder">
                无查询结果
              </div>
            ) : (
              <table className="question-search-result-table">
                <thead>
                  <tr>
                    <th>题目ID</th>
                    <th>科目</th>
                    <th>题型</th>
                    <th>命中内容</th>
                  </tr>
                </thead>
                <tbody>
                  {searchResults.map((result) => (
                    <tr
                      key={result.key}
                      className={
                        result.key === selectedSearchResultKey ? "active" : ""
                      }
                      onClick={() => selectSearchResult(result)}
                      onContextMenu={(event) =>
                        openSearchResultMenu(event, result)
                      }
                    >
                      <td>{result.questionId}</td>
                      <td>{result.businessProps.subject || "-"}</td>
                      <td>
                        {getQuestionTypeLabel(result.businessProps.questionType)}
                      </td>
                      <td>{result.detailHitText || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            </div>
            <div className="question-search-result-action-row">
              <button
                type="button"
                disabled={!questionId || isExportingQuestion}
                onClick={() => openExportDialog("current")}
              >
                导出
              </button>
              <button
                type="button"
                disabled={searchResults.length === 0 || isExportingQuestion}
                onClick={() => openExportDialog("all")}
              >
                全部导出
              </button>
            </div>
          </section>
        )}

        <button
          type="button"
          className="question-browse-return-button"
          onClick={onExitQuery}
        >
          退出查询
        </button>
      </aside>

      <main className="question-browse-main">
        {!questionId && (
          <div className="question-browse-empty">
            请输入 questionId 以浏览题干和答案。
          </div>
        )}

        {questionId && (
        <div
          className={`question-browse-content ${
            isDraggingSplitter ? "dragging-splitter" : ""
          }`}
          ref={contentRef}
        >
          <section
            className="question-browse-stem-pane"
            style={{ flexBasis: `${stemPercent}%` }}
            onContextMenu={(event) => openLayoutMenu(event, "stem")}
          >
            <div className="question-browse-pane-title">题干</div>
            <div className="question-browse-pane-body">
              <PdfCompositeRegionView
                ref={stemCompositeRef}
                pdfDoc={pdfDoc}
                pdfDocsByTabId={pdfDocsByTabId}
                regions={questionRegions.stemRegions}
                mode="compose"
                layoutMode={stemLayoutMode}
                regionGap={stemRegionGap}
                exportFileName={`${exportFilePrefix}_stem.png`}
                className="question-browse-region-view"
              />
            </div>
          </section>

          <div
            className="question-browse-splitter"
            onMouseDown={handleSplitterMouseDown}
          />

          <section
            className="question-browse-answer-pane"
            onContextMenu={(event) => openLayoutMenu(event, "answer")}
          >
            <div className="question-browse-pane-title">答案</div>
            <div className="question-browse-pane-body">
              {(relatedErrors.length > 0 ||
                relatedWarnings.length > 0 ||
                missingRelatedFiles.length > 0) && (
                <div className="question-browse-related-status">
                  {relatedErrors.map((message) => (
                    <div key={`error:${message}`} className="error">
                      {message}
                    </div>
                  ))}
                  {relatedWarnings.map((message) => (
                    <div key={`warning:${message}`}>{message}</div>
                  ))}
                  {missingRelatedFiles.map((file) => (
                    <div key={file.pdfPath}>
                      正在准备关联文件：{file.fileName}
                    </div>
                  ))}
                </div>
              )}
              {activeAnswerGroup ? (
                <PdfCompositeRegionView
                  ref={answerCompositeRef}
                  pdfDoc={pdfDoc}
                  pdfDocsByTabId={pdfDocsByTabId}
                  regions={activeAnswerGroup.regions}
                  mode="compose"
                  layoutMode={activeAnswerLayoutMode}
                  regionGap={activeAnswerRegionGap}
                  exportFileName={`${exportFilePrefix}_answer_${activeAnswerSolutionNo}.png`}
                  className="question-browse-region-view"
                />
              ) : (
                <div className="question-browse-empty compact">
                  未找到答案矩形。
                </div>
              )}
            </div>

            <div className="question-answer-tab-list" role="tablist">
              {questionRegions.answerGroups.length === 0 && (
                <div className="question-answer-tab-empty">No answers</div>
              )}
              {questionRegions.answerGroups.map((group) => {
                const isActive =
                  group.solutionNo ===
                  (activeAnswerGroup?.solutionNo || group.solutionNo);

                return (
                  <button
                    key={group.solutionNo}
                    type="button"
                    role="tab"
                    className={`question-answer-tab ${
                      isActive ? "active" : ""
                    }`}
                    onClick={() => setActiveSolutionNo(group.solutionNo)}
                  >
                    解法 {group.solutionNo}
                  </button>
                );
              })}
            </div>
          </section>
        </div>
        )}
      </main>

      {exportDialogOpen && (
        <div className="question-export-dialog-shell">
          <div
            className="question-export-dialog-backdrop"
            onMouseDown={() => {
              if (!isExportingQuestion) setExportDialogOpen(false);
            }}
          />
          <section className="question-export-dialog">
            <header className="question-export-dialog-header">
              <div className="question-export-dialog-title">
                {getExportDialogTitle()}
              </div>
              <div className="question-export-dialog-subtitle">
                {getExportDialogSubtitle()}
              </div>
            </header>
            <div className="question-export-dialog-body">
              {exportDialogMode === "all" ? (
                <div>题目数量：{searchResults.length}</div>
              ) : exportDialogMode === "component" ? (
                <>
                  <div>
                    区域：{componentExportTarget === "stem" ? "题干" : "答案"}
                  </div>
                  <div>题目ID：{questionId || "-"}</div>
                </>
              ) : (
                <>
                  <div>题目ID：{questionId || "-"}</div>
                  <div>
                    题干：{questionRegions.stemRegions.length > 0 ? "1 份" : "无"}
                  </div>
                  <div>答案：{questionRegions.answerGroups.length} 份</div>
                </>
              )}
              <div>目录：{exportOutputDir || "默认 output_picture / 待选择"}</div>
            </div>
            <footer className="question-export-dialog-footer">
              <button
                type="button"
                disabled={isExportingQuestion}
                onClick={() => setExportDialogOpen(false)}
              >
                放弃
              </button>
              <button
                type="button"
                className="primary"
                disabled={isExportingQuestion}
                onClick={
                  exportDialogMode === "all"
                    ? exportAllSearchResultImages
                    : exportDialogMode === "component"
                      ? exportCurrentComponentImage
                    : exportCurrentQuestionImages
                }
              >
                {isExportingQuestion
                  ? "导出中..."
                  : exportDialogMode === "all"
                    ? "全部导出"
                    : exportDialogMode === "component"
                      ? "导出"
                    : "导出"}
              </button>
            </footer>
          </section>
        </div>
      )}

      {layoutMenu && (
        <div
          className="question-layout-context-menu"
          style={{ left: layoutMenu.x, top: layoutMenu.y }}
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          {LAYOUT_MODE_OPTIONS.map((option) => {
            const currentMode =
              layoutMenu.target === "stem"
                ? stemLayoutMode
                : answerLayoutModes[layoutMenu.solutionNo] || "auto";

            return (
              <button
                key={option.value}
                type="button"
                className={currentMode === option.value ? "active" : ""}
                onClick={() => applyLayoutMode(option.value)}
              >
                {option.label}
              </button>
            );
          })}
          <div className="question-layout-context-menu-divider" />
          <div className="question-layout-context-menu-label">
            临时间距
          </div>
          <div className="question-layout-gap-grid">
            {REGION_GAP_OPTIONS.map((gap) => (
              <button
                key={gap}
                type="button"
                className={getLayoutMenuGapValue() === gap ? "active" : ""}
                onClick={() => applyRegionGapOverride(gap)}
              >
                {gap}
              </button>
            ))}
          </div>
          <button type="button" onClick={clearRegionGapOverride}>
            清除临时间距
          </button>
          <button type="button" onClick={saveRegionGapAsDefault}>
            设为系统默认值
          </button>
          <div className="question-layout-context-menu-divider" />
          <button type="button" onClick={exportLayoutMenuCompositeImage}>
            导出当前组件图片
          </button>
        </div>
      )}

      {searchResultMenu && (
        <div
          className="question-search-result-context-menu"
          style={{ left: searchResultMenu.x, top: searchResultMenu.y }}
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          <button type="button" onClick={jumpToSearchResultSource}>
            跳转到源 PDF
          </button>
        </div>
      )}
    </section>
  );
}
