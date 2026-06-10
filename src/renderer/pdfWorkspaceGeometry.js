const GEOMETRY_PRECISION = 1000;
export const REGION_PARTITION_GUIDE_LINE_TYPE = "regionPartitionGuideLine";
export const REGION_PARTITION_GUIDE_LINE_OVERFLOW = 2;

export function roundGeometry(value) {
  return Math.round(value * GEOMETRY_PRECISION) / GEOMETRY_PRECISION;
}

export function roundLineGeometry(line) {
  return {
    ...line,
    x1: roundGeometry(line.x1),
    y1: roundGeometry(line.y1),
    x2: roundGeometry(line.x2),
    y2: roundGeometry(line.y2),
  };
}

export function isRegionPartitionGuideLine(line) {
  return line?.generator?.type === REGION_PARTITION_GUIDE_LINE_TYPE;
}

export function getRegionPartitionGuideLineSourceRectId(line) {
  return isRegionPartitionGuideLine(line)
    ? line.generator?.sourceRectId || ""
    : "";
}

export function getRegionPartitionGuideLineGeometry(rect, y) {
  const normalizedRect = normalizeRect(rect);
  const lineY = roundGeometry(y);

  return roundLineGeometry({
    orientation: "horizontal",
    x1: normalizedRect.x - REGION_PARTITION_GUIDE_LINE_OVERFLOW,
    y1: lineY,
    x2:
      normalizedRect.x +
      normalizedRect.width +
      REGION_PARTITION_GUIDE_LINE_OVERFLOW,
    y2: lineY,
  });
}

export function syncRegionPartitionGuideLinesWithRect(lines, rect) {
  return lines.map((line) => {
    if (getRegionPartitionGuideLineSourceRectId(line) !== rect.id) {
      return line;
    }

    return {
      ...line,
      ...getRegionPartitionGuideLineGeometry(rect, line.y1),
    };
  });
}

export function normalizeRect(rect) {
  const x1 = rect.x;
  const y1 = rect.y;
  const x2 = rect.x + rect.width;
  const y2 = rect.y + rect.height;

  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  };
}

export function getLineDraftFromDrag(start, point, scale) {
  const dx = point.x - start.x;
  const dy = point.y - start.y;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  const tolerance = 6 / scale;
  const ratioThreshold = 8;

  if (
    start.button === 2 &&
    absDx > tolerance &&
    (absDy <= tolerance || absDx / Math.max(absDy, 1) >= ratioThreshold)
  ) {
    return {
      orientation: "horizontal",
      x1: start.x,
      y1: start.y,
      x2: point.x,
      y2: start.y,
    };
  }

  if (start.button === 2) {
    return null;
  }

  if (
    absDy > tolerance &&
    (absDx <= tolerance || absDy / Math.max(absDx, 1) >= ratioThreshold)
  ) {
    return {
      orientation: "vertical",
      x1: start.x,
      y1: start.y,
      x2: start.x,
      y2: point.y,
    };
  }

  if (absDx > tolerance && absDx / Math.max(absDy, 1) >= ratioThreshold) {
    return {
      orientation: "horizontal",
      x1: start.x,
      y1: start.y,
      x2: point.x,
      y2: start.y,
    };
  }

  return null;
}

export function normalizeLine(line) {
  if (line.orientation === "horizontal") {
    return {
      ...line,
      x1: Math.min(line.x1, line.x2),
      x2: Math.max(line.x1, line.x2),
    };
  }

  return {
    ...line,
    y1: Math.min(line.y1, line.y2),
    y2: Math.max(line.y1, line.y2),
  };
}

export function getLineLength(line) {
  return Math.hypot(line.x2 - line.x1, line.y2 - line.y1);
}

export function toPdfCoordinates(rect, pageHeight) {
  return {
    x: rect.x,
    y: pageHeight - rect.y - rect.height,
    width: rect.width,
    height: rect.height,
  };
}

export function toPdfLineCoordinates(line, pageHeight) {
  return {
    x1: line.x1,
    y1: pageHeight - line.y1,
    x2: line.x2,
    y2: pageHeight - line.y2,
  };
}

export function formatNumber(value) {
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}

function getRectVerticalHotZoneInset(rect, scale) {
  const maxInset = 24 / scale;
  const proportionalInset = rect.height * 0.18;

  return Math.min(maxInset, proportionalInset, rect.height / 3);
}

