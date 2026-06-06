import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import PdfRegionCanvas from "./PdfRegionCanvas";
import { exportCompositeRegionsToPngDataUrl } from "../pdfCompositeExportUtils";

function getRegionKey(region, index) {
  return `${region.shapeType || "region"}:${region.id || index}:${region.page}`;
}

function getTargetWidth(regions, maxWidth) {
  if (!regions.length) return 1;

  const widestRegion = regions.reduce(
    (widest, region) => Math.max(widest, region.width || 0),
    1,
  );

  return Math.max(1, Math.min(maxWidth || widestRegion, widestRegion));
}

function normalizeRegionGap(regionGap) {
  const numericGap = Number(regionGap);
  return Number.isFinite(numericGap) && numericGap > 0 ? numericGap : 0;
}

function getTotalGap(regions, regionGap) {
  return Math.max(0, regions.length - 1) * normalizeRegionGap(regionGap);
}

function getComposeTargetWidth(regions, maxWidth, maxHeight, regionGap = 0) {
  if (!regions.length) return 1;

  const widthLimitedTargetWidth = getTargetWidth(regions, maxWidth);
  const heightLimitedTargetWidth = (() => {
    if (!maxHeight || maxHeight < 1) return widthLimitedTargetWidth;

    const totalHeightRatio = regions.reduce((sum, region) => {
      if (!region?.width || !region?.height) return sum;
      return sum + region.height / region.width;
    }, 0);

    if (!totalHeightRatio) return widthLimitedTargetWidth;

    return Math.max(
      1,
      (maxHeight - getTotalGap(regions, regionGap)) / totalHeightRatio,
    );
  })();

  return Math.max(
    1,
    Math.min(widthLimitedTargetWidth, heightLimitedTargetWidth),
  );
}

function isTallStripRegion(region) {
  if (!region?.width || !region?.height) return false;
  return region.height / region.width >= 1.6;
}

function getResolvedLayoutMode(regions, layoutMode) {
  if (layoutMode === "vertical" || layoutMode === "horizontal") {
    return layoutMode;
  }

  if (regions.length <= 1) return "vertical";

  const tallStripCount = regions.filter(isTallStripRegion).length;
  return tallStripCount > regions.length / 2 ? "horizontal" : "vertical";
}

function getHorizontalTargetHeight(regions, maxWidth, maxHeight, regionGap = 0) {
  if (!regions.length) return 1;

  const tallestRegion = regions.reduce(
    (tallest, region) => Math.max(tallest, region.height || 0),
    1,
  );
  const widthRatioSum = regions.reduce((sum, region) => {
    if (!region?.width || !region?.height) return sum;
    return sum + region.width / region.height;
  }, 0);
  const widthLimitedTargetHeight =
    maxWidth && widthRatioSum
      ? Math.max(
          1,
          (maxWidth - getTotalGap(regions, regionGap)) / widthRatioSum,
        )
      : tallestRegion;
  const heightLimitedTargetHeight = maxHeight || tallestRegion;

  return Math.max(
    1,
    Math.min(tallestRegion, widthLimitedTargetHeight, heightLimitedTargetHeight),
  );
}

