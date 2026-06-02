import { useEffect, useMemo, useRef, useState } from "react";
import PdfRegionCanvas from "./PdfRegionCanvas";

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

export default function PdfCompositeRegionView({
  pdfDoc,
  pdfDocsByTabId,
  regions = [],
  mode = "compose",
  maxWidth,
  className = "",
}) {
  const containerRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const safeRegions = useMemo(
    () => regions.filter((region) => region?.width > 0 && region?.height > 0),
    [regions],
  );
  const usableContainerWidth = containerWidth >= 20 ? containerWidth : 0;
  const targetWidth = getTargetWidth(
    safeRegions,
    maxWidth || usableContainerWidth || undefined,
  );
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

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    function updateContainerWidth() {
      setContainerWidth(container.clientWidth);
    }

    updateContainerWidth();

    const resizeObserver = new ResizeObserver(updateContainerWidth);
    resizeObserver.observe(container);

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
      className={`pdf-composite-region-view compose ${className}`}
      ref={containerRef}
    >
      {safeRegions.map((region, index) => (
        getPdfDocForRegion(region) ? (
          <PdfRegionCanvas
            key={getRegionKey(region, index)}
            pdfDoc={getPdfDocForRegion(region)}
            region={region}
            targetWidth={targetWidth}
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