export function isPointOnRectDragBorder(point, rect, scale) {
  const tolerance = 6 / scale;
  const inset = getRectVerticalHotZoneInset(rect, scale);
  const withinY =
    point.y >= rect.y + inset &&
    point.y <= rect.y + rect.height - inset;
  const nearLeft = Math.abs(point.x - rect.x) <= tolerance;
  const nearRight = Math.abs(point.x - (rect.x + rect.width)) <= tolerance;

  return withinY && (nearLeft || nearRight);
}

export function isPointNearLine(point, line, scale) {
  const tolerance = 6 / scale;

  if (line.orientation === "horizontal") {
    const minX = Math.min(line.x1, line.x2) - tolerance;
    const maxX = Math.max(line.x1, line.x2) + tolerance;
    return (
      point.x >= minX &&
      point.x <= maxX &&
      Math.abs(point.y - line.y1) <= tolerance
    );
  }

  const minY = Math.min(line.y1, line.y2) - tolerance;
  const maxY = Math.max(line.y1, line.y2) + tolerance;
  return (
    point.y >= minY &&
    point.y <= maxY &&
    Math.abs(point.x - line.x1) <= tolerance
  );
}

export function getLineMidpoint(line) {
  return {
    x: (line.x1 + line.x2) / 2,
    y: (line.y1 + line.y2) / 2,
  };
}

export function getDistance(pointA, pointB) {
  return Math.hypot(pointA.x - pointB.x, pointA.y - pointB.y);
}

export function isPointInsideBox(point, box) {
  return (
    point.x >= box.x &&
    point.x <= box.x + box.width &&
    point.y >= box.y &&
    point.y <= box.y + box.height
  );
}

function getRectDragHotZone(rect, scale) {
  const tolerance = 8 / scale;
  const inset = getRectVerticalHotZoneInset(rect, scale);

  return {
    x: rect.x - tolerance,
    y: rect.y + inset,
    width: tolerance * 2,
    height: Math.max(0, rect.height - inset * 2),
  };
}

export function getRectDragHotZones(rect, scale) {
  const leftZone = getRectDragHotZone(rect, scale);

  return [
    {
      ...leftZone,
      name: "left",
    },
    {
      ...leftZone,
      name: "right",
      x: rect.x + rect.width - leftZone.width / 2,
    },
  ];
}

export function getResizeHandleSize(scale) {
  return 8 / scale;
}

export function getResizeHandleHitSize(scale) {
  return 20 / scale;
}

export function getRectResizeHandles(rect, scale) {
  return getRectResizeHandleBoxes(rect, getResizeHandleSize(scale));
}

export function getRectResizeHandleHitZones(rect, scale) {
  return getRectResizeHandleBoxes(rect, getResizeHandleHitSize(scale));
}

export function getRectResizeHandleBoxes(rect, size) {
  return [
    {
      name: "topLeft",
      x: rect.x - size / 2,
      y: rect.y - size / 2,
      width: size,
      height: size,
    },
    {
      name: "topRight",
      x: rect.x + rect.width - size / 2,
      y: rect.y - size / 2,
      width: size,
      height: size,
    },
    {
      name: "bottomLeft",
      x: rect.x - size / 2,
      y: rect.y + rect.height - size / 2,
      width: size,
      height: size,
    },
    {
      name: "bottomRight",
      x: rect.x + rect.width - size / 2,
      y: rect.y + rect.height - size / 2,
      width: size,
      height: size,
    },
  ];
}

export function getLineDragHotZone(line, scale) {
  const tolerance = 8 / scale;

  if (line.orientation === "horizontal") {
    const x = Math.min(line.x1, line.x2);
    const width = Math.abs(line.x2 - line.x1);

    return {
      x,
      y: line.y1 - tolerance,
      width,
      height: tolerance * 2,
    };
  }

  const y = Math.min(line.y1, line.y2);
  const height = Math.abs(line.y2 - line.y1);

  return {
    x: line.x1 - tolerance,
    y,
    width: tolerance * 2,
    height,
  };
}

export function getLineResizeHandles(line, scale) {
  return getLineResizeHandleBoxes(line, getResizeHandleSize(scale));
}

export function getLineResizeHandleHitZones(line, scale) {
  return getLineResizeHandleBoxes(line, getResizeHandleHitSize(scale));
}

