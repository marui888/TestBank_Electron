import { forwardRef, useImperativeHandle, useRef } from "react";
import { Document, Page } from "react-pdf";
import { Stage, Layer, Rect, Line } from "react-konva";
import { getDefaultBusinessProps } from "../shapeProperties/shapePropertyDefaults";
import {
  getDistance,
  getDraggedLine,
  getDraggedRect,
  getLineDraftFromDrag,
  getLineLength,
  getLineMidpoint,
  getLineResizeHandleHitZones,
  getRectDragHotZone,
  getRectResizeHandleHitZones,
  isPointInsideBox,
  isPointNearLine,
  isPointOnLeftBorder,
  normalizeLine,
  normalizeRect,
} from "../pdfWorkspaceGeometry";

const PdfMainView = forwardRef(function PdfMainView(
  {
    contentViewMode,
    isMiddlePanning,
    memoFile,
    displayPdf,
    displayWidth,
    displayHeight,
    pageSize,
    currentPage,
    scale,
    isDraggingShape,
    selectedShape,
    visibleRectangles,
    visibleLines,
    visibleDetectedRectangles,
    visibleFreeRectangles,
    selectedRectDragHotZone,
    selectedLineDragHotZone,
    selectedRectResizeHandles,
    selectedLineResizeHandles,
    currentRect,
    currentLine,
    rectangles,
    lines,
    freeRectangles,
    setCurrentRect,
    setCurrentLine,
    setIsDrawingShape,
    setIsDraggingShape,
    setRectangles,
    setLines,
    setFreeRectangles,
    setSelectedShape,
    setSelectedRectId,
    setSelectedLineId,
    setPropertyEditorShape,
    markWorkspaceDirty,
    onMainViewMouseDown,
    onMainViewMouseMove,
    onStopMiddlePan,
    onDocumentLoadSuccess,
    onDocumentLoadError,
    onDocumentSourceError,
    onPageLoadSuccess,
    onPageLoadError,
  },
  ref,
) {
  const mainViewRef = useRef(null);
  const mainViewInnerRef = useRef(null);
  const konvaStageRef = useRef(null);
  const drawStartRef = useRef(null);
  const dragShapeRef = useRef(null);

  useImperativeHandle(
    ref,
    () => ({
      getMainView: () => mainViewRef.current,
      getMainViewInner: () => mainViewInnerRef.current,
      getKonvaStage: () => konvaStageRef.current,
      clearInteraction: clearDraftInteraction,
    }),
    [],
  );

  const isCurrentFreeRectDraft = drawStartRef.current?.button === 2;

  function clearDraftInteraction() {
    drawStartRef.current = null;
    dragShapeRef.current = null;
    setCurrentRect(null);
    setCurrentLine(null);
    setIsDrawingShape(false);
    setIsDraggingShape(false);
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

    const lineDraft = getLineDraftFromDrag(start, pagePoint, scale);

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
    const finalLine = getLineDraftFromDrag(draft, endPoint, scale);
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
      .filter((rect) => isPointOnLeftBorder(point, rect, scale));

    if (hitRects.length === 0) return null;

    return hitRects.reduce((bestRect, rect) => {
      const bestDistance = Math.abs(
        point.y - (bestRect.y + bestRect.height / 2),
      );
      const rectDistance = Math.abs(point.y - (rect.y + rect.height / 2));

      return rectDistance < bestDistance ? rect : bestRect;
    });
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

      if (!isPointNearLine(point, line, scale)) return null;

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
        isPointOnLeftBorder(point, rect, scale)
      );
    }

    if (selectedShape.type === "line") {
      const line = getShapeByRef(selectedShape);
      if (!line) return false;

      return (
        isPointNearLine(point, line, scale) ||
        Boolean(findLineResizeHandle(point, line))
      );
    }

    return false;
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
      return (
        visibleDetectedRectangles.find((rect) => rect.id === shapeRef.id) ||
        null
      );
    }

    if (shapeRef.type === "line") {
      return lines.find((line) => line.id === shapeRef.id) || null;
    }

    return null;
  }

  function isPointInRectDragHotZone(point, rect) {
    return isPointInsideBox(point, getRectDragHotZone(rect, scale));
  }

  function findRectResizeHandle(point, rect) {
    const handles = getRectResizeHandleHitZones(rect, scale);
    const hitHandle = handles.find((handle) => isPointInsideBox(point, handle));

    return hitHandle?.name || null;
  }

  function findLineResizeHandle(point, line) {
    const handles = getLineResizeHandleHitZones(line, scale);
    const hitHandle = handles.find((handle) => isPointInsideBox(point, handle));

    return hitHandle?.name || null;
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

  function findHitLine(point) {
    const hitLines = [...visibleLines]
      .reverse()
      .filter((line) => isPointNearLine(point, line, scale));

    if (hitLines.length === 0) return null;

    return hitLines.reduce((bestLine, line) => {
      const bestDistance = getDistance(point, getLineMidpoint(bestLine));
      const lineDistance = getDistance(point, getLineMidpoint(line));

      return lineDistance < bestDistance ? line : bestLine;
    });
  }

  return (
    <section
      className={`main-view ${
        contentViewMode === "secondaryOnly" ? "hidden-pane" : ""
      } ${isMiddlePanning ? "middle-panning" : ""}`}
      ref={mainViewRef}
      onMouseDown={onMainViewMouseDown}
      onMouseMove={onMainViewMouseMove}
      onMouseUp={onStopMiddlePan}
      onMouseLeave={onStopMiddlePan}
      onAuxClick={(e) => {
        if (e.button === 1) e.preventDefault();
      }}
      onMouseLeaveCapture={clearDraftInteraction}
    >
      <div className="main-view-inner" ref={mainViewInnerRef}>
        {displayPdf && memoFile && (
          <div
            className="pdf-stage-wrapper"
            style={{
              width: displayWidth || 600,
              height: displayHeight || 800,
            }}
          >
            <Document
              file={memoFile}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              onSourceError={onDocumentSourceError}
              loading={<div className="loading">Loading PDF...</div>}
              error={<div className="error">Open failed </div>}
            >
              <Page
                pageNumber={currentPage}
                width={displayWidth || 600}
                onLoadSuccess={onPageLoadSuccess}
                onLoadError={onPageLoadError}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
            </Document>

            {pageSize.width > 0 && pageSize.height > 0 && (
              <Stage
                ref={konvaStageRef}
                width={displayWidth}
                height={displayHeight}
                className="konva-stage"
                style={{ cursor: isDraggingShape ? "move" : "default" }}
                onMouseDown={handleStageMouseDown}
                onMouseMove={handleStageMouseMove}
                onMouseUp={handleStageMouseUp}
                onDblClick={handleStageDoubleClick}
                onContextMenu={handleStageContextMenu}
              >
                <Layer>
                  {visibleRectangles.map((rect) => (
                    <Rect
                      key={rect.id}
                      x={rect.x * scale}
                      y={rect.y * scale}
                      width={rect.width * scale}
                      height={rect.height * scale}
                      stroke="rgba(70, 158, 70, 0.75)"
                      strokeWidth={
                        selectedShape?.type === "rect" &&
                        rect.id === selectedShape.id
                          ? 3
                          : 2
                      }
                      dash={[6, 4]}
                      fill="rgba(70, 158, 70, 0.15)"
                    />
                  ))}

                  {visibleLines.map((line) => (
                    <Line
                      key={line.id}
                      points={[
                        line.x1 * scale,
                        line.y1 * scale,
                        line.x2 * scale,
                        line.y2 * scale,
                      ]}
                      stroke="rgba(255, 0, 0, 0.75)"
                      strokeWidth={
                        selectedShape?.type === "line" &&
                        line.id === selectedShape.id
                          ? 3
                          : 2
                      }
                    />
                  ))}
                </Layer>

                <Layer>
                  {visibleDetectedRectangles.map((rect) => (
                    <Rect
                      key={rect.id}
                      x={rect.x * scale}
                      y={rect.y * scale}
                      width={rect.width * scale}
                      height={rect.height * scale}
                      fill={rect.fill}
                      stroke="green"
                      strokeWidth={
                        selectedShape?.type === "detectedRect" &&
                        rect.id === selectedShape.id
                          ? 3
                          : 1
                      }
                      name="detected-rectangle"
                      listening={false}
                    />
                  ))}
                </Layer>

                <Layer>
                  {visibleFreeRectangles.map((rect) => (
                    <Rect
                      key={rect.id}
                      x={rect.x * scale}
                      y={rect.y * scale}
                      width={rect.width * scale}
                      height={rect.height * scale}
                      stroke="rgba(72, 92, 214, 0.9)"
                      strokeWidth={
                        selectedShape?.type === "freeRect" &&
                        rect.id === selectedShape.id
                          ? 3
                          : 2
                      }
                      fill="rgba(72, 92, 214, 0.12)"
                    />
                  ))}
                </Layer>

                <Layer>
                  {selectedRectDragHotZone && (
                    <Rect
                      x={selectedRectDragHotZone.x * scale}
                      y={selectedRectDragHotZone.y * scale}
                      width={selectedRectDragHotZone.width * scale}
                      height={selectedRectDragHotZone.height * scale}
                      fill="rgba(0, 128, 255, 0.2)"
                      stroke="rgba(0, 128, 255, 0.65)"
                      strokeWidth={1}
                      dash={[4, 3]}
                      listening={false}
                    />
                  )}

                  {selectedLineDragHotZone && (
                    <Rect
                      x={selectedLineDragHotZone.x * scale}
                      y={selectedLineDragHotZone.y * scale}
                      width={selectedLineDragHotZone.width * scale}
                      height={selectedLineDragHotZone.height * scale}
                      fill="rgba(0, 128, 255, 0.2)"
                      stroke="rgba(0, 128, 255, 0.65)"
                      strokeWidth={1}
                      dash={[4, 3]}
                      listening={false}
                    />
                  )}

                  {selectedRectResizeHandles.map((handle) => (
                    <Rect
                      key={handle.name}
                      x={handle.x * scale}
                      y={handle.y * scale}
                      width={handle.width * scale}
                      height={handle.height * scale}
                      fill="rgba(0, 128, 255,1)"
                      stroke="rgba(0, 128, 255, 1)"
                      strokeWidth={1}
                      listening={false}
                    />
                  ))}

                  {selectedLineResizeHandles.map((handle) => (
                    <Rect
                      key={handle.name}
                      x={handle.x * scale}
                      y={handle.y * scale}
                      width={handle.width * scale}
                      height={handle.height * scale}
                      fill="rgba(0, 128, 255,1)"
                      stroke="rgba(0, 128, 255, 1)"
                      strokeWidth={1}
                      listening={false}
                    />
                  ))}

                  {currentRect && (
                    <Rect
                      x={normalizeRect(currentRect).x * scale}
                      y={normalizeRect(currentRect).y * scale}
                      width={normalizeRect(currentRect).width * scale}
                      height={normalizeRect(currentRect).height * scale}
                      stroke={
                        isCurrentFreeRectDraft
                          ? "rgba(72, 92, 214, 0.9)"
                          : "blue"
                      }
                      strokeWidth={1}
                      dash={isCurrentFreeRectDraft ? undefined : [6, 4]}
                      fill={
                        isCurrentFreeRectDraft
                          ? "rgba(72, 92, 214, 0.12)"
                          : "rgba(0, 0, 255, 0.08)"
                      }
                    />
                  )}

                  {currentLine && (
                    <Line
                      points={[
                        currentLine.x1 * scale,
                        currentLine.y1 * scale,
                        currentLine.x2 * scale,
                        currentLine.y2 * scale,
                      ]}
                      stroke="blue"
                      strokeWidth={1}
                      dash={[6, 4]}
                    />
                  )}
                </Layer>
              </Stage>
            )}
          </div>
        )}
      </div>
    </section>
  );
});

export default PdfMainView;