function PdfCompositeRegionView({
  pdfDoc,
  pdfDocsByTabId,
  regions = [],
  mode = "compose",
  layoutMode = "auto",
  regionGap = 0,
  exportFileName = "composite-region.png",
  maxWidth,
  className = "",
}, ref) {
  const containerRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const safeRegions = useMemo(
    () => regions.filter((region) => region?.width > 0 && region?.height > 0),
    [regions],
  );
  const usableContainerWidth = containerSize.width >= 20 ? containerSize.width : 0;
  const usableContainerHeight =
    containerSize.height >= 20 ? containerSize.height : 0;
  const resolvedLayoutMode = getResolvedLayoutMode(safeRegions, layoutMode);
  const safeRegionGap = normalizeRegionGap(regionGap);
  const composeTargetHeight = getHorizontalTargetHeight(
    safeRegions,
    maxWidth || usableContainerWidth || undefined,
    usableContainerHeight || undefined,
    safeRegionGap,
  );
  const targetWidth =
    mode === "compose" && resolvedLayoutMode === "vertical"
      ? getComposeTargetWidth(
          safeRegions,
          maxWidth || usableContainerWidth || undefined,
          usableContainerHeight || undefined,
          safeRegionGap,
        )
      : getTargetWidth(safeRegions, maxWidth || usableContainerWidth || undefined);
  const activeRegion = safeRegions[Math.min(activeIndex, safeRegions.length - 1)];

  function getPdfDocForRegion(region) {
    if (region?.sourceTabId && pdfDocsByTabId?.has?.(region.sourceTabId)) {
      return pdfDocsByTabId.get(region.sourceTabId);
    }

    if (region?.sourceTabId) {
      return null;
    }

    return pdfDoc;
  }

  function renderMissingPdfDoc(region) {
    return (
      <div className="pdf-composite-region-missing-doc">
        PDF 文档准备中：{region?.sourcePdfName || region?.sourcePdfPath || "unknown"}
      </div>
    );
  }

  async function exportCurrentCompositeImage() {
    if (!window.electronPdf?.saveOutputPicture) {
      return {
        ok: false,
        reason: "saveOutputPicture IPC 不可用，请重启应用后再试。",
      };
    }

    if (safeRegions.length === 0) {
      return {
        ok: false,
        reason: "没有可导出的矩形内容。",
      };
    }

    try {
      const dataUrl = await exportCompositeRegionsToPngDataUrl({
        pdfDoc,
        pdfDocsByTabId,
        regions: safeRegions,
        layoutMode,
        regionGap: safeRegionGap,
      });

      if (!dataUrl) {
        return {
          ok: false,
          reason: "没有生成图片数据。",
        };
      }

      const savedResult = await window.electronPdf.saveOutputPicture(
        exportFileName,
        dataUrl,
      );

      return {
        ok: true,
        ...savedResult,
      };
    } catch (error) {
      console.error("[composite-export] failed:", error);
      return {
        ok: false,
        reason: error?.message || String(error),
      };
    }
  }

  useImperativeHandle(ref, () => ({
    exportImage: exportCurrentCompositeImage,
  }));

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const sizeSource = container.parentElement || container;

    function updateContainerSize() {
      const nextSize = {
        width: Math.round(sizeSource.clientWidth),
        height: Math.round(sizeSource.clientHeight),
      };

      setContainerSize((oldSize) => {
        if (
          oldSize.width === nextSize.width &&
          oldSize.height === nextSize.height
        ) {
          return oldSize;
        }

        return nextSize;
      });
    }

    updateContainerSize();

    const resizeObserver = new ResizeObserver(updateContainerSize);
    resizeObserver.observe(sizeSource);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  if (safeRegions.length === 0) {
    return (
      <div
        className={`pdf-composite-region-view empty ${className}`}
        ref={containerRef}
      >
        No regions
      </div>
    );
  }

  if (mode === "single") {
    return (
      <div
        className={`pdf-composite-region-view single ${className}`}
        ref={containerRef}
      >
        <div className="pdf-composite-region-body">
          {getPdfDocForRegion(activeRegion) ? (
            <PdfRegionCanvas
              pdfDoc={getPdfDocForRegion(activeRegion)}
              region={activeRegion}
              targetWidth={targetWidth}
              className="pdf-composite-region-canvas"
            />
          ) : (
            renderMissingPdfDoc(activeRegion)
          )}
        </div>
        {safeRegions.length > 1 && (
          <div className="pdf-composite-region-controls">
            <button
              type="button"
              disabled={activeIndex <= 0}
              onClick={() => setActiveIndex((oldIndex) => oldIndex - 1)}
            >
              Prev
            </button>
            <span>
              {activeIndex + 1} / {safeRegions.length}
            </span>
            <button
              type="button"
              disabled={activeIndex >= safeRegions.length - 1}
              onClick={() => setActiveIndex((oldIndex) => oldIndex + 1)}
            >
              Next
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`pdf-composite-region-view compose ${resolvedLayoutMode} ${className}`}
      ref={containerRef}
      style={{ gap: `${safeRegionGap}px` }}
    >
      {safeRegions.map((region, index) => (
        getPdfDocForRegion(region) ? (
          <PdfRegionCanvas
            key={getRegionKey(region, index)}
            pdfDoc={getPdfDocForRegion(region)}
            region={region}
            targetWidth={
              resolvedLayoutMode === "horizontal"
                ? composeTargetHeight * (region.width / region.height)
                : targetWidth
            }
            className="pdf-composite-region-canvas"
          />
        ) : (
          <div
            key={getRegionKey(region, index)}
            className="pdf-composite-region-missing-doc"
          >
            PDF 文档准备中：{region.sourcePdfName || region.sourcePdfPath || "unknown"}
          </div>
        )
      ))}
    </div>
  );
}

export default forwardRef(PdfCompositeRegionView);