export function getLineResizeHandleBoxes(line, size) {
  return [
    {
      name: "start",
      x: line.x1 - size / 2,
      y: line.y1 - size / 2,
      width: size,
      height: size,
    },
    {
      name: "end",
      x: line.x2 - size / 2,
      y: line.y2 - size / 2,
      width: size,
      height: size,
    },
  ];
}

export function getDraggedRect(dragState, dx, dy) {
  const rect = dragState.originalShape;
  const minSize = 3;

  if (dragState.action === "resize" && dragState.handle === "bottomRight") {
    return {
      ...rect,
      width: Math.max(minSize, rect.width + dx),
      height: Math.max(minSize, rect.height + dy),
    };
  }

  if (dragState.action === "resize" && dragState.handle === "topRight") {
    const bottom = rect.y + rect.height;
    const nextTop = Math.min(bottom - minSize, rect.y + dy);

    return {
      ...rect,
      y: nextTop,
      width: Math.max(minSize, rect.width + dx),
      height: bottom - nextTop,
    };
  }

  if (dragState.action === "resize" && dragState.handle === "bottomLeft") {
    const right = rect.x + rect.width;
    const nextLeft = Math.min(right - minSize, rect.x + dx);

    return {
      ...rect,
      x: nextLeft,
      width: right - nextLeft,
      height: Math.max(minSize, rect.height + dy),
    };
  }

  if (dragState.action === "resize" && dragState.handle === "topLeft") {
    const right = rect.x + rect.width;
    const bottom = rect.y + rect.height;
    const nextLeft = Math.min(right - minSize, rect.x + dx);
    const nextTop = Math.min(bottom - minSize, rect.y + dy);

    return {
      ...rect,
      x: nextLeft,
      y: nextTop,
      width: right - nextLeft,
      height: bottom - nextTop,
    };
  }

  return {
    ...rect,
    x: rect.x + dx,
    y: rect.y + dy,
  };
}

export function getDraggedLine(dragState, dx, dy) {
  const line = dragState.originalShape;

  if (dragState.action === "resize") {
    const minLength = 3;

    if (line.orientation === "horizontal") {
      if (dragState.handle === "start") {
        return {
          ...line,
          x1: Math.min(line.x2 - minLength, line.x1 + dx),
        };
      }

      return {
        ...line,
        x2: Math.max(line.x1 + minLength, line.x2 + dx),
      };
    }

    if (dragState.handle === "start") {
      return {
        ...line,
        y1: Math.min(line.y2 - minLength, line.y1 + dy),
      };
    }

    return {
      ...line,
      y2: Math.max(line.y1 + minLength, line.y2 + dy),
    };
  }

  return {
    ...line,
    x1: line.x1 + dx,
    y1: line.y1 + dy,
    x2: line.x2 + dx,
    y2: line.y2 + dy,
  };
}

export function findInnermostRectangles(sourceLines) {
  const horizontals = [];
  const verticals = [];
  const epsilon = 0.001;

  sourceLines.forEach((line) => {
    if (line.orientation === "horizontal") {
      horizontals.push({
        y: line.y1,
        x1: Math.min(line.x1, line.x2),
        x2: Math.max(line.x1, line.x2),
      });
    }

    if (line.orientation === "vertical") {
      verticals.push({
        x: line.x1,
        y1: Math.min(line.y1, line.y2),
        y2: Math.max(line.y1, line.y2),
      });
    }
  });

  const xCoords = [...new Set(verticals.map((line) => line.x))].sort(
    (a, b) => a - b,
  );
  const yCoords = [...new Set(horizontals.map((line) => line.y))].sort(
    (a, b) => a - b,
  );
  const candidateRects = [];

  for (let leftIndex = 0; leftIndex < xCoords.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < xCoords.length;
      rightIndex += 1
    ) {
      const left = xCoords[leftIndex];
      const right = xCoords[rightIndex];

      for (let topIndex = 0; topIndex < yCoords.length; topIndex += 1) {
        for (
          let bottomIndex = topIndex + 1;
          bottomIndex < yCoords.length;
          bottomIndex += 1
        ) {
          const top = yCoords[topIndex];
          const bottom = yCoords[bottomIndex];

          const hasLeft = verticals.some(
            (line) =>
              Math.abs(line.x - left) < epsilon &&
              line.y1 <= top + epsilon &&
              line.y2 >= bottom - epsilon,
          );
          const hasRight = verticals.some(
            (line) =>
              Math.abs(line.x - right) < epsilon &&
              line.y1 <= top + epsilon &&
              line.y2 >= bottom - epsilon,
          );
          const hasTop = horizontals.some(
            (line) =>
              Math.abs(line.y - top) < epsilon &&
              line.x1 <= left + epsilon &&
              line.x2 >= right - epsilon,
          );
          const hasBottom = horizontals.some(
            (line) =>
              Math.abs(line.y - bottom) < epsilon &&
              line.x1 <= left + epsilon &&
              line.x2 >= right - epsilon,
          );

          if (hasLeft && hasRight && hasTop && hasBottom) {
            candidateRects.push({
              x: left,
              y: top,
              width: right - left,
              height: bottom - top,
            });
          }
        }
      }
    }
  }

  return candidateRects.filter(
    (rect, index) =>
      !candidateRects.some(
        (otherRect, otherIndex) =>
          otherIndex !== index && isRectInside(otherRect, rect),
      ),
  );
}

