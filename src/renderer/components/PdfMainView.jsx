import { Document, Page } from "react-pdf";
import { Stage, Layer, Rect, Line } from "react-konva";

export default function PdfMainView({
  contentViewMode,
  isMiddlePanning,
  mainViewRef,
  mainViewInnerRef,
  memoFile,
  displayPdf,
  displayWidth,
  displayHeight,
  pageSize,
  currentPage,
  scale,
  konvaStageRef,
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
  isCurrentFreeRectDraft,
  normalizeRect,
  onMainViewMouseDown,
  onMainViewMouseMove,
  onStopMiddlePan,
  onDocumentLoadSuccess,
  onDocumentLoadError,
  onDocumentSourceError,
  onPageLoadSuccess,
  onPageLoadError,
  onStageMouseDown,
  onStageMouseMove,
  onStageMouseUp,
  onStageDoubleClick,
  onStageContextMenu,
}) {
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
                onMouseDown={onStageMouseDown}
                onMouseMove={onStageMouseMove}
                onMouseUp={onStageMouseUp}
                onDblClick={onStageDoubleClick}
                onContextMenu={onStageContextMenu}
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
}
