function getBusinessProps(region) {
  return region?.businessProps || {};
}

function getNumericValue(value, fallback = Number.POSITIVE_INFINITY) {
  const numericValue = Number(value);

  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function compareRegions(a, b) {
  const aProps = getBusinessProps(a);
  const bProps = getBusinessProps(b);
  const fragmentOrderDiff =
    getNumericValue(aProps.fragmentOrder) - getNumericValue(bProps.fragmentOrder);

  if (fragmentOrderDiff !== 0) return fragmentOrderDiff;
  if (a.page !== b.page) return a.page - b.page;
  if (a.y !== b.y) return a.y - b.y;

  return a.x - b.x;
}

function compareAnswerGroups(a, b) {
  const solutionNoDiff =
    getNumericValue(a.solutionNo) - getNumericValue(b.solutionNo);

  if (solutionNoDiff !== 0) return solutionNoDiff;

  return String(a.solutionNo).localeCompare(String(b.solutionNo));
}

function cloneAndSortRegions(regions) {
  return [...regions].sort(compareRegions);
}

function getBusinessRegions({ freeRectangles = [], detectedRectangles = [] }) {
  return [
    ...freeRectangles.map((region) => ({
      ...region,
      shapeType: "freeRect",
    })),
    ...detectedRectangles.map((region) => ({
      ...region,
      shapeType: "detectedRect",
    })),
  ];
}

export function getQuestionRegionsById(
  questionId,
  { freeRectangles = [], detectedRectangles = [] } = {},
) {
  const matchedRegions = getBusinessRegions({
    freeRectangles,
    detectedRectangles,
  }).filter((region) => {
    const props = getBusinessProps(region);

    return props.contentType !== "invalid" && props.questionId === questionId;
  });

  const stemRegions = cloneAndSortRegions(
    matchedRegions.filter(
      (region) => getBusinessProps(region).contentType === "stem",
    ),
  );
  const analysisRegions = cloneAndSortRegions(
    matchedRegions.filter(
      (region) => getBusinessProps(region).contentType === "analysis",
    ),
  );
  const answerGroupsBySolutionNo = matchedRegions
    .filter((region) => getBusinessProps(region).contentType === "answer")
    .reduce((groups, region) => {
      const solutionNo = getBusinessProps(region).solutionNo || "1";
      const oldRegions = groups.get(solutionNo) || [];

      groups.set(solutionNo, [...oldRegions, region]);
      return groups;
    }, new Map());
  const answerGroups = Array.from(answerGroupsBySolutionNo.entries())
    .map(([solutionNo, regions]) => ({
      solutionNo,
      regions: cloneAndSortRegions(regions),
    }))
    .sort(compareAnswerGroups);

  return {
    questionId,
    stemRegions,
    answerGroups,
    analysisRegions,
  };
}
