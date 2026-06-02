export function createClearState(mode, currentPage, totalPages) {
  const safeCurrentPage = Math.max(1, Number(currentPage) || 1);
  const safeTotalPages = Math.max(safeCurrentPage, Number(totalPages) || 1);

  return {
    mode,
    allLines: true,
    allBasicRects: false,
    allManualRects: false,
    allPages: mode === "range" ? false : undefined,
    startPage: String(safeCurrentPage),
    endPage: String(mode === "page" ? safeCurrentPage : safeCurrentPage),
    totalPages: safeTotalPages,
    error: "",
  };
}

function getPositiveInteger(value) {
  const numericValue = Number(value);

  return Number.isInteger(numericValue) && numericValue > 0
    ? numericValue
    : null;
}

export function getClearPageRange(clearState, totalPages) {
  const safeTotalPages = Math.max(1, Number(totalPages) || 1);

  if (clearState.mode === "page") {
    const page = getPositiveInteger(clearState.startPage);

    if (!page || page > safeTotalPages) {
      return {
        error: "Current page is invalid.",
      };
    }

    return {
      startPage: page,
      endPage: page,
    };
  }

  if (clearState.allPages) {
    return {
      startPage: 1,
      endPage: safeTotalPages,
    };
  }

  const startPage = getPositiveInteger(clearState.startPage);
  const endPage = getPositiveInteger(clearState.endPage);

  if (!startPage || !endPage) {
    return {
      error: "Start page and end page must be positive integers.",
    };
  }

  if (startPage > endPage) {
    return {
      error: "Start page must be less than or equal to end page.",
    };
  }

  if (endPage > safeTotalPages) {
    return {
      error: `End page must be less than or equal to ${safeTotalPages}.`,
    };
  }

  return {
    startPage,
    endPage,
  };
}

function isPageInRange(item, startPage, endPage) {
  return item.page >= startPage && item.page <= endPage;
}

function keepOutsideRange(item, startPage, endPage) {
  return !isPageInRange(item, startPage, endPage);
}

export function applyClearToWorkspace(clearState, workspaceLists, totalPages) {
  const hasSelection =
    clearState.allLines || clearState.allBasicRects || clearState.allManualRects;

  if (!hasSelection) {
    return {
      error: "Select at least one item type.",
    };
  }

  const range = getClearPageRange(clearState, totalPages);

  if (range.error) {
    return {
      error: range.error,
    };
  }

  const { startPage, endPage } = range;
  const nextWorkspace = {
    rectangles: workspaceLists.rectangles,
    lines: workspaceLists.lines,
    detectedRectangles: workspaceLists.detectedRectangles,
    freeRectangles: workspaceLists.freeRectangles,
  };

  if (clearState.allLines) {
    nextWorkspace.lines = workspaceLists.lines.filter((line) =>
      keepOutsideRange(line, startPage, endPage),
    );
    nextWorkspace.detectedRectangles = workspaceLists.detectedRectangles.filter(
      (rect) => keepOutsideRange(rect, startPage, endPage),
    );
  }

  if (clearState.allBasicRects) {
    nextWorkspace.rectangles = workspaceLists.rectangles.filter((rect) =>
      keepOutsideRange(rect, startPage, endPage),
    );
  }

  if (clearState.allManualRects) {
    nextWorkspace.freeRectangles = workspaceLists.freeRectangles.filter((rect) =>
      keepOutsideRange(rect, startPage, endPage),
    );
  }

  return {
    workspace: nextWorkspace,
    range,
  };
}
