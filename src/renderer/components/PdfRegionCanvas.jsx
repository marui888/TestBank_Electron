import { useEffect, useRef } from "react";

export default function PdfRegionCanvas({
  pdfDoc,
  region,
  targetWidth,
  className = "",
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return undefined;

    const context = canvas.getContext("2d");

    if (!pdfDoc || !region?.width || !region?.height) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      canvas.removeAttribute("width");
      canvas.removeAttribute("height");
      canvas.style.width = "";
      canvas.style.height = "";
      return undefined;
    }

    let cancelled = false;
    let renderTask = null;

    async function renderRegion() {
      const pixelRatio = window.devicePixelRatio || 1;
      const cssWidth = Math.max(1, targetWidth || region.width);
      const regionScale = cssWidth / region.width;
      const renderScale = regionScale * pixelRatio;
      const canvasWidth = Math.max(1, Math.round(region.width * renderScale));
      const canvasHeight = Math.max(1, Math.round(region.height * renderScale));
      const cssHeight = region.height * regionScale;

      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;

      context.clearRect(0, 0, canvas.width, canvas.height);

      const page = await pdfDoc.getPage(region.page);
      if (cancelled) return;

      const viewport = page.getViewport({
        scale: renderScale,
        offsetX: -region.x * renderScale,
        offsetY: -region.y * renderScale,
        dontFlip: false,
      });

      renderTask = page.render({
        canvasContext: context,
        viewport,
      });

      await renderTask.promise;
    }

    renderRegion().catch((error) => {
      if (error?.name === "RenderingCancelledException") return;
      console.error("[region-canvas] render failed:", error);
    });

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pdfDoc, region, targetWidth]);

  return <canvas ref={canvasRef} className={className} />;
}
