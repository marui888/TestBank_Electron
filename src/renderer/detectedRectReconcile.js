function getRectArea(rect) {
  return Math.max(0, rect.width) * Math.max(0, rect.height);
}

function getIntersectionArea(a, b) {
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);

  return Math.max(0, right - left) * Math.max(0, bottom - top);
}

function getIou(a, b) {
  const intersection = getIntersectionArea(a, b);
  const union = getRectArea(a) + getRectArea(b) - intersection;

  return union > 0 ? intersection / union : 0;
}

function getCenterDistance(a, b) {
  const ax = a.x + a.width / 2;
  const ay = a.y + a.height / 2;
  const bx = b.x + b.width / 2;
  const by = b.y + b.height / 2;

  return Math.hypot(ax - bx, ay - by);
}

function getDiagonal(rect) {
  return Math.hypot(rect.width, rect.height);
}

function getMatchScore(oldRect, nextRect) {
  const iou = getIou(oldRect, nextRect);
  const distance = getCenterDistance(oldRect, nextRect);
  const distanceLimit =
    Math.max(getDiagonal(oldRect), getDiagonal(nextRect)) * 0.35;
  const isClose = distanceLimit > 0 && distance <= distanceLimit;

  if (iou < 0.2 && !isClose) {
    return null;
  }

  const distanceScore =
    distanceLimit > 0 ? Math.max(0, 1 - distance / distanceLimit) : 0;

  return iou * 2 + distanceScore;
}

function getRectSource(rect) {
  return rect?.generator || rect?.detectedSource || null;
}

function getSourceKey(rect) {
  const source = getRectSource(rect);

  if (!source?.type || !source?.sourceRectId) {
    return "";
  }

  return `${source.type}:${source.sourceRectId}`;
}

function getSegmentIndex(rect) {
  return getRectSource(rect)?.segmentIndex;
}

function getSourceMatchScore(oldRect, nextRect) {
  const oldSourceKey = getSourceKey(oldRect);
  const nextSourceKey = getSourceKey(nextRect);

  if (!oldSourceKey || oldSourceKey !== nextSourceKey) {
    return null;
  }

  const geometryScore = getMatchScore(oldRect, nextRect);
  const sameSegment = getSegmentIndex(oldRect) === getSegmentIndex(nextRect);

  if (geometryScore !== null) {
    return geometryScore + (sameSegment ? 1 : 0.5);
  }

  if (sameSegment) {
    return 0.1;
  }

  return null;
}

function findBestMatch(nextRect, oldRects, usedOldIndexes) {
  const nextSourceKey = getSourceKey(nextRect);

  function findMatch(scoreGetter) {
    let best = null;

    oldRects.forEach((oldRect, oldIndex) => {
      if (usedOldIndexes.has(oldIndex)) return;

      const score = scoreGetter(oldRect);
      if (score === null) return;

      if (!best || score > best.score) {
        best = { oldRect, oldIndex, score };
      }
    });

    return best;
  }

  if (nextSourceKey) {
    const sourceMatch = findMatch((oldRect) => getSourceMatchScore(oldRect, nextRect));

    if (sourceMatch) {
      return sourceMatch;
    }
  }

  const geometryMatch = findMatch((oldRect) => getMatchScore(oldRect, nextRect));

  return geometryMatch;
}

function hasGeometryChanged(oldRect, nextRect) {
  const epsilon = 0.001;

  return (
    Math.abs(oldRect.x - nextRect.x) > epsilon ||
    Math.abs(oldRect.y - nextRect.y) > epsilon ||
    Math.abs(oldRect.width - nextRect.width) > epsilon ||
    Math.abs(oldRect.height - nextRect.height) > epsilon
  );
}

export function reconcileDetectedRectangles({
  oldDetectedRects,
  nextGeometryRects,
  page,
  createDetectedRect,
  updatedAt,
}) {
  const oldPageRects = oldDetectedRects.filter((rect) => rect.page === page);
  const usedOldIndexes = new Set();

  return nextGeometryRects.reduce((nextRects, nextRect) => {
    const match = findBestMatch(nextRect, oldPageRects, usedOldIndexes);

    if (!match) {
      if (typeof createDetectedRect !== "function") {
        return nextRects;
      }

      nextRects.push(createDetectedRect(nextRect, nextRects.length));
      return nextRects;
    }

    usedOldIndexes.add(match.oldIndex);
    const shapePatch = {
      ...(match.oldRect.createdAt ? {} : { createdAt: updatedAt }),
      ...(hasGeometryChanged(match.oldRect, nextRect) ? { updatedAt } : {}),
    };

    nextRects.push({
      ...match.oldRect,
      ...nextRect,
      ...shapePatch,
      page,
    });

    return nextRects;
  }, []);
}
