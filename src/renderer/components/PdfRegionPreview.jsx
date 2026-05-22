import { useEffect, useRef } from "react";

export default function PdfRegionPreview({
  pdfDoc,
  selectedRectangle,
  selectedShape,
  isDrawingShape,
  pageSize,
  secondaryWidth,
  contentViewMode,
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;

    if (!canvas || !container) return undefined;

    const context = canvas.getContext("2d");

    if (isDrawingShape || selectedShape?.type === "line") {
      return undefined;
    }

    if (
      !selectedRectangle ||
      !pdfDoc ||
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
    pdfDoc,
    isDrawingShape,
    selectedShape,
    selectedRectangle,
    secondaryWidth,
    contentViewMode,
    pageSize.width,
    pageSize.height,
  ]);

  return (
    <div className="region-preview-container" ref={containerRef}>
      <canvas ref={canvasRef} className="region-canvas" />
    </div>
  );
}
