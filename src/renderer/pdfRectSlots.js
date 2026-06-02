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
  const purpose = rect.businessProps?.purpose || "";

  return purposeLabels[purpose] || purpose;
}

export function getPdfRectSlots(rect, rectType, context = {}) {
  if (rectType === "rect") {
    return {
      index: {
        visible: true,
        text: `R${context.index || ""}`,
        position: "top-left-inside",
      },
      label: {
        visible: Boolean(getHelperLabel(rect)),
        text: getHelperLabel(rect),
        position: "top-center-inside",
      },
    };
  }

  if (rectType === "detectedRect") {
    return {
      index: {
        visible: true,
        text: `D${context.index || ""}`,
        position: "top-left-inside",
      },
      label: {
        visible: Boolean(getBusinessLabel(rect)),
        text: getBusinessLabel(rect),
        position: "top-center-inside",
        ...getBusinessLabelSlotStyle(rect),
      },
    };
  }

  return {
    index: {
      visible: true,
      text: `B${context.index || ""}`,
      position: "top-left-inside",
    },
    label: {
      visible: Boolean(getBusinessLabel(rect)),
      text: getBusinessLabel(rect),
      position: "top-center-inside",
      ...getBusinessLabelSlotStyle(rect),
    },
  };
}
