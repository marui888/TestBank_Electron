import { useState } from "react";
import { Group, Rect, Text } from "react-konva";

const SLOT_VIEW_HEIGHT = 22;
const SLOT_VIEW_PADDING_X = 5;
const SLOT_VIEW_MARGIN = 1;
const SLOT_VIEW_FONT_SIZE = 13;

function getScaledSlotMetrics(scale, baseScale = 1, hovered = false) {
  const zoomRatio = baseScale > 0 ? scale / baseScale : 1;

  return {
    height: SLOT_VIEW_HEIGHT * zoomRatio + (hovered ? 3 * zoomRatio : 0),
    paddingX: SLOT_VIEW_PADDING_X * zoomRatio,
    margin: SLOT_VIEW_MARGIN * zoomRatio,
    fontSize: SLOT_VIEW_FONT_SIZE * zoomRatio + (hovered ? 1 * zoomRatio : 0),
    hoverGrowX: 6 * zoomRatio,
  };
}

function getSlotWidth(text, maxWidth, metrics) {
  const estimatedWidth =
    String(text || "").length * metrics.fontSize * 0.68 + metrics.paddingX * 2;

  return Math.max(18, Math.min(estimatedWidth, Math.max(18, maxWidth)));
}

function getSlotFrame(rect, scale, baseScale, slot, hovered = false) {
  const metrics = getScaledSlotMetrics(scale, baseScale, hovered);
  const rectX = rect.x * scale;
  const rectY = rect.y * scale;
  const rectWidth = rect.width * scale;
  const maxSlotWidth = Math.max(18, rectWidth - metrics.margin * 2);
  const baseWidth = getSlotWidth(slot.text, maxSlotWidth, metrics);
  const width = hovered
    ? Math.min(maxSlotWidth, baseWidth + metrics.hoverGrowX)
    : baseWidth;
  const height = metrics.height;

  if (slot.position === "top-center-inside") {
    return {
      x: rectX + (rectWidth - width) / 2,
      y: rectY + metrics.margin,
      width,
      height,
      fontSize: metrics.fontSize,
    };
  }

  return {
    x: rectX + metrics.margin,
    y: rectY + metrics.margin,
    width,
    height,
    fontSize: metrics.fontSize,
  };
}

function SlotDisplay({ rect, scale, baseScale, slot }) {
  const [hovered, setHovered] = useState(false);

  if (!slot?.visible || !slot.text) return null;

  const frame = getSlotFrame(rect, scale, baseScale, slot, hovered);

  return (
    <Group
      listening
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onDblClick={(event) => {
        event.cancelBubble = true;
        slot.onDoubleClick?.();
      }}
    >
      <Rect
        x={frame.x}
        y={frame.y}
        width={frame.width}
        height={frame.height}
        fill={
          hovered
            ? slot.hoverFill || "rgba(255, 235, 164, 0.98)"
            : slot.fill || "rgba(255, 255, 255, 0.94)"
        }
        stroke={
          hovered
            ? slot.hoverStroke || "rgba(162, 102, 0, 0.9)"
            : slot.stroke || "rgba(35, 35, 35, 0.68)"
        }
        strokeWidth={1}
        cornerRadius={2}
      />
      <Text
        x={frame.x}
        y={frame.y + 1}
        width={frame.width}
        height={frame.height}
        text={slot.text}
        fill={slot.textFill || "#111"}
        fontSize={frame.fontSize}
        align="center"
        verticalAlign="middle"
        listening={false}
      />
    </Group>
  );
}

export default function PdfAnnotatedRect({
  rect,
  scale,
  baseScale,
  selected,
  rectType,
  rectProps,
  slots,
  onSlotDoubleClick,
}) {
  const { selectedStrokeWidth, ...konvaRectProps } = rectProps;
  const slotEntries = {
    index: {
      ...slots?.index,
      onDoubleClick: () =>
        onSlotDoubleClick?.({ slot: "index", rect, rectType }),
    },
    label: {
      ...slots?.label,
      onDoubleClick: () =>
        onSlotDoubleClick?.({ slot: "label", rect, rectType }),
    },
  };

  return (
    <Group>
      <Rect
        x={rect.x * scale}
        y={rect.y * scale}
        width={rect.width * scale}
        height={rect.height * scale}
        {...konvaRectProps}
        strokeWidth={selected ? selectedStrokeWidth : rectProps.strokeWidth}
      />
      <SlotDisplay
        rect={rect}
        scale={scale}
        baseScale={baseScale}
        slot={slotEntries.index}
      />
      <SlotDisplay
        rect={rect}
        scale={scale}
        baseScale={baseScale}
        slot={slotEntries.label}
      />
    </Group>
  );
}
