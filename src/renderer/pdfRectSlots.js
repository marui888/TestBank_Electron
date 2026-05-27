const contentTypeLabels = {
  stem: "题干",
  answer: "答案",
  analysis: "分析",
};

const purposeLabels = {
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
    },
  };
}
