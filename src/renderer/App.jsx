import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFilePdf,
  faGear,
  faLayerGroup,
} from "@fortawesome/free-solid-svg-icons";
import { pdfjs } from "react-pdf";
import ShapePropertyEditor from "./components/ShapePropertyEditor";
import PdfMainView from "./components/PdfMainView";
import "./App.css";
import sourceMetadataText from "./dummy_53_math_required1_metadata.md?raw";
import { getQuestionListForPdfPage, parseSourceMetadata } from "./utilities";
import { getDefaultBusinessProps } from "./shapeProperties/shapePropertyDefaults";
import { shapePropertySchemas } from "./shapeProperties/shapePropertySchemas";
import {
  getShapeBusinessProps,
  updateShapeBusinessPropsInList,
} from "./shapeProperties/shapePropertyUtils";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

pdfjs.GlobalWorkerOptions.cMapUrl = "/cmaps/";
pdfjs.GlobalWorkerOptions.cMapPacked = true;

export default function App() {
  const DEFAULT_SECONDARY_WIDTH = 260;
  const leftTabs = [
    { id: "tools", label: "PDF Tools", icon: faFilePdf },
    { id: "layers", label: "Layers", icon: faLayerGroup },
    { id: "settings", label: "Settings", icon: faGear },
  ];
  const rightTabs = [
    { id: "tools", label: "Right Tools", icon: faGear },
    { id: "layers", label: "Inspect", icon: faLayerGroup },
    { id: "settings", label: "Settings", icon: faFilePdf },
  ];

  const [pdfObjectUrl, setPdfObjectUrl] = useState("");
  const [pdfName, setPdfName] = useState("");
  const [pdfPath, setPdfPath] = useState("");
  const [pdfJsonPath, setPdfJsonPath] = useState("");
  const [displayPdf, setDisplayPdf] = useState(false);
  const [pdfTabs, setPdfTabs] = useState([]);
  const [activePdfTabId, setActivePdfTabId] = useState(null);
  const [recentFiles, setRecentFiles] = useState([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [debugMessages, setDebugMessages] = useState([]);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageInputValue, setPageInputValue] = useState("1");
  const [totalPages, setTotalPages] = useState(0);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState(1);
  const [autoScaleDone, setAutoScaleDone] = useState(false);

  const mainViewRef = useRef(null);
  const mainViewInnerRef = useRef(null);
  const secondaryViewRef = useRef(null);
  const regionCanvasRef = useRef(null);
  const konvaStageRef = useRef(null);
  const pdfDocRef = useRef(null);
  const drawStartRef = useRef(null);
  const dragShapeRef = useRef(null);
  const pendingZoomCenterRef = useRef(null);
  const middlePanRef = useRef(null);
  const questionSegmentIdRef = useRef(null);
  const latestWorkspaceRef = useRef(null);
  const isHydratingPdfTabRef = useRef(false);
  const pdfTabsRef = useRef([]);
  const currentPdfTabSnapshotRef = useRef(null);
  const pdfDataByTabIdRef = useRef(new Map());
  const pdfObjectUrlRef = useRef("");

  const [currentRect, setCurrentRect] = useState(null);
  const [currentLine, setCurrentLine] = useState(null);
  const [isDrawingShape, setIsDrawingShape] = useState(false);
  const [isDraggingShape, setIsDraggingShape] = useState(false);
  const [rectangles, setRectangles] = useState([]);
  const [lines, setLines] = useState([]);
  const [detectedRectangles, setDetectedRectangles] = useState([]);
  const [freeRectangles, setFreeRectangles] = useState([]);
  const [selectedShape, setSelectedShape] = useState(null);
  const [selectedRectId, setSelectedRectId] = useState(null);
  const [selectedLineId, setSelectedLineId] = useState(null);
  const [propertyEditorShape, setPropertyEditorShape] = useState(null);

  const [secondaryWidth, setSecondaryWidth] = useState(DEFAULT_SECONDARY_WIDTH);
  const [contentViewMode, setContentViewMode] = useState("both");
  const [activeLeftTab, setActiveLeftTab] = useState("tools");
  const [activeRightTab, setActiveRightTab] = useState("tools");
  const [isDraggingSplitter, setIsDraggingSplitter] = useState(false);
  const [isMiddlePanning, setIsMiddlePanning] = useState(false);
  const [questionSegmentInfo, setQuestionSegmentInfo] = useState(null);
  const [questionItems, setQuestionItems] = useState([]);
  const dragStartX = useRef(0);
  const startSecondaryWidth = useRef(DEFAULT_SECONDARY_WIDTH);

  const sourceMetadata = useMemo(
    () => parseSourceMetadata(sourceMetadataText),
    [],
  );
  function addDebugMessage(message, detail) {
    const timestamp = new Date().toLocaleTimeString();
    const detailText =
      detail === undefined
        ? ""
        : ` ${typeof detail === "string" ? detail : JSON.stringify(detail)}`;
    const line = `${timestamp} ${message}${detailText}`;

    console.log("[pdf-debug]", message, detail ?? "");
    setDebugMessages((oldMessages) => [...oldMessages.slice(-11), line]);
  }

  function formatBytes(byteLength) {
    if (!Number.isFinite(byteLength)) return "unknown";
    return `${(byteLength / 1024 / 1024).toFixed(2)}MB`;
  }

  function getPdfDataByteLength(pdfData) {
    return pdfData?.byteLength || pdfData?.length || 0;
  }
  function createPdfTabId(pdfPathValue) {
    return `${pdfPathValue || "pdf"}-${Date.now()}`;
  }

  function getCurrentPdfTabSnapshot(overrides = {}) {
    return {
      id: activePdfTabId,
      pdfName,
      pdfPath,
      pdfJsonPath,
      displayPdf,
      hasUnsavedChanges,
      saveStatus,
      currentPage,
      pageInputValue,
      totalPages,
      pageSize,
      scale,
      autoScaleDone,
      currentRect,
      currentLine,
      isDrawingShape,
      isDraggingShape,
      rectangles,
      lines,
      detectedRectangles,
      freeRectangles,
      selectedShape,
      selectedRectId,
      selectedLineId,
      propertyEditorShape,
      questionSegmentInfo,
      questionItems,
      ...overrides,
    };
  }

  function updatePdfTabs(nextTabs) {
    pdfTabsRef.current = nextTabs;
    setPdfTabs(nextTabs);
  }

  function clearPdfObjectUrl() {
    if (pdfObjectUrlRef.current) {
      URL.revokeObjectURL(pdfObjectUrlRef.current);
      pdfObjectUrlRef.current = "";
    }
    setPdfObjectUrl("");
  }

  function setCurrentPdfObjectUrlFromTab(tabId) {
    const sourceData = pdfDataByTabIdRef.current.get(tabId);

    if (!sourceData) {
      addDebugMessage("pdf-url:missing", { tabId });
      clearPdfObjectUrl();
      return;
    }

    addDebugMessage("pdf-url:create:start", {
      tabId,
      size: formatBytes(getPdfDataByteLength(sourceData)),
    });
    clearPdfObjectUrl();
    const blob = new Blob([sourceData], { type: "application/pdf" });
    const nextUrl = URL.createObjectURL(blob);

    pdfObjectUrlRef.current = nextUrl;
    setPdfObjectUrl(nextUrl);
    addDebugMessage("pdf-url:create:queued", { tabId });
  }

  function commitActivePdfTabSnapshot(overrides = {}) {
    if (!activePdfTabId) return;

    const snapshot = getCurrentPdfTabSnapshot({
      id: activePdfTabId,
      ...overrides,
    });

    currentPdfTabSnapshotRef.current = snapshot;
    pdfTabsRef.current = pdfTabsRef.current.map((tab) =>
      tab.id === activePdfTabId ? { ...tab, ...snapshot } : tab,
    );
  }

  function getOpenedPdfTab(result, workspace) {
    return {
      ...getCurrentPdfTabSnapshot({
        id: createPdfTabId(result.pdfPath),
        pdfName: result.pdfName || "",
        pdfPath: result.pdfPath || "",
        pdfJsonPath: result.pdfJsonPath || "",
        displayPdf: true,
        hasUnsavedChanges: false,
        saveStatus: result.pdfJson ? "Loaded .pdfJson" : "No .pdfJson found",
        currentPage: 1,
        pageInputValue: "1",
        totalPages: 0,
        pageSize: { width: 0, height: 0 },
        scale: 1,
        autoScaleDone: false,
        currentRect: null,
        currentLine: null,
        isDrawingShape: false,
        isDraggingShape: false,
        rectangles: workspace.rectangles,
        lines: workspace.lines,
        detectedRectangles: workspace.detectedRectangles,
        freeRectangles: workspace.freeRectangles,
        selectedShape: null,
        selectedRectId: null,
        selectedLineId: null,
        propertyEditorShape: null,
        questionSegmentInfo: null,
        questionItems: [],
      }),
    };
  }

  function hydratePdfTab(tab, options = {}) {
    const { hydratePdfFile = true } = options;

    isHydratingPdfTabRef.current = true;
    setDisplayPdf(Boolean(tab?.displayPdf));
    if (hydratePdfFile) {
      setCurrentPdfObjectUrlFromTab(tab?.id);
    } else {
      clearPdfObjectUrl();
    }
    pdfDocRef.current = null;
    setPdfName(tab?.pdfName || "");
    setPdfPath(tab?.pdfPath || "");
    setPdfJsonPath(tab?.pdfJsonPath || "");
    setCurrentPage(tab?.currentPage || 1);
    setPageInputValue(tab?.pageInputValue || "1");
    setTotalPages(tab?.totalPages || 0);
    setPageSize(tab?.pageSize || { width: 0, height: 0 });
    setScale(tab?.scale || 1);
    setAutoScaleDone(Boolean(tab?.autoScaleDone));
    setCurrentRect(tab?.currentRect || null);
    setCurrentLine(tab?.currentLine || null);
    setIsDrawingShape(Boolean(tab?.isDrawingShape));
    setIsDraggingShape(Boolean(tab?.isDraggingShape));
    setRectangles(tab?.rectangles || []);
    setLines(tab?.lines || []);
    setDetectedRectangles(tab?.detectedRectangles || []);
    setFreeRectangles(tab?.freeRectangles || []);
    setSelectedShape(tab?.selectedShape || null);
    setSelectedRectId(tab?.selectedRectId || null);
    setSelectedLineId(tab?.selectedLineId || null);
    setPropertyEditorShape(tab?.propertyEditorShape || null);
    questionSegmentIdRef.current = null;
    setQuestionSegmentInfo(tab?.questionSegmentInfo || null);
    setQuestionItems(tab?.questionItems || []);
    setHasUnsavedChanges(Boolean(tab?.hasUnsavedChanges));
    setSaveStatus(tab?.saveStatus || "");
    drawStartRef.current = null;
    dragShapeRef.current = null;

    window.setTimeout(() => {
      isHydratingPdfTabRef.current = false;
    }, 0);
  }

  function persistActivePdfTabSnapshot() {
    if (!activePdfTabId) return;

    const snapshot = getCurrentPdfTabSnapshot({ id: activePdfTabId });
    currentPdfTabSnapshotRef.current = snapshot;
    updatePdfTabs(
      pdfTabsRef.current.map((tab) =>
        tab.id === activePdfTabId ? { ...tab, ...snapshot } : tab,
      ),
    );
  }

  function activatePdfTab(tab) {
    if (!tab) return;

    persistActivePdfTabSnapshot();
    setActivePdfTabId(tab.id);
    hydratePdfTab(tab);
  }

  function findOpenedPdfTabByPath(filePath) {
    if (!filePath) return null;

    return pdfTabsRef.current.find((tab) => tab.pdfPath === filePath) || null;
  }

  useEffect(() => {
    latestWorkspaceRef.current = getCurrentWorkspaceData();
  }, [pdfName, pdfPath, rectangles, lines, detectedRectangles, freeRectangles]);

  useEffect(() => {
    if (!activePdfTabId || isHydratingPdfTabRef.current) return;
    commitActivePdfTabSnapshot();
  }, [
    activePdfTabId,
    pdfObjectUrl,
    pdfName,
    pdfPath,
    pdfJsonPath,
    displayPdf,
    hasUnsavedChanges,
    saveStatus,
    currentPage,
    pageInputValue,
    totalPages,
    pageSize,
    scale,
    autoScaleDone,
    currentRect,
    currentLine,
    isDrawingShape,
    isDraggingShape,
    rectangles,
    lines,
    detectedRectangles,
    freeRectangles,
    selectedShape,
    selectedRectId,
    selectedLineId,
    propertyEditorShape,
    questionSegmentInfo,
    questionItems,
  ]);

  const memoFile = useMemo(() => {
    if (!pdfObjectUrl) return null;
    return pdfObjectUrl;
  }, [pdfObjectUrl]);

  function calculateFitScale(pdfWidth, pdfHeight) {
    const mainView = mainViewRef.current;

    if (!mainView) {
      console.warn("[scale] mainViewRef is not ready.");
      return 1;
    }

    const padding = 1;
    const availableWidth = mainView.clientWidth - padding * 2;
    const availableHeight = mainView.clientHeight - padding * 2;

    if (availableWidth <= 0 || availableHeight <= 0) {
      console.warn("[scale] main view size is invalid:", {
        availableWidth,
        availableHeight,
      });
      return 1;
    }

    const scaleX = availableWidth / pdfWidth;
    const scaleY = availableHeight / pdfHeight;
    // const nextScale = Math.min(scaleX, scaleY, 1);
    const nextScale = Math.min(scaleX, scaleY);

    console.log("[scale] calculated fit scale:", {
      pdfWidth,
      pdfHeight,
      availableWidth,
      availableHeight,
      scaleX,
      scaleY,
      nextScale,
    });

    return nextScale;
  }

  function getWorkspaceFromPdfJson(pdfJson) {
    const workspace = pdfJson?.workspace || pdfJson || {};

    return {
      rectangles: Array.isArray(workspace.rectangles)
        ? workspace.rectangles
        : [],
      lines: Array.isArray(workspace.lines) ? workspace.lines : [],
      detectedRectangles: Array.isArray(workspace.detectedRectangles)
        ? workspace.detectedRectangles
        : [],
      freeRectangles: Array.isArray(workspace.freeRectangles)
        ? workspace.freeRectangles
        : [],
    };
  }

  function getCurrentWorkspaceData() {
    return {
      schemaVersion: 1,
      pdf: {
        fileName: pdfName,
        filePath: pdfPath,
      },
      workspace: {
        rectangles,
        lines,
        detectedRectangles,
        freeRectangles,
      },
    };
  }

  function markWorkspaceDirty() {
    setHasUnsavedChanges(true);
    setSaveStatus("Unsaved changes");
  }

  function resetCurrentPdfState() {
    setDisplayPdf(false);
    clearPdfObjectUrl();
    pdfDocRef.current = null;
    setPdfName("");
    setPdfPath("");
    setPdfJsonPath("");
    setCurrentPage(1);
    setPageInputValue("1");
    setTotalPages(0);
    setPageSize({ width: 0, height: 0 });
    setScale(1);
    setAutoScaleDone(false);
    setCurrentRect(null);
    setCurrentLine(null);
    setIsDrawingShape(false);
    setIsDraggingShape(false);
    setRectangles([]);
    setLines([]);
    setDetectedRectangles([]);
    setFreeRectangles([]);
    setSelectedShape(null);
    setSelectedRectId(null);
    setSelectedLineId(null);
    setPropertyEditorShape(null);
    questionSegmentIdRef.current = null;
    setQuestionSegmentInfo(null);
    setQuestionItems([]);
    setHasUnsavedChanges(false);
    setSaveStatus("");
  }

  function applyOpenedPdf(result) {
    addDebugMessage("open:apply:start", {
      name: result.pdfName,
      size: formatBytes(getPdfDataByteLength(result.pdfData)),
    });
    const workspace = getWorkspaceFromPdfJson(result.pdfJson);
    const openedTab = {
      ...getOpenedPdfTab(result, workspace),
      displayPdf: false,
    };
    pdfDataByTabIdRef.current.set(openedTab.id, result.pdfData);
    addDebugMessage("open:cache-stored", { tabId: openedTab.id });
    updatePdfTabs([...pdfTabsRef.current, openedTab]);
    setRecentFiles(result.recentFiles || []);
    setActivePdfTabId(openedTab.id);
    hydratePdfTab(openedTab, { hydratePdfFile: false });
    addDebugMessage("open:hydrated-light", { tabId: openedTab.id });

    window.setTimeout(() => {
      addDebugMessage("open:set-pdf-url-timeout", { tabId: openedTab.id });
      setCurrentPdfObjectUrlFromTab(openedTab.id);

      window.setTimeout(() => {
        const nextTab = {
          ...openedTab,
          displayPdf: true,
        };

        addDebugMessage("open:display-true", { tabId: openedTab.id });
        setDisplayPdf(true);
        currentPdfTabSnapshotRef.current = nextTab;
        pdfTabsRef.current = pdfTabsRef.current.map((tab) =>
          tab.id === nextTab.id ? nextTab : tab,
        );
      }, 50);
    }, 50);
  }

  async function saveCurrentPdfJson() {
    if (!pdfPath || !window.electronPdf) return false;

    try {
      setSaveStatus("Saving...");
      const result = await window.electronPdf.savePdfJson(
        pdfPath,
        latestWorkspaceRef.current || getCurrentWorkspaceData(),
      );
      setPdfJsonPath(result.jsonPath || pdfJsonPath);
      setHasUnsavedChanges(false);
      setSaveStatus("Saved");
      return true;
    } catch (error) {
      console.error("[file] save .pdfJson failed:", error);
      setSaveStatus("Save failed");
      window.alert("Save failed. See console for details.");
      return false;
    }
  }

  async function closeCurrentPdf() {
    if (!pdfPath) return true;

    const canReplace = await prepareCurrentPdfForReplacement();
    if (!canReplace) return false;

    const currentIndex = pdfTabsRef.current.findIndex(
      (tab) => tab.id === activePdfTabId,
    );
    const nextTabs = pdfTabsRef.current.filter(
      (tab) => tab.id !== activePdfTabId,
    );
    const nextActiveTab =
      nextTabs[currentIndex] || nextTabs[currentIndex - 1] || null;

    pdfDataByTabIdRef.current.delete(activePdfTabId);
    updatePdfTabs(nextTabs);

    if (nextActiveTab) {
      setActivePdfTabId(nextActiveTab.id);
      hydratePdfTab(nextActiveTab);
    } else {
      setActivePdfTabId(null);
      resetCurrentPdfState();
    }

    return true;
  }

  async function prepareCurrentPdfForReplacement() {
    if (!pdfPath) return true;

    if (hasUnsavedChanges && window.electronPdf) {
      const action = await window.electronPdf.confirmCloseDirty();

      if (action === "cancel") return false;

      if (action === "save") {
        const saved = await saveCurrentPdfJson();
        if (!saved) return false;
      }
    }

    return true;
  }

  async function handleOpenPdf() {
    if (!window.electronPdf) {
      window.alert("Electron file API is not available.");
      return;
    }

    try {
      addDebugMessage("open:start");
      const result = await window.electronPdf.openPdf();
      addDebugMessage("open:ipc-return", {
        canceled: Boolean(result?.canceled),
        name: result?.pdfName,
        size: formatBytes(getPdfDataByteLength(result?.pdfData)),
      });
      if (result?.recentFiles) {
        setRecentFiles(result.recentFiles);
      }
      if (!result || result.canceled) return;

    const openedTab = findOpenedPdfTabByPath(result.pdfPath);
    if (openedTab) {
        const nextTab = {
          ...openedTab,
          saveStatus: "PDF is already open",
        };
        pdfTabsRef.current = pdfTabsRef.current.map((tab) =>
          tab.id === nextTab.id ? nextTab : tab,
        );
        activatePdfTab(nextTab);
        return;
      }

      applyOpenedPdf(result);
    } catch (error) {
      console.error("[file] open PDF failed:", error);
      addDebugMessage("open:error", error?.message || String(error));
      setSaveStatus("Open failed");
      window.alert("Open PDF failed. See console for details.");
    }
  }

  async function handleOpenRecentPdf(filePath) {
    if (!window.electronPdf) return;
    if (!filePath) return;

    const openedTab = findOpenedPdfTabByPath(filePath);
    if (openedTab) {
      const nextTab = {
        ...openedTab,
        saveStatus: "PDF is already open",
      };
      pdfTabsRef.current = pdfTabsRef.current.map((tab) =>
        tab.id === nextTab.id ? nextTab : tab,
      );
      activatePdfTab(nextTab);
      return;
    }

    try {
      addDebugMessage("recent:start", { filePath });
      const result = await window.electronPdf.openRecentPdf(filePath);
      addDebugMessage("recent:ipc-return", {
        name: result?.pdfName,
        size: formatBytes(getPdfDataByteLength(result?.pdfData)),
      });
      applyOpenedPdf(result);
    } catch (error) {
      console.error("[file] open recent PDF failed:", error);
      addDebugMessage("recent:error", error?.message || String(error));
      setSaveStatus("Open recent failed");
      window.alert("Open recent file failed. See console for details.");
    }
  }

  useEffect(() => {
    if (!window.electronPdf) return;

    window.electronPdf
      .getRecentFiles()
      .then((files) => setRecentFiles(Array.isArray(files) ? files : []))
      .catch((error) => {
        console.error("[file] load recent files failed:", error);
      });
  }, []);

  useEffect(
    () => () => {
      clearPdfObjectUrl();
    },
    [],
  );

  useEffect(() => {
    function handleWindowError(event) {
      addDebugMessage("window:error", event.message || "unknown");
    }

    function handleUnhandledRejection(event) {
      addDebugMessage(
        "window:unhandledrejection",
        event.reason?.message || String(event.reason),
      );
    }

    window.addEventListener("error", handleWindowError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleWindowError);
      window.removeEventListener(
        "unhandledrejection",
        handleUnhandledRejection,
      );
    };
  }, []);

  function handleDocumentLoadSuccess(pdf) {
    console.log("[pdf] document loaded:", {
      totalPages: pdf.numPages,
    });
    addDebugMessage("document:load-success", { totalPages: pdf.numPages });

    pdfDocRef.current = pdf;
    setTotalPages(pdf.numPages);
    if (totalPages <= 0) {
      setCurrentPage(1);
      setPageInputValue("1");
      questionSegmentIdRef.current = null;
    }
  }

  function handlePageLoadSuccess(page) {
    const viewport = page.getViewport({ scale: 1 });

    console.log("[pdf] page loaded:", {
      page: currentPage,
      width: viewport.width,
      height: viewport.height,
    });
    addDebugMessage("page:load-success", {
      page: currentPage,
      width: viewport.width,
      height: viewport.height,
    });

    setPageSize({
      width: viewport.width,
      height: viewport.height,
    });

    if (!autoScaleDone) {
      const nextScale = calculateFitScale(viewport.width, viewport.height);
      setScale(nextScale);
      setAutoScaleDone(true);
      console.log("[pdf] auto fit scale applied:", nextScale);
    }
  }

  function handleDocumentLoadError(error) {
    console.error("[pdf] document load error:", error);
    addDebugMessage("document:load-error", error?.message || String(error));
  }

  function handleDocumentSourceError(error) {
    console.error("[pdf] document source error:", error);
    addDebugMessage("document:source-error", error?.message || String(error));
  }

  function handlePageLoadError(error) {
    console.error("[pdf] page load error:", error);
    addDebugMessage("page:load-error", error?.message || String(error));
  }

  function resetScale() {
    if (!pageSize.width || !pageSize.height) {
      console.warn("[reset] pageSize not ready:", pageSize);
      return;
    }

    const nextScale = calculateFitScale(pageSize.width, pageSize.height);
    setScale(nextScale);
    setAutoScaleDone(true);

    console.log("[reset] scale:", nextScale);
  }

  function getMainViewPdfCenter(scaleValue) {
    const mainView = mainViewRef.current;
    const mainViewInner = mainViewInnerRef.current;

    if (
      !mainView ||
      !mainViewInner ||
      !pageSize.width ||
      !pageSize.height ||
      !scaleValue
    ) {
      return null;
    }

    const pdfDisplayWidth = pageSize.width * scaleValue;
    const pdfDisplayHeight = pageSize.height * scaleValue;
    const pdfOffsetX = Math.max(
      0,
      (mainViewInner.clientWidth - pdfDisplayWidth) / 2,
    );
    const pdfOffsetY = Math.max(
      0,
      (mainViewInner.clientHeight - pdfDisplayHeight) / 2,
    );
    const centerXInInner = mainView.scrollLeft + mainView.clientWidth / 2;
    const centerYInInner = mainView.scrollTop + mainView.clientHeight / 2;

    return {
      x: Math.min(
        pageSize.width,
        Math.max(0, (centerXInInner - pdfOffsetX) / scaleValue),
      ),
      y: Math.min(
        pageSize.height,
        Math.max(0, (centerYInInner - pdfOffsetY) / scaleValue),
      ),
    };
  }

  function zoomIn() {
    setScale((oldScale) => {
      const nextScale = oldScale * 1.2;
      pendingZoomCenterRef.current = getMainViewPdfCenter(oldScale);
      console.log("[zoom] in:", nextScale);
      return nextScale;
    });
    setAutoScaleDone(true);
  }

  function zoomOut() {
    setScale((oldScale) => {
      const nextScale = oldScale / 1.2;
      pendingZoomCenterRef.current = getMainViewPdfCenter(oldScale);
      console.log("[zoom] out:", nextScale);
      return nextScale;
    });
    setAutoScaleDone(true);
  }

  function resetPageInteractionState() {
    setCurrentRect(null);
    setCurrentLine(null);
    setIsDrawingShape(false);
    setIsDraggingShape(false);
    setSelectedShape(null);
    setSelectedRectId(null);
    setSelectedLineId(null);
    setPropertyEditorShape(null);
    drawStartRef.current = null;
    dragShapeRef.current = null;
  }

  function goToPage(pageNumber) {
    if (
      !Number.isInteger(pageNumber) ||
      pageNumber < 1 ||
      pageNumber > totalPages ||
      pageNumber === currentPage
    ) {
      setPageInputValue(String(currentPage));
      return;
    }

    console.log("[page] goto:", pageNumber);
    setCurrentPage(pageNumber);
    resetPageInteractionState();
  }

  function commitPageInput() {
    const nextPage = Number(pageInputValue);
    goToPage(nextPage);
  }

  function handlePageInputChange(e) {
    const nextValue = e.target.value;

    if (/^\d*$/.test(nextValue)) {
      setPageInputValue(nextValue);
    }
  }

  function handlePageInputKeyDown(e) {
    if (e.key === "Enter") {
      commitPageInput();
      e.currentTarget.blur();
    }
  }

  function handleMainViewMouseDown(e) {
    if (e.button !== 1 || !mainViewRef.current) return;

    middlePanRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: mainViewRef.current.scrollLeft,
      scrollTop: mainViewRef.current.scrollTop,
    };
    setIsMiddlePanning(true);
    e.preventDefault();
  }

  function handleMainViewMouseMove(e) {
    const panState = middlePanRef.current;
    const mainView = mainViewRef.current;

    if (!panState || !mainView) return;

    mainView.scrollLeft = panState.scrollLeft - (e.clientX - panState.startX);
    mainView.scrollTop = panState.scrollTop - (e.clientY - panState.startY);
    e.preventDefault();
  }

  function stopMiddlePan() {
    if (!middlePanRef.current) return;

    middlePanRef.current = null;
    setIsMiddlePanning(false);
  }

  function prevPage() {
    const next = Math.max(1, currentPage - 1);
    console.log("[page] prev:", next);
    setCurrentPage(next);
    resetPageInteractionState();
  }

  function nextPage() {
    const next = Math.min(totalPages, currentPage + 1);
    console.log("[page] next:", next);
    setCurrentPage(next);
    resetPageInteractionState();
  }

  function handleSplitterMouseDown(e) {
    if (contentViewMode !== "both") return;

    setIsDraggingSplitter(true);
    dragStartX.current = e.clientX;
    startSecondaryWidth.current = secondaryWidth;

    console.log("[splitter] start:", {
      x: e.clientX,
      secondaryWidth,
    });

    e.preventDefault();
  }

  useEffect(() => {
    function handleMouseMove(e) {
      if (!isDraggingSplitter) return;

      const dx = e.clientX - dragStartX.current;
      const nextWidth = Math.max(0, startSecondaryWidth.current - dx);

      setSecondaryWidth(nextWidth);
    }

    function handleMouseUp() {
      if (isDraggingSplitter) {
        console.log("[splitter] end");
      }

      setIsDraggingSplitter(false);
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [contentViewMode, isDraggingSplitter]);

  function toggleContentView() {
    setContentViewMode((oldMode) => {
      if (oldMode === "both") return "mainOnly";
      if (oldMode === "mainOnly") return "secondaryOnly";
      return "both";
    });
  }

  function handleStageContextMenu(e) {
    e.evt.preventDefault();
  }

  function handleStageDoubleClick(e) {
    const stage = konvaStageRef.current;
    if (!stage) return;

    const pos = stage.getPointerPosition();
    if (!pos) return;

    const pagePoint = {
      x: pos.x / scale,
      y: pos.y / scale,
    };

    if (!isPointInSelectedEditHotZone(pagePoint)) return;

    e.evt.preventDefault();
    setPropertyEditorShape({ ...selectedShape });
  }

  function handleStageMouseDown(e) {
    const stage = konvaStageRef.current;
    if (!stage) return;

    const pos = stage.getPointerPosition();
    if (!pos) return;
    e.evt.preventDefault();

    const button = e.evt.button;

    const pagePoint = {
      x: pos.x / scale,
      y: pos.y / scale,
    };

    if (button === 0) {
      const dragTarget = findSelectedDragHotZone(pagePoint);

      if (dragTarget) {
        dragShapeRef.current = {
          type: dragTarget.type,
          id: dragTarget.shape.id,
          action: dragTarget.action,
          handle: dragTarget.handle,
          startPoint: pagePoint,
          originalShape: { ...dragTarget.shape },
        };
        drawStartRef.current = null;
        setCurrentRect(null);
        setCurrentLine(null);
        setIsDrawingShape(false);
        setIsDraggingShape(true);
        return;
      }

      const hitRect = findLeftBorderHitRect(pagePoint);

      if (hitRect) {
        setSelectedShape({ type: hitRect.shapeType, id: hitRect.id });
        setSelectedRectId(hitRect.id);
        setCurrentRect(null);
        setCurrentLine(null);
        setIsDrawingShape(false);
        setIsDraggingShape(false);
        drawStartRef.current = null;
        return;
      }

      const hitLine = findHitLine(pagePoint);

      if (hitLine) {
        setSelectedShape({ type: "line", id: hitLine.id });
        setSelectedLineId(hitLine.id);
        setCurrentRect(null);
        setCurrentLine(null);
        setIsDrawingShape(false);
        setIsDraggingShape(false);
        drawStartRef.current = null;
        return;
      }
    }

    if (button !== 0 && button !== 2) return;

    drawStartRef.current = {
      button,
      x: pagePoint.x,
      y: pagePoint.y,
      lastPoint: pagePoint,
      draftType: null,
      draftShape: null,
    };
    setSelectedShape(null);
    setCurrentRect(null);
    setCurrentLine(null);
    setIsDrawingShape(true);
    setIsDraggingShape(false);
  }

  function handleStageMouseMove() {
    const stage = konvaStageRef.current;
    const dragState = dragShapeRef.current;
    if (stage && dragState) {
      const pos = stage.getPointerPosition();
      if (!pos) return;

      const pagePoint = {
        x: pos.x / scale,
        y: pos.y / scale,
      };
      const dx = pagePoint.x - dragState.startPoint.x;
      const dy = pagePoint.y - dragState.startPoint.y;

      moveDraggedShape(dragState, dx, dy);
      return;
    }

    const start = drawStartRef.current;
    if (!stage || !start) return;

    const pos = stage.getPointerPosition();
    if (!pos) return;

    const pagePoint = {
      x: pos.x / scale,
      y: pos.y / scale,
    };
    start.lastPoint = pagePoint;

    const lineDraft = getLineDraftFromDrag(start, pagePoint);

    if (lineDraft) {
      start.draftType = "line";
      start.draftShape = lineDraft;
      setCurrentLine(lineDraft);
      setCurrentRect(null);
      return;
    }

    const nextRect = {
      x: start.x,
      y: start.y,
      width: pagePoint.x - start.x,
      height: pagePoint.y - start.y,
    };

    start.draftType = start.button === 2 ? "freeRect" : "rect";
    start.draftShape = nextRect;
    setCurrentRect(nextRect);
    setCurrentLine(null);
  }

  function handleStageMouseUp() {
    if (dragShapeRef.current) {
      dragShapeRef.current = null;
      setIsDraggingShape(false);
      markWorkspaceDirty();
      return;
    }

    const draft = drawStartRef.current;
    const stage = konvaStageRef.current;
    const pos = stage?.getPointerPosition();

    if (!draft || !stage || !pos) {
      drawStartRef.current = null;
      setCurrentRect(null);
      setCurrentLine(null);
      setIsDrawingShape(false);
      return;
    }

    const endPoint = {
      x: pos.x / scale,
      y: pos.y / scale,
    };
    const finalLine = getLineDraftFromDrag(draft, endPoint);
    const finalType = finalLine
      ? "line"
      : draft.button === 2
        ? "freeRect"
        : "rect";
    const finalShape = finalLine || {
      x: draft.x,
      y: draft.y,
      width: endPoint.x - draft.x,
      height: endPoint.y - draft.y,
    };

    if (finalType === "line" && finalShape) {
      const normalizedLine = normalizeLine(finalShape);

      if (getLineLength(normalizedLine) > 3) {
        const nextLine = {
          ...normalizedLine,
          id: Date.now(),
          page: currentPage,
          businessProps: getDefaultBusinessProps("line"),
        };

        setLines((oldLines) => [...oldLines, nextLine]);
        setSelectedShape({ type: "line", id: nextLine.id });
        setSelectedLineId(nextLine.id);
        markWorkspaceDirty();
      }

      setCurrentLine(null);
      setIsDrawingShape(false);
      drawStartRef.current = null;
      return;
    }

    const normalizedRect = normalizeRect(finalShape);

    console.log("[rect] finish:", normalizedRect);

    if (normalizedRect.width > 3 && normalizedRect.height > 3) {
      const nextRect = {
        ...normalizedRect,
        id: Date.now(),
        page: currentPage,
        businessProps: getDefaultBusinessProps(finalType),
      };

      if (finalType === "freeRect") {
        setFreeRectangles((oldRectangles) => [...oldRectangles, nextRect]);
      } else {
        setRectangles((oldRectangles) => [...oldRectangles, nextRect]);
      }
      setSelectedShape({ type: finalType, id: nextRect.id });
      setSelectedRectId(nextRect.id);
      markWorkspaceDirty();
    }

    setCurrentRect(null);
    setIsDrawingShape(false);
    drawStartRef.current = null;
  }

  function normalizeRect(rect) {
    const x1 = rect.x;
    const y1 = rect.y;
    const x2 = rect.x + rect.width;
    const y2 = rect.y + rect.height;

    return {
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1),
    };
  }

  function getLineDraftFromDrag(start, point) {
    const dx = point.x - start.x;
    const dy = point.y - start.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    const tolerance = 6 / scale;
    const ratioThreshold = 8;

    if (
      start.button === 2 &&
      absDx > tolerance &&
      (absDy <= tolerance || absDx / Math.max(absDy, 1) >= ratioThreshold)
    ) {
      return {
        orientation: "horizontal",
        x1: start.x,
        y1: start.y,
        x2: point.x,
        y2: start.y,
      };
    }

    if (start.button === 2) {
      return null;
    }

    if (
      absDy > tolerance &&
      (absDx <= tolerance || absDy / Math.max(absDx, 1) >= ratioThreshold)
    ) {
      return {
        orientation: "vertical",
        x1: start.x,
        y1: start.y,
        x2: start.x,
        y2: point.y,
      };
    }

    if (absDx > tolerance && absDx / Math.max(absDy, 1) >= ratioThreshold) {
      return {
        orientation: "horizontal",
        x1: start.x,
        y1: start.y,
        x2: point.x,
        y2: start.y,
      };
    }

    return null;
  }

  function normalizeLine(line) {
    if (line.orientation === "horizontal") {
      return {
        ...line,
        x1: Math.min(line.x1, line.x2),
        x2: Math.max(line.x1, line.x2),
      };
    }

    return {
      ...line,
      y1: Math.min(line.y1, line.y2),
      y2: Math.max(line.y1, line.y2),
    };
  }

  function getLineLength(line) {
    return Math.hypot(line.x2 - line.x1, line.y2 - line.y1);
  }

  function toPdfCoordinates(rect) {
    return {
      x: rect.x,
      y: pageSize.height - rect.y - rect.height,
      width: rect.width,
      height: rect.height,
    };
  }

  function toPdfLineCoordinates(line) {
    return {
      x1: line.x1,
      y1: pageSize.height - line.y1,
      x2: line.x2,
      y2: pageSize.height - line.y2,
    };
  }

  function formatNumber(value) {
    return Number.isFinite(value) ? value.toFixed(2) : "0.00";
  }

  function isPointOnLeftBorder(point, rect) {
    const tolerance = 6 / scale;
    const withinX = Math.abs(point.x - rect.x) <= tolerance;
    const withinY =
      point.y >= rect.y - tolerance &&
      point.y <= rect.y + rect.height + tolerance;

    return withinX && withinY;
  }

  function findLeftBorderHitRect(point) {
    const manualRects = visibleRectangles.map((rect) => ({
      ...rect,
      shapeType: "rect",
    }));
    const freeRects = visibleFreeRectangles.map((rect) => ({
      ...rect,
      shapeType: "freeRect",
    }));
    const detectedRects = visibleDetectedRectangles.map((rect) => ({
      ...rect,
      shapeType: "detectedRect",
    }));
    const hitRects = [...manualRects, ...detectedRects, ...freeRects]
      .reverse()
      .filter((rect) => isPointOnLeftBorder(point, rect));

    if (hitRects.length === 0) return null;

    return hitRects.reduce((bestRect, rect) => {
      const bestDistance = Math.abs(
        point.y - (bestRect.y + bestRect.height / 2),
      );
      const rectDistance = Math.abs(point.y - (rect.y + rect.height / 2));

      return rectDistance < bestDistance ? rect : bestRect;
    });
  }

  function isPointNearLine(point, line) {
    const tolerance = 6 / scale;

    if (line.orientation === "horizontal") {
      const minX = Math.min(line.x1, line.x2) - tolerance;
      const maxX = Math.max(line.x1, line.x2) + tolerance;
      return (
        point.x >= minX &&
        point.x <= maxX &&
        Math.abs(point.y - line.y1) <= tolerance
      );
    }

    const minY = Math.min(line.y1, line.y2) - tolerance;
    const maxY = Math.max(line.y1, line.y2) + tolerance;
    return (
      point.y >= minY &&
      point.y <= maxY &&
      Math.abs(point.x - line.x1) <= tolerance
    );
  }

  function getLineMidpoint(line) {
    return {
      x: (line.x1 + line.x2) / 2,
      y: (line.y1 + line.y2) / 2,
    };
  }

  function getDistance(pointA, pointB) {
    return Math.hypot(pointA.x - pointB.x, pointA.y - pointB.y);
  }

  function findSelectedDragHotZone(point) {
    if (!selectedShape || selectedShape.type === "detectedRect") return null;

    if (selectedShape.type === "rect" || selectedShape.type === "freeRect") {
      const rect =
        selectedShape.type === "freeRect"
          ? freeRectangles.find((item) => item.id === selectedShape.id)
          : rectangles.find((item) => item.id === selectedShape.id);
      if (!rect) return null;

      const resizeHandle = findRectResizeHandle(point, rect);
      if (resizeHandle) {
        return {
          type: selectedShape.type,
          action: "resize",
          handle: resizeHandle,
          shape: rect,
        };
      }

      if (!isPointInRectDragHotZone(point, rect)) return null;

      return {
        type: selectedShape.type,
        action: "move",
        handle: null,
        shape: rect,
      };
    }

    if (selectedShape.type === "line") {
      const line = lines.find((item) => item.id === selectedShape.id);
      if (!line) return null;

      const resizeHandle = findLineResizeHandle(point, line);
      if (resizeHandle) {
        return {
          type: "line",
          action: "resize",
          handle: resizeHandle,
          shape: line,
        };
      }

      if (!isPointNearLine(point, line)) return null;

      return {
        type: "line",
        action: "move",
        handle: null,
        shape: line,
      };
    }

    return null;
  }

  function isPointInSelectedEditHotZone(point) {
    if (!selectedShape) return false;

    if (
      selectedShape.type === "rect" ||
      selectedShape.type === "freeRect" ||
      selectedShape.type === "detectedRect"
    ) {
      const rect = getShapeByRef(selectedShape);
      if (!rect) return false;

      return (
        isPointInRectDragHotZone(point, rect) ||
        Boolean(findRectResizeHandle(point, rect)) ||
        isPointOnLeftBorder(point, rect)
      );
    }

    if (selectedShape.type === "line") {
      const line = getShapeByRef(selectedShape);
      if (!line) return false;

      return (
        isPointNearLine(point, line) ||
        Boolean(findLineResizeHandle(point, line))
      );
    }

    return false;
  }

  function isPointInRectDragHotZone(point, rect) {
    const hotZone = getRectDragHotZone(rect);

    return isPointInsideBox(point, hotZone);
  }

  function findRectResizeHandle(point, rect) {
    const handles = getRectResizeHandleHitZones(rect);
    const hitHandle = handles.find((handle) => isPointInsideBox(point, handle));

    return hitHandle?.name || null;
  }

  function findLineResizeHandle(point, line) {
    const handles = getLineResizeHandleHitZones(line);
    const hitHandle = handles.find((handle) => isPointInsideBox(point, handle));

    return hitHandle?.name || null;
  }

  function isPointInsideBox(point, box) {
    return (
      point.x >= box.x &&
      point.x <= box.x + box.width &&
      point.y >= box.y &&
      point.y <= box.y + box.height
    );
  }

  function getRectDragHotZone(rect) {
    const tolerance = 8 / scale;

    return {
      x: rect.x - tolerance,
      y: rect.y - tolerance,
      width: tolerance * 2,
      height: rect.height + tolerance * 2,
    };
  }

  function getResizeHandleSize() {
    return 8 / scale;
  }

  function getResizeHandleHitSize() {
    return 20 / scale;
  }

  function getRectResizeHandles(rect) {
    const size = getResizeHandleSize();

    return getRectResizeHandleBoxes(rect, size);
  }

  function getRectResizeHandleHitZones(rect) {
    const size = getResizeHandleHitSize();

    return getRectResizeHandleBoxes(rect, size);
  }

  function getRectResizeHandleBoxes(rect, size) {
    return [
      {
        name: "topRight",
        x: rect.x + rect.width - size / 2,
        y: rect.y - size / 2,
        width: size,
        height: size,
      },
      {
        name: "bottomRight",
        x: rect.x + rect.width - size / 2,
        y: rect.y + rect.height - size / 2,
        width: size,
        height: size,
      },
    ];
  }

  function getLineDragHotZone(line) {
    const tolerance = 8 / scale;

    if (line.orientation === "horizontal") {
      const x = Math.min(line.x1, line.x2);
      const width = Math.abs(line.x2 - line.x1);

      return {
        x,
        y: line.y1 - tolerance,
        width,
        height: tolerance * 2,
      };
    }

    const y = Math.min(line.y1, line.y2);
    const height = Math.abs(line.y2 - line.y1);

    return {
      x: line.x1 - tolerance,
      y,
      width: tolerance * 2,
      height,
    };
  }

  function getLineResizeHandles(line) {
    const size = getResizeHandleSize();

    return getLineResizeHandleBoxes(line, size);
  }

  function getLineResizeHandleHitZones(line) {
    const size = getResizeHandleHitSize();

    return getLineResizeHandleBoxes(line, size);
  }

  function getLineResizeHandleBoxes(line, size) {
    return [
      {
        name: "start",
        x: line.x1 - size / 2,
        y: line.y1 - size / 2,
        width: size,
        height: size,
      },
      {
        name: "end",
        x: line.x2 - size / 2,
        y: line.y2 - size / 2,
        width: size,
        height: size,
      },
    ];
  }

  function moveDraggedShape(dragState, dx, dy) {
    if (dragState.type === "rect") {
      setRectangles((oldRectangles) =>
        oldRectangles.map((rect) =>
          rect.id === dragState.id ? getDraggedRect(dragState, dx, dy) : rect,
        ),
      );
      return;
    }

    if (dragState.type === "freeRect") {
      setFreeRectangles((oldRectangles) =>
        oldRectangles.map((rect) =>
          rect.id === dragState.id ? getDraggedRect(dragState, dx, dy) : rect,
        ),
      );
      return;
    }

    if (dragState.type === "line") {
      setLines((oldLines) =>
        oldLines.map((line) =>
          line.id === dragState.id ? getDraggedLine(dragState, dx, dy) : line,
        ),
      );
    }
  }

  function getDraggedRect(dragState, dx, dy) {
    const rect = dragState.originalShape;

    if (dragState.action === "resize" && dragState.handle === "bottomRight") {
      const minSize = 3;

      return {
        ...rect,
        width: Math.max(minSize, rect.width + dx),
        height: Math.max(minSize, rect.height + dy),
      };
    }

    if (dragState.action === "resize" && dragState.handle === "topRight") {
      const minSize = 3;
      const bottom = rect.y + rect.height;
      const nextTop = Math.min(bottom - minSize, rect.y + dy);

      return {
        ...rect,
        y: nextTop,
        width: Math.max(minSize, rect.width + dx),
        height: bottom - nextTop,
      };
    }

    return {
      ...rect,
      x: rect.x + dx,
      y: rect.y + dy,
    };
  }

  function getDraggedLine(dragState, dx, dy) {
    const line = dragState.originalShape;

    if (dragState.action === "resize") {
      const minLength = 3;

      if (line.orientation === "horizontal") {
        if (dragState.handle === "start") {
          return {
            ...line,
            x1: Math.min(line.x2 - minLength, line.x1 + dx),
          };
        }

        return {
          ...line,
          x2: Math.max(line.x1 + minLength, line.x2 + dx),
        };
      }

      if (dragState.handle === "start") {
        return {
          ...line,
          y1: Math.min(line.y2 - minLength, line.y1 + dy),
        };
      }

      return {
        ...line,
        y2: Math.max(line.y1 + minLength, line.y2 + dy),
      };
    }

    return {
      ...line,
      x1: line.x1 + dx,
      y1: line.y1 + dy,
      x2: line.x2 + dx,
      y2: line.y2 + dy,
    };
  }

  function findHitLine(point) {
    const hitLines = [...visibleLines]
      .reverse()
      .filter((line) => isPointNearLine(point, line));

    if (hitLines.length === 0) return null;

    return hitLines.reduce((bestLine, line) => {
      const bestDistance = getDistance(point, getLineMidpoint(bestLine));
      const lineDistance = getDistance(point, getLineMidpoint(line));

      return lineDistance < bestDistance ? line : bestLine;
    });
  }

  function clearCurrentPageShapes() {
    if (!window.confirm("纭娓呯┖褰撳墠椤电殑鍥惧舰鍚楋紵")) return;

    setRectangles((oldRectangles) =>
      oldRectangles.filter((rect) => rect.page !== currentPage),
    );
    setLines((oldLines) =>
      oldLines.filter((line) => line.page !== currentPage),
    );
    setDetectedRectangles((oldRectangles) =>
      oldRectangles.filter((rect) => rect.page !== currentPage),
    );
    setFreeRectangles((oldRectangles) =>
      oldRectangles.filter((rect) => rect.page !== currentPage),
    );
    setCurrentRect(null);
    setCurrentLine(null);
    setIsDrawingShape(false);
    setIsDraggingShape(false);
    dragShapeRef.current = null;
    setSelectedShape(null);
    setSelectedRectId(null);
    setSelectedLineId(null);
    setPropertyEditorShape(null);
    markWorkspaceDirty();
  }

  function deleteSelectedShape() {
    if (!selectedShape) return;
    if (selectedShape.type === "detectedRect") return;

    if (selectedShape.type === "rect") {
      setRectangles((oldRectangles) =>
        oldRectangles.filter((rect) => rect.id !== selectedShape.id),
      );
      setSelectedRectId(null);
    }

    if (selectedShape.type === "freeRect") {
      setFreeRectangles((oldRectangles) =>
        oldRectangles.filter((rect) => rect.id !== selectedShape.id),
      );
      setSelectedRectId(null);
    }

    if (selectedShape.type === "line") {
      setLines((oldLines) =>
        oldLines.filter((line) => line.id !== selectedShape.id),
      );
      setSelectedLineId(null);
    }

    setSelectedShape(null);
    setPropertyEditorShape(null);
    markWorkspaceDirty();
  }

  function clearCurrentPageDetectedRectangles() {
    setDetectedRectangles((oldRectangles) =>
      oldRectangles.filter((rect) => rect.page !== currentPage),
    );

    if (selectedShape?.type === "detectedRect") {
      setSelectedShape(null);
      setSelectedRectId(null);
      setPropertyEditorShape(null);
    }

    markWorkspaceDirty();
  }

  function findRectanglesFromLines() {
    const nextRects = findInnermostRectangles(visibleLines).map(
      (rect, index) => ({
        ...rect,
        id: `${Date.now()}-${index}`,
        page: currentPage,
        fill: getRandomColor(),
        businessProps: getDefaultBusinessProps("detectedRect"),
      }),
    );

    setDetectedRectangles((oldRectangles) => [
      ...oldRectangles.filter((rect) => rect.page !== currentPage),
      ...nextRects,
    ]);

    if (selectedShape?.type === "detectedRect") {
      setSelectedShape(null);
      setSelectedRectId(null);
    }
    markWorkspaceDirty();
  }

  function findInnermostRectangles(sourceLines) {
    const horizontals = [];
    const verticals = [];
    const epsilon = 0.001;

    sourceLines.forEach((line) => {
      if (line.orientation === "horizontal") {
        horizontals.push({
          y: line.y1,
          x1: Math.min(line.x1, line.x2),
          x2: Math.max(line.x1, line.x2),
        });
      }

      if (line.orientation === "vertical") {
        verticals.push({
          x: line.x1,
          y1: Math.min(line.y1, line.y2),
          y2: Math.max(line.y1, line.y2),
        });
      }
    });

    const xCoords = [...new Set(verticals.map((line) => line.x))].sort(
      (a, b) => a - b,
    );
    const yCoords = [...new Set(horizontals.map((line) => line.y))].sort(
      (a, b) => a - b,
    );
    const candidateRects = [];

    for (let leftIndex = 0; leftIndex < xCoords.length; leftIndex += 1) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < xCoords.length;
        rightIndex += 1
      ) {
        const left = xCoords[leftIndex];
        const right = xCoords[rightIndex];

        for (let topIndex = 0; topIndex < yCoords.length; topIndex += 1) {
          for (
            let bottomIndex = topIndex + 1;
            bottomIndex < yCoords.length;
            bottomIndex += 1
          ) {
            const top = yCoords[topIndex];
            const bottom = yCoords[bottomIndex];

            const hasLeft = verticals.some(
              (line) =>
                Math.abs(line.x - left) < epsilon &&
                line.y1 <= top + epsilon &&
                line.y2 >= bottom - epsilon,
            );
            const hasRight = verticals.some(
              (line) =>
                Math.abs(line.x - right) < epsilon &&
                line.y1 <= top + epsilon &&
                line.y2 >= bottom - epsilon,
            );
            const hasTop = horizontals.some(
              (line) =>
                Math.abs(line.y - top) < epsilon &&
                line.x1 <= left + epsilon &&
                line.x2 >= right - epsilon,
            );
            const hasBottom = horizontals.some(
              (line) =>
                Math.abs(line.y - bottom) < epsilon &&
                line.x1 <= left + epsilon &&
                line.x2 >= right - epsilon,
            );

            if (hasLeft && hasRight && hasTop && hasBottom) {
              candidateRects.push({
                x: left,
                y: top,
                width: right - left,
                height: bottom - top,
              });
            }
          }
        }
      }
    }

    return candidateRects.filter(
      (rect, index) =>
        !candidateRects.some(
          (otherRect, otherIndex) =>
            otherIndex !== index && isRectInside(otherRect, rect),
        ),
    );
  }

  function isRectInside(innerRect, outerRect) {
    const epsilon = 0.001;

    return (
      innerRect.x >= outerRect.x - epsilon &&
      innerRect.y >= outerRect.y - epsilon &&
      innerRect.x + innerRect.width <=
        outerRect.x + outerRect.width + epsilon &&
      innerRect.y + innerRect.height <=
        outerRect.y + outerRect.height + epsilon &&
      (innerRect.x > outerRect.x + epsilon ||
        innerRect.y > outerRect.y + epsilon ||
        innerRect.x + innerRect.width <
          outerRect.x + outerRect.width - epsilon ||
        innerRect.y + innerRect.height <
          outerRect.y + outerRect.height - epsilon)
    );
  }

  function getRandomColor() {
    const r = Math.floor(Math.random() * 256);
    const g = Math.floor(Math.random() * 256);
    const b = Math.floor(Math.random() * 256);

    return `rgba(${r}, ${g}, ${b}, 0.2)`;
  }

  function getShapeByRef(shapeRef) {
    if (!shapeRef) return null;

    if (shapeRef.type === "rect") {
      return rectangles.find((rect) => rect.id === shapeRef.id) || null;
    }

    if (shapeRef.type === "freeRect") {
      return freeRectangles.find((rect) => rect.id === shapeRef.id) || null;
    }

    if (shapeRef.type === "detectedRect") {
      return detectedRectangles.find((rect) => rect.id === shapeRef.id) || null;
    }

    if (shapeRef.type === "line") {
      return lines.find((line) => line.id === shapeRef.id) || null;
    }

    return null;
  }

  function updateShapeBusinessProps(shapeRef, nextProps) {
    if (!shapeRef) return;

    if (shapeRef.type === "rect") {
      setRectangles((oldRectangles) =>
        updateShapeBusinessPropsInList(oldRectangles, shapeRef.id, nextProps),
      );
      markWorkspaceDirty();
      return;
    }

    if (shapeRef.type === "freeRect") {
      setFreeRectangles((oldRectangles) =>
        updateShapeBusinessPropsInList(oldRectangles, shapeRef.id, nextProps),
      );
      markWorkspaceDirty();
      return;
    }

    if (shapeRef.type === "detectedRect") {
      setDetectedRectangles((oldRectangles) =>
        updateShapeBusinessPropsInList(oldRectangles, shapeRef.id, nextProps),
      );
      markWorkspaceDirty();
      return;
    }

    if (shapeRef.type === "line") {
      setLines((oldLines) =>
        updateShapeBusinessPropsInList(oldLines, shapeRef.id, nextProps),
      );
      markWorkspaceDirty();
    }
  }

  function getShapeTypeLabel(shapeType) {
    if (shapeType === "rect") return "鎵嬬粯鐭╁舰";
    if (shapeType === "freeRect") return "鑷敱鐭╁舰";
    if (shapeType === "detectedRect") return "鎵惧嚭鐭╁舰";
    if (shapeType === "line") return "鐩寸嚎";
    return "鍥惧舰";
  }

  function getPropertyEditorBackground(shapeType) {
    if (shapeType === "rect") return "rgba(223, 245, 223, 0.96)";
    if (shapeType === "freeRect") return "rgba(226, 230, 252, 0.96)";
    if (shapeType === "detectedRect") return "rgba(255, 224, 224, 0.96)";
    if (shapeType === "line") return "rgba(255, 255, 255, 0.97)";
    return "rgba(255, 255, 255, 0.97)";
  }

  const visibleRectangles = rectangles.filter(
    (rect) => rect.page === currentPage,
  );
  const visibleLines = lines.filter((line) => line.page === currentPage);
  const visibleDetectedRectangles = detectedRectangles.filter(
    (rect) => rect.page === currentPage,
  );
  const visibleFreeRectangles = freeRectangles.filter(
    (rect) => rect.page === currentPage,
  );
  const selectedRectangleForInfo =
    selectedShape?.type === "rect"
      ? rectangles.find((rect) => rect.id === selectedRectId) || null
      : selectedShape?.type === "freeRect"
        ? freeRectangles.find((rect) => rect.id === selectedRectId) || null
        : selectedShape?.type === "detectedRect"
          ? detectedRectangles.find((rect) => rect.id === selectedRectId) ||
            null
          : null;
  const selectedRectangle =
    selectedShape?.type === "rect" ||
    selectedShape?.type === "freeRect" ||
    selectedShape?.type === "detectedRect"
      ? selectedShape.type === "rect"
        ? rectangles.find((rect) => rect.id === selectedShape.id) || null
        : selectedShape.type === "freeRect"
          ? freeRectangles.find((rect) => rect.id === selectedShape.id) || null
          : detectedRectangles.find((rect) => rect.id === selectedShape.id) ||
            null
      : null;
  const selectedLineForInfo =
    lines.find((line) => line.id === selectedLineId) || null;
  const selectedManualRectForDrag =
    selectedShape?.type === "rect"
      ? rectangles.find((rect) => rect.id === selectedShape.id) || null
      : selectedShape?.type === "freeRect"
        ? freeRectangles.find((rect) => rect.id === selectedShape.id) || null
        : null;
  const selectedLineForDrag =
    selectedShape?.type === "line"
      ? lines.find((line) => line.id === selectedShape.id) || null
      : null;
  const selectedRectDragHotZone = selectedManualRectForDrag
    ? getRectDragHotZone(selectedManualRectForDrag)
    : null;
  const selectedRectResizeHandles = selectedManualRectForDrag
    ? getRectResizeHandles(selectedManualRectForDrag)
    : [];
  const selectedLineDragHotZone = selectedLineForDrag
    ? getLineDragHotZone(selectedLineForDrag)
    : null;
  const selectedLineResizeHandles = selectedLineForDrag
    ? getLineResizeHandles(selectedLineForDrag)
    : [];
  const selectedPdfRect = selectedRectangleForInfo
    ? toPdfCoordinates(selectedRectangleForInfo)
    : null;
  const selectedPdfLine = selectedLineForInfo
    ? toPdfLineCoordinates(selectedLineForInfo)
    : null;
  const displayWidth = pageSize.width * scale;
  const displayHeight = pageSize.height * scale;
  const propertyEditorShapeData = getShapeByRef(propertyEditorShape);
  const propertyEditorSchema = propertyEditorShape
    ? shapePropertySchemas[propertyEditorShape.type] || []
    : [];
  const propertyEditorValue = propertyEditorShape
    ? getShapeBusinessProps(propertyEditorShape.type, propertyEditorShapeData)
    : {};
  const propertyEditorMode =
    propertyEditorShape?.type === "rect"
      ? "modal"
      : propertyEditorShape?.type === "line"
        ? "dock"
        : "floating";
  const propertyEditorDock =
    propertyEditorShape?.type === "line" ? "right" : "none";
  const propertyEditorTitle = propertyEditorShape
    ? `${getShapeTypeLabel(propertyEditorShape.type)} Properties`
    : "Properties";
  const propertyEditorBackground = propertyEditorShape
    ? getPropertyEditorBackground(propertyEditorShape.type)
    : undefined;
  const isCurrentFreeRectDraft = drawStartRef.current?.button === 2;

  useLayoutEffect(() => {
    const zoomCenter = pendingZoomCenterRef.current;
    const mainView = mainViewRef.current;
    const mainViewInner = mainViewInnerRef.current;

    if (
      !zoomCenter ||
      !mainView ||
      !mainViewInner ||
      !displayWidth ||
      !displayHeight
    ) {
      return;
    }

    const pdfOffsetX = Math.max(
      0,
      (mainViewInner.clientWidth - displayWidth) / 2,
    );
    const pdfOffsetY = Math.max(
      0,
      (mainViewInner.clientHeight - displayHeight) / 2,
    );

    mainView.scrollLeft =
      zoomCenter.x * scale + pdfOffsetX - mainView.clientWidth / 2;
    mainView.scrollTop =
      zoomCenter.y * scale + pdfOffsetY - mainView.clientHeight / 2;
    pendingZoomCenterRef.current = null;
  }, [displayWidth, displayHeight, scale]);

  useEffect(() => {
    setPageInputValue(String(currentPage));
  }, [currentPage]);

  useEffect(() => {
    const result = getQuestionListForPdfPage(sourceMetadata, currentPage);
    const nextSegmentId = result.segment?.id || null;

    if (questionSegmentIdRef.current === nextSegmentId) return;

    questionSegmentIdRef.current = nextSegmentId;
    setQuestionSegmentInfo(
      result.segment
        ? {
            id: result.segment.id,
            name: result.segment.name,
            title: result.segment.title,
            sourcePage: result.sourcePage,
            startPage: result.segment.startPage,
            endPage: result.segment.endPage,
          }
        : null,
    );
    setQuestionItems(result.questions);
  }, [currentPage, sourceMetadata]);

  useEffect(() => {
    function handleKeyDown(e) {
      if (!e.ctrlKey || e.altKey || e.metaKey) return;

      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        zoomIn();
        return;
      }

      if (e.key === "-") {
        e.preventDefault();
        zoomOut();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  });

  useEffect(() => {
    const canvas = regionCanvasRef.current;
    const container = secondaryViewRef.current;

    if (!canvas || !container) return undefined;

    const context = canvas.getContext("2d");

    if (isDrawingShape || selectedShape?.type === "line") {
      return undefined;
    }

    if (
      !selectedRectangle ||
      !pdfDocRef.current ||
      !pageSize.width ||
      !pageSize.height
    ) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      canvas.removeAttribute("width");
      canvas.removeAttribute("height");
      canvas.style.width = "";
      canvas.style.height = "";
      return undefined;
    }

    let cancelled = false;
    let renderTask = null;

    async function renderSelectedRegion() {
      const pdfDoc = pdfDocRef.current;
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      const padding = 1;
      const availableWidth = Math.max(1, containerWidth - padding * 2);
      const availableHeight = Math.max(1, containerHeight - padding * 2);

      const regionScale = Math.min(
        availableWidth / selectedRectangle.width,
        availableHeight / selectedRectangle.height,
      );
      const pixelRatio = window.devicePixelRatio || 1;
      const renderScale = regionScale * pixelRatio;

      const canvasWidth = Math.max(
        1,
        Math.round(selectedRectangle.width * renderScale),
      );
      const canvasHeight = Math.max(
        1,
        Math.round(selectedRectangle.height * renderScale),
      );
      const cssWidth = selectedRectangle.width * regionScale;
      const cssHeight = selectedRectangle.height * regionScale;

      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;

      context.clearRect(0, 0, canvas.width, canvas.height);

      const page = await pdfDoc.getPage(selectedRectangle.page);
      if (cancelled) return;

      const viewport = page.getViewport({
        scale: renderScale,
        offsetX: -selectedRectangle.x * renderScale,
        offsetY: -selectedRectangle.y * renderScale,
        dontFlip: false,
      });

      renderTask = page.render({
        canvasContext: context,
        viewport,
      });

      await renderTask.promise;
    }

    renderSelectedRegion().catch((error) => {
      if (error?.name === "RenderingCancelledException") return;
      console.error("[secondary] region render failed:", error);
    });

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [
    isDrawingShape,
    selectedShape,
    selectedRectangle,
    secondaryWidth,
    contentViewMode,
    pageSize.width,
    pageSize.height,
  ]);

  return (
    <div className="app-container">
      <aside className="left-tabs-shell">
        <nav
          className="left-tab-list"
          role="tablist"
          aria-label="Left sidebar tabs"
        >
          {leftTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              className={`left-tab-button ${
                activeLeftTab === tab.id ? "active" : ""
              }`}
              title={tab.label}
              aria-label={tab.label}
              aria-selected={activeLeftTab === tab.id}
              onClick={() => setActiveLeftTab(tab.id)}
            >
              <FontAwesomeIcon icon={tab.icon} />
            </button>
          ))}
        </nav>

        <div className="left-tab-panel" role="tabpanel">
          {activeLeftTab === "tools" && (
            <div className="sidebar left-sidebar">
              <button type="button" onClick={handleOpenPdf}>
                Open
              </button>

              <div className="sidebar-section">
                <div className="sidebar-button-row">
                  <button
                    type="button"
                    disabled={!pdfPath || !hasUnsavedChanges}
                    onClick={saveCurrentPdfJson}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    disabled={!pdfPath}
                    onClick={closeCurrentPdf}
                  >
                    Close
                  </button>
                </div>
                {saveStatus && <div className="save-status">{saveStatus}</div>}
                {pdfJsonPath && (
                  <div className="pdf-json-path">{pdfJsonPath}</div>
                )}
              </div>

              <div className="sidebar-section recent-files-section">
                <div className="sidebar-title">Recent files</div>
                <select
                  className="recent-files-select"
                  value=""
                  disabled={recentFiles.length === 0}
                  onChange={(event) => handleOpenRecentPdf(event.target.value)}
                >
                  <option value="">
                    {recentFiles.length === 0 ? "No recent files" : "Recent files..."}
                  </option>
                  {recentFiles.map((filePath) => (
                    <option key={filePath} value={filePath}>
                      {filePath}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sidebar-section">
                <div>Name: {pdfName || "-"}</div>
                <div>Path: {pdfPath || "-"}</div>
                <div className="page-jump-row">
                  <span>Page:</span>
                  <input
                    className="page-jump-input"
                    value={pageInputValue}
                    inputMode="numeric"
                    disabled={totalPages <= 0}
                    onChange={handlePageInputChange}
                    onBlur={commitPageInput}
                    onKeyDown={handlePageInputKeyDown}
                  />
                  <span>/{totalPages}</span>
                </div>
                <div>
                  Page size: {pageSize.width.toFixed(0)} x{" "}
                  {pageSize.height.toFixed(0)}
                </div>
                <div>Scale: {scale.toFixed(3)}</div>
              </div>

              <div className="sidebar-section">
                <div className="sidebar-button-row">
                  <button disabled={currentPage <= 1} onClick={prevPage}>
                    Prev{" "}
                  </button>
                  <button
                    disabled={currentPage >= totalPages}
                    onClick={nextPage}
                  >
                    Next{" "}
                  </button>
                </div>
              </div>

              <div className="sidebar-section zoom-section">
                <div className="sidebar-button-row">
                  <button onClick={zoomIn}>Z in</button>
                  <button onClick={zoomOut}>Z out</button>
                </div>
                <button onClick={resetScale}>Reset</button>
              </div>

              <div className="sidebar-section">
                <div className="sidebar-button-row">
                  <button
                    disabled={
                      visibleRectangles.length +
                        visibleLines.length +
                        visibleFreeRectangles.length +
                        visibleDetectedRectangles.length ===
                      0
                    }
                    onClick={clearCurrentPageShapes}
                  >
                    Clear{" "}
                  </button>
                  <button
                    disabled={
                      !selectedShape || selectedShape.type === "detectedRect"
                    }
                    onClick={deleteSelectedShape}
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="sidebar-section">
                <button
                  disabled={visibleLines.length === 0}
                  onClick={findRectanglesFromLines}
                >
                  Find{" "}
                </button>
                <button
                  disabled={visibleDetectedRectangles.length === 0}
                  onClick={clearCurrentPageDetectedRectangles}
                >
                  Clear 2
                </button>
                <div>
                  Detected rectangles: {visibleDetectedRectangles.length}
                </div>
              </div>

              <div className="selected-shape-info-panel">
                <div className="sidebar-section rectangle-list">
                  <div className="sidebar-title">Rect</div>
                  {!selectedRectangleForInfo && (
                    <div className="empty-text">No Selected</div>
                  )}

                  {selectedRectangleForInfo && selectedPdfRect && (
                    <div className="rectangle-item selected-info">
                      <div className="rectangle-title">
                        Page {selectedRectangleForInfo.page}
                      </div>

                      <div className="coordinate-block">
                        <div>PDF Coord scale=1</div>
                        <div>X: {formatNumber(selectedPdfRect.x)}</div>
                        <div>Y: {formatNumber(selectedPdfRect.y)}</div>
                        <div>W: {formatNumber(selectedPdfRect.width)}</div>
                        <div>H: {formatNumber(selectedPdfRect.height)}</div>
                      </div>

                      <div className="coordinate-block">
                        <div>Konva Coord scale=1</div>
                        <div>X: {formatNumber(selectedRectangleForInfo.x)}</div>
                        <div>Y: {formatNumber(selectedRectangleForInfo.y)}</div>
                        <div>
                          W: {formatNumber(selectedRectangleForInfo.width)}
                        </div>
                        <div>
                          H: {formatNumber(selectedRectangleForInfo.height)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="sidebar-section line-list">
                  <div className="sidebar-title">Line</div>
                  {!selectedLineForInfo && (
                    <div className="empty-text">No Selected</div>
                  )}

                  {selectedLineForInfo && selectedPdfLine && (
                    <div className="rectangle-item selected-info">
                      <div className="rectangle-title">
                        Page {selectedLineForInfo.page}
                      </div>

                      <div className="coordinate-block">
                        <div>PDF Coord scale=1</div>
                        <div>X1: {formatNumber(selectedPdfLine.x1)}</div>
                        <div>Y1: {formatNumber(selectedPdfLine.y1)}</div>
                        <div>X2: {formatNumber(selectedPdfLine.x2)}</div>
                        <div>Y2: {formatNumber(selectedPdfLine.y2)}</div>
                      </div>

                      <div className="coordinate-block">
                        <div>Konva Coord scale=1</div>
                        <div>X1: {formatNumber(selectedLineForInfo.x1)}</div>
                        <div>Y1: {formatNumber(selectedLineForInfo.y1)}</div>
                        <div>X2: {formatNumber(selectedLineForInfo.x2)}</div>
                        <div>Y2: {formatNumber(selectedLineForInfo.y2)}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeLeftTab === "layers" && (
            <div className="left-tab-placeholder">
              <div className="sidebar-title">Layers</div>
            </div>
          )}

          {activeLeftTab === "settings" && (
            <div className="left-tab-placeholder">
              <div className="sidebar-title">Settings</div>
            </div>
          )}
        </div>
      </aside>

      <main className="content-area">
        <PdfMainView
          contentViewMode={contentViewMode}
          isMiddlePanning={isMiddlePanning}
          mainViewRef={mainViewRef}
          mainViewInnerRef={mainViewInnerRef}
          memoFile={memoFile}
          displayPdf={displayPdf}
          displayWidth={displayWidth}
          displayHeight={displayHeight}
          pageSize={pageSize}
          currentPage={currentPage}
          scale={scale}
          konvaStageRef={konvaStageRef}
          isDraggingShape={isDraggingShape}
          selectedShape={selectedShape}
          visibleRectangles={visibleRectangles}
          visibleLines={visibleLines}
          visibleDetectedRectangles={visibleDetectedRectangles}
          visibleFreeRectangles={visibleFreeRectangles}
          selectedRectDragHotZone={selectedRectDragHotZone}
          selectedLineDragHotZone={selectedLineDragHotZone}
          selectedRectResizeHandles={selectedRectResizeHandles}
          selectedLineResizeHandles={selectedLineResizeHandles}
          currentRect={currentRect}
          currentLine={currentLine}
          isCurrentFreeRectDraft={isCurrentFreeRectDraft}
          normalizeRect={normalizeRect}
          onMainViewMouseDown={handleMainViewMouseDown}
          onMainViewMouseMove={handleMainViewMouseMove}
          onStopMiddlePan={stopMiddlePan}
          onDocumentLoadSuccess={handleDocumentLoadSuccess}
          onDocumentLoadError={handleDocumentLoadError}
          onDocumentSourceError={handleDocumentSourceError}
          onPageLoadSuccess={handlePageLoadSuccess}
          onPageLoadError={handlePageLoadError}
          onStageMouseDown={handleStageMouseDown}
          onStageMouseMove={handleStageMouseMove}
          onStageMouseUp={handleStageMouseUp}
          onStageDoubleClick={handleStageDoubleClick}
          onStageContextMenu={handleStageContextMenu}
        />

        {contentViewMode === "both" && (
          <div className="splitter" onMouseDown={handleSplitterMouseDown} />
        )}

        <section
          className={`secondary-view ${
            contentViewMode === "mainOnly" ? "hidden-pane" : ""
          } ${contentViewMode === "secondaryOnly" ? "full-pane" : ""}`}
          ref={secondaryViewRef}
          style={
            contentViewMode === "both" ? { width: secondaryWidth } : undefined
          }
        >
          {!selectedShape && <div className="secondary-empty">No Selected</div>}

          <div className="region-preview-container">
            <canvas ref={regionCanvasRef} className="region-canvas" />
          </div>
        </section>
      </main>

      <aside className="right-tabs-shell">
        <div className="right-tab-panel" role="tabpanel">
          {activeRightTab === "tools" && (
            <div className="sidebar right-sidebar right-tools-sidebar">
              <div className="sidebar-section">
                {/*
          <div className="sidebar-title">鍙充晶宸ュ叿鍖?/div>
          </div>
          <div className="sidebar-title">鍙充晶宸ュ叿鍖?/div>
          </div>
          <div className="sidebar-title">Right Tools</div>
          */}
                <div className="sidebar-title">Right Tools</div>
                <button type="button" onClick={toggleContentView}>
                  Toggle
                </button>
                <button type="button">Dummy 1</button>
                <button type="button">Dummy 2</button>
                <button type="button">Dummy 3</button>
                <button type="button">Dummy 4</button>
              </div>

              <div className="sidebar-section question-number-section">
                <div className="sidebar-title">QuesID</div>
                {!questionSegmentInfo && (
                  <div className="empty-text">
                    Current page is not in a metadata segment
                  </div>
                )}

                {questionSegmentInfo && (
                  <>
                    <div className="question-segment-meta">
                      <div>{questionSegmentInfo.id}</div>
                      <div>
                        {questionSegmentInfo.title || questionSegmentInfo.name}
                      </div>
                      <div>
                        Source pages: {questionSegmentInfo.startPage}-
                        {questionSegmentInfo.endPage || "End"}
                      </div>
                    </div>

                    <div className="question-number-list">
                      {questionItems.map((item) => (
                        <div className="question-number-item" key={item.id}>
                          <div className="question-number-id">{item.id}</div>
                          <div className="question-number-name">
                            {item.name}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {activeRightTab === "layers" && (
            <div className="right-tab-placeholder">
              <div className="sidebar-title">Inspect</div>
            </div>
          )}

          {activeRightTab === "settings" && (
            <div className="right-tab-placeholder">
              <div className="sidebar-title">Settings</div>
            </div>
          )}
        </div>

        <nav
          className="right-tab-list"
          role="tablist"
          aria-label="Right sidebar tabs"
        >
          {rightTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              className={`right-tab-button ${
                activeRightTab === tab.id ? "active" : ""
              }`}
              title={tab.label}
              aria-label={tab.label}
              aria-selected={activeRightTab === tab.id}
              onClick={() => setActiveRightTab(tab.id)}
            >
              <FontAwesomeIcon icon={tab.icon} />
            </button>
          ))}
        </nav>
      </aside>

      <ShapePropertyEditor
        open={Boolean(propertyEditorShape && propertyEditorShapeData)}
        editorKey={
          propertyEditorShape
            ? `${propertyEditorShape.type}:${propertyEditorShape.id}`
            : ""
        }
        mode={propertyEditorMode}
        dock={propertyEditorDock}
        title={propertyEditorTitle}
        schema={propertyEditorSchema}
        value={propertyEditorValue}
        backgroundColor={propertyEditorBackground}
        onSave={(nextProps) =>
          updateShapeBusinessProps(propertyEditorShape, nextProps)
        }
        onClose={() => setPropertyEditorShape(null)}
      />

      <div className="debug-overlay">
        <div className="debug-overlay-title">PDF debug</div>
        {debugMessages.length === 0 && <div>No messages</div>}
        {debugMessages.map((message, index) => (
          <div key={`${message}-${index}`}>{message}</div>
        ))}
      </div>
    </div>
  );
}
