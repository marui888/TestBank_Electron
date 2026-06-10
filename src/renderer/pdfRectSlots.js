const contentTypeLabels = {
  stem: "题干",
  answer: "答案",
  analysis: "分析",
  invalid: "无效",
};

const businessLabelSlotStyles = {
  stem: {
    fill: "rgba(37, 99, 235, 0.92)",
    stroke: "rgba(30, 64, 175, 0.95)",
    textFill: "#fff",
    hoverFill: "rgba(29, 78, 216, 0.98)",
    hoverStroke: "rgba(30, 64, 175, 1)",
  },
  answer: {
    fill: "rgba(22, 163, 74, 0.92)",
    stroke: "rgba(21, 128, 61, 0.95)",
    textFill: "#fff",
    hoverFill: "rgba(21, 128, 61, 0.98)",
    hoverStroke: "rgba(20, 83, 45, 1)",
  },
  analysis: {
    fill: "rgba(217, 119, 6, 0.92)",
    stroke: "rgba(180, 83, 9, 0.95)",
    textFill: "#fff",
    hoverFill: "rgba(180, 83, 9, 0.98)",
    hoverStroke: "rgba(146, 64, 14, 1)",
  },
  invalid: {
    fill: "rgba(107, 114, 128, 0.92)",
    stroke: "rgba(75, 85, 99, 0.95)",
    textFill: "#fff",
    hoverFill: "rgba(75, 85, 99, 0.98)",
    hoverStroke: "rgba(55, 65, 81, 1)",
  },
};

const businessLabelInlineSlotStyle = {
  fill: "rgba(191, 219, 254, 0.76)",
  stroke: "rgba(37, 99, 235, 0.56)",
  textFill: "#0f172a",
  hoverFill: "rgba(147, 197, 253, 0.88)",
  hoverStroke: "rgba(29, 78, 216, 0.76)",
};

const purposeLabels = {
  region_partition: "区域划分",
  temporary: "临时",
  manual_fix: "修正",
  pending: "待确认",
};

function getBusinessLabel(rect) {
  const props = rect.businessProps || {};
  const contentType = contentTypeLabels[props.contentType] || props.contentType;

  if (props.questionId && contentType) {
    return `${props.questionId} | ${contentType}`;
  }

  return props.questionId || contentType || "";
}

function getBusinessLabelSlotStyle(rect) {
  const contentType = rect.businessProps?.contentType;

  return businessLabelSlotStyles[contentType] || {};
}

function getHelperLabel(rect) {
  const purpose = rect.businessProps?.purpose || "region_partition";

  return purposeLabels[purpose] || purpose;
}

function getRectDisplayIndex(rect, context) {
  return rect.businessProps?.displayIndex || context.index || "";
}

export function getPdfRectSlots(rect, rectType, context = {}) {
  const detectedIndexText = `D${context.index || ""}`;
  const freeIndexText = `B${context.index || ""}`;

  if (rectType === "rect") {
    return {
      index: {
        visible: true,
        text: `R${getRectDisplayIndex(rect, context)}`,
        position: "top-right-inside-row-2",
        sizeScale: 1.2,
        fill: "rgba(255, 255, 255, 0.84)",
        stroke: "rgba(71, 85, 105, 0.5)",
        hoverFill: "rgba(255, 255, 255, 0.96)",
        hoverStroke: "rgba(51, 65, 85, 0.72)",
      },
      label: {
        visible: Boolean(getHelperLabel(rect)),
        text: getHelperLabel(rect),
        position: "top-right-inside-row-1",
        sizeScale: 1.2,
        fill: "rgba(187, 247, 208, 0.72)",
        stroke: "rgba(22, 101, 52, 0.48)",
        hoverFill: "rgba(134, 239, 172, 0.86)",
        hoverStroke: "rgba(21, 128, 61, 0.76)",
      },
    };
  }

  if (rectType === "detectedRect") {
    return {
      index: {
        visible: true,
        text: detectedIndexText,
        position: "top-left-inside",
      },
      label: {
        visible: Boolean(getBusinessLabel(rect)),
        text: getBusinessLabel(rect),
        position: "top-left-inside-after-index",
        leftOfText: detectedIndexText,
        ...businessLabelInlineSlotStyle,
      },
    };
  }

  return {
    index: {
      visible: true,
      text: freeIndexText,
      position: "top-left-inside",
    },
    label: {
      visible: Boolean(getBusinessLabel(rect)),
      text: getBusinessLabel(rect),
      position: "top-left-inside-after-index",
      leftOfText: freeIndexText,
      ...businessLabelInlineSlotStyle,
    },
  };
}
