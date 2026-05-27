import { useState } from "react";
import { Group, Rect, Text } from "react-konva";

const SLOT_HEIGHT = 16;
const SLOT_PADDING_X = 5;
const SLOT_MARGIN = 2;
const SLOT_FONT_SIZE = 11;

function getSlotWidth(text, maxWidth) {
  const estimatedWidth = String(text || "").length * 7 + SLOT_PADDING_X * 2;

  return Math.max(18, Math.min(estimatedWidth, Math.max(18, maxWidth)));
}

function getSlotFrame(rect, scale, slot, hovered = false) {
  const rectX = rect.x * scale;
  const rectY = rect.y * scale;
  const rectWidth = rect.width * scale;
  const maxSlotWidth = Math.max(18, rectWidth - SLOT_MARGIN * 2);
  const baseWidth = getSlotWidth(slot.text, maxSlotWidth);
  const baseHeight = SLOT_HEIGHT;
  const width = hovered ? Math.min(maxSlotWidth, baseWidth + 6) : baseWidth;
  const height = hovered ? baseHeight + 3 : baseHeight;

  if (slot.position === "top-center-inside") {
    return {
      x: rectX + (rectWidth - width) / 2,
      y: rectY + SLOT_MARGIN,
      width,
      height,
    };
  }

  return {
    x: rectX + SLOT_MARGIN,
    y: rectY + SLOT_MARGIN,
    width,
    height,
  };
}

function SlotDisplay({ rect, scale, slot }) {
  const [hovered, setHovered] = useState(false);

  if (!slot?.visible || !slot.text) return null;

  const frame = getSlotFrame(rect, scale, slot, hovered);

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
            ? slot.hoverFill || "rgba(255, 247, 210, 0.96)"
            : slot.fill || "rgba(255, 255, 255, 0.86)"
        }
        stroke={
          hovered
            ? slot.hoverStroke || "rgba(190, 132, 28, 0.72)"
            : slot.stroke || "rgba(70, 70, 70, 0.38)"
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
        fill={slot.textFill || "#222"}
        fontSize={hovered ? SLOT_FONT_SIZE + 1 : SLOT_FONT_SIZE}
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
      <SlotDisplay rect={rect} scale={scale} slot={slotEntries.index} />
      <SlotDisplay rect={rect} scale={scale} slot={slotEntries.label} />
    </Group>
  );
}
