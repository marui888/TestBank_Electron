const DEFAULT_EXPORT_WIDTH = 1920;

function getNumericValue(value, fallback = 0) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function normalizeRegionGap(regionGap) {
  const numericGap = Number(regionGap);
  return Number.isFinite(numericGap) && numericGap > 0 ? numericGap : 0;
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

function getPdfDocForRegion(region, pdfDoc, pdfDocsByTabId) {
  if (region?.sourceTabId && pdfDocsByTabId?.has?.(region.sourceTabId)) {
    return pdfDocsByTabId.get(region.sourceTabId);
  }

  if (region?.sourceTabId) return null;

  return pdfDoc;
}

function getSafeRegions(regions) {
  return (Array.isArray(regions) ? regions : []).filter(
    (region) => region?.width > 0 && region?.height > 0,
  );
}

function getVerticalLayout(regions, exportWidth, regionGap) {
  const targetWidth = Math.max(1, exportWidth);
  let y = 0;

  const items = regions.map((region, index) => {
    const scale = targetWidth / region.width;
    const width = targetWidth;
    const height = region.height * scale;
    const item = {
      region,
      x: 0,
      y,
      width,
      height,
      scale,
    };

    y += height + (index < regions.length - 1 ? regionGap : 0);
    return item;
  });

  return {
    width: targetWidth,
    height: Math.max(1, y),
    items,
  };
}

function getHorizontalLayout(regions, exportWidth, regionGap) {
  const totalGap = Math.max(0, regions.length - 1) * regionGap;
  const widthRatioSum = regions.reduce((sum, region) => {
    if (!region?.width || !region?.height) return sum;
    return sum + region.width / region.height;
  }, 0);
  const targetHeight =
    widthRatioSum > 0
      ? Math.max(1, (exportWidth - totalGap) / widthRatioSum)
      : 1;
  let x = 0;

  const items = regions.map((region, index) => {
    const scale = targetHeight / region.height;
    const width = region.width * scale;
    const height = targetHeight;
    const item = {
      region,
      x,
      y: 0,
      width,
      height,
      scale,
    };

    x += width + (index < regions.length - 1 ? regionGap : 0);
    return item;
  });

  return {
    width: Math.max(1, Math.min(exportWidth, x)),
    height: targetHeight,
    items,
  };
}

async function renderRegionToCanvas({ pdfDoc, region, scale, pixelRatio }) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const renderScale = scale * pixelRatio;
  const canvasWidth = Math.max(1, Math.round(region.width * renderScale));
  const canvasHeight = Math.max(1, Math.round(region.height * renderScale));

  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);

  const page = await pdfDoc.getPage(region.page);
  const viewport = page.getViewport({
    scale: renderScale,
    offsetX: -region.x * renderScale,
    offsetY: -region.y * renderScale,
    dontFlip: false,
  });

  const renderTask = page.render({
    canvasContext: context,
    viewport,
  });

  await renderTask.promise;

  return canvas;
}

export async function exportCompositeRegionsToPngDataUrl({
  pdfDoc,
  pdfDocsByTabId,
  regions,
  layoutMode = "auto",
  regionGap = 0,
  exportWidth = DEFAULT_EXPORT_WIDTH,
  pixelRatio = window.devicePixelRatio || 1,
}) {
  const safeRegions = getSafeRegions(regions);

  if (safeRegions.length === 0) {
    return "";
  }

  const safeExportWidth = Math.max(1, getNumericValue(exportWidth, DEFAULT_EXPORT_WIDTH));
  const safeRegionGap = normalizeRegionGap(regionGap);
  const resolvedLayoutMode = getResolvedLayoutMode(safeRegions, layoutMode);
  const layout =
    resolvedLayoutMode === "horizontal"
      ? getHorizontalLayout(safeRegions, safeExportWidth, safeRegionGap)
      : getVerticalLayout(safeRegions, safeExportWidth, safeRegionGap);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  canvas.width = Math.max(1, Math.ceil(layout.width * pixelRatio));
  canvas.height = Math.max(1, Math.ceil(layout.height * pixelRatio));
  canvas.style.width = `${layout.width}px`;
  canvas.style.height = `${layout.height}px`;

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (const item of layout.items) {
    const itemPdfDoc = getPdfDocForRegion(item.region, pdfDoc, pdfDocsByTabId);
    if (!itemPdfDoc) continue;

    const regionCanvas = await renderRegionToCanvas({
      pdfDoc: itemPdfDoc,
      region: item.region,
      scale: item.scale,
      pixelRatio,
    });

    context.drawImage(
      regionCanvas,
      Math.round(item.x * pixelRatio),
      Math.round(item.y * pixelRatio),
    );
  }

  return canvas.toDataURL("image/png");
}
