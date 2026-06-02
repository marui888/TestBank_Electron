export function getShapePropertyFieldState(field, draftValue) {
  if (field.name === "questionId") {
    return {
      disabled: draftValue.contentType === "invalid",
    };
  }

  if (field.name === "solutionNo") {
    return {
      disabled: draftValue.contentType !== "answer",
    };
  }

  if (field.name === "fragmentOrder") {
    return {
      disabled: draftValue.isMultiRectPart !== true,
    };
  }

  return {
    disabled: false,
  };
}