function getUniqueSortedNumbers(values, epsilon = 0.001) {
  return [...values]
    .sort((a, b) => a - b)
    .filter(
      (value, index, sortedValues) =>
        index === 0 || Math.abs(value - sortedValues[index - 1]) > epsilon,
    );
}

function getNormalizedRectBounds(rect) {
  const normalized = normalizeRect(rect);

  return {
    left: normalized.x,
    top: normalized.y,
    right: normalized.x + normalized.width,
    bottom: normalized.y + normalized.height,
    width: normalized.width,
    height: normalized.height,
  };
}

export function findInnermostRectanglesFromRegionRectsAndHorizontalLines(
  regionRects,
  sourceLines,
) {
  const epsilon = 0.001;
  const horizontals = sourceLines
    .filter((line) => line.orientation === "horizontal")
    .map((line) => ({
      y: line.y1,
      x1: Math.min(line.x1, line.x2),
      x2: Math.max(line.x1, line.x2),
    }));
  const candidateRects = [];

  regionRects.forEach((regionRect) => {
    const bounds = getNormalizedRectBounds(regionRect);

    if (bounds.width <= epsilon || bounds.height <= epsilon) {
      return;
    }

    const innerHorizontalYs = horizontals
      .filter(
        (line) =>
          line.y > bounds.top + epsilon &&
          line.y < bounds.bottom - epsilon &&
          line.x1 <= bounds.left + epsilon &&
          line.x2 >= bounds.right - epsilon,
      )
      .map((line) => line.y);
    const yCoords = getUniqueSortedNumbers(
      [bounds.top, ...innerHorizontalYs, bounds.bottom],
      epsilon,
    );

    for (let index = 0; index < yCoords.length - 1; index += 1) {
      const top = yCoords[index];
      const bottom = yCoords[index + 1];

      if (bottom - top <= epsilon) {
        continue;
      }

      candidateRects.push({
        x: bounds.left,
        y: top,
        width: bounds.width,
        height: bottom - top,
        generator: {
          type: "regionRectHorizontalLines",
          sourceRectId: regionRect.id,
          segmentIndex: index + 1,
        },
      });
    }
  });

  return candidateRects.filter(
    (rect, index) =>
      !candidateRects.some(
        (otherRect, otherIndex) =>
          otherIndex !== index && isRectInside(otherRect, rect),
      ),
  );
}

export function isRectInside(innerRect, outerRect) {
  const epsilon = 0.001;

  return (
    innerRect.x >= outerRect.x - epsilon &&
    innerRect.y >= outerRect.y - epsilon &&
    innerRect.x + innerRect.width <=
      outerRect.x + outerRect.width + epsilon &&
    innerRect.y + innerRect.height <=
      outerRect.y + outerRect.height + epsilon &&
    (innerRect.x > outerRect.x + epsilon ||
      innerRect.y > outerRect.y + epsilon ||
      innerRect.x + innerRect.width <
        outerRect.x + outerRect.width - epsilon ||
      innerRect.y + innerRect.height < outerRect.y + outerRect.height - epsilon)
  );
}

export function getRandomColor() {
  const r = Math.floor(Math.random() * 256);
  const g = Math.floor(Math.random() * 256);
  const b = Math.floor(Math.random() * 256);

  return `rgba(${r}, ${g}, ${b}, 0.2)`;
}
