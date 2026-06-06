function getBusinessProps(region) {
  return region?.businessProps || {};
}

function getNumericValue(value, fallback = Number.MAX_SAFE_INTEGER) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function getTimestampValue(value) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function includesText(value, keyword) {
  const normalizedKeyword = normalizeText(keyword).toLowerCase();
  if (!normalizedKeyword) return true;

  return normalizeText(value).toLowerCase().includes(normalizedKeyword);
}

function isAnyValue(value) {
  return value === undefined || value === null || value === "" || value === "any";
}

function matchesExactOrAny(value, filterValue) {
  if (isAnyValue(filterValue)) return true;
  return normalizeText(value) === normalizeText(filterValue);
}

function isWithinDateRange(value, fromValue, toValue) {
  const timestamp = getTimestampValue(value);
  const fromTimestamp = getTimestampValue(fromValue);
  const toTimestamp = getTimestampValue(toValue);

  if (timestamp === null) {
    return fromTimestamp === null && toTimestamp === null;
  }

  if (fromTimestamp !== null && timestamp < fromTimestamp) return false;
  if (toTimestamp !== null && timestamp > toTimestamp) return false;
  return true;
}

function getRegionCreatedAt(region) {
  return region?.createdAt || getBusinessProps(region).createdAt || "";
}

function getRegionUpdatedAt(region) {
  return (
    region?.updatedAt ||
    getBusinessProps(region).updatedAt ||
    getRegionCreatedAt(region) ||
    ""
  );
}

function sortRegionsByFragmentOrder(regions) {
  return [...regions].sort((a, b) => {
    const aProps = getBusinessProps(a);
    const bProps = getBusinessProps(b);
    const fragmentDiff =
      getNumericValue(aProps.fragmentOrder) -
      getNumericValue(bProps.fragmentOrder);

    if (fragmentDiff !== 0) return fragmentDiff;

    return getNumericValue(a.id, 0) - getNumericValue(b.id, 0);
  });
}

function getFirstBusinessRegion(regions) {
  if (!regions.length) return null;

  const firstFragment = regions.find(
    (region) => String(getBusinessProps(region).fragmentOrder || "") === "1",
  );

  return firstFragment || sortRegionsByFragmentOrder(regions)[0];
}

function getQuestionEntityKey(pdfPath, questionId) {
  return `${pdfPath || ""}::${questionId || ""}`;
}

function createQuestionEntity({ tabId, pdfPath, pdfName, questionId }) {
  return {
    key: getQuestionEntityKey(pdfPath, questionId),
    tabId: tabId || "",
    pdfPath: pdfPath || "",
    pdfName: pdfName || "",
    questionId: questionId || "",
    stemRegions: [],
    answerGroups: [],
    analysisRegions: [],
    stemBusinessProps: null,
    answerBusinessProps: [],
    analysisBusinessProps: [],
    detailNoteSources: [],
    createdAt: "",
    updatedAt: "",
  };
}

function getQuestionEntityBusinessPropSources(entity) {
  return [
    entity.stemBusinessProps,
    ...entity.answerBusinessProps.map((item) => item.businessProps),
    ...entity.analysisBusinessProps.map((item) => item.businessProps),
  ].filter(Boolean);
}

function getPrimaryQuestionBusinessProps(entity) {
  return (
    entity.stemBusinessProps ||
    entity.answerBusinessProps[0]?.businessProps ||
    entity.analysisBusinessProps[0]?.businessProps ||
    {}
  );
}

function collectBusinessRegions(tab) {
  return [
    ...(tab?.freeRectangles || []),
    ...(tab?.detectedRectangles || []),
  ].filter((region) => {
    const props = getBusinessProps(region);
    return props.questionId && props.contentType !== "invalid";
  });
}

function updateEntityTimeRange(entity, regions) {
  const createdTimes = regions
    .map(getRegionCreatedAt)
    .map((value) => ({ value, timestamp: getTimestampValue(value) }))
    .filter((item) => item.timestamp !== null);
  const updatedTimes = regions
    .map(getRegionUpdatedAt)
    .map((value) => ({ value, timestamp: getTimestampValue(value) }))
    .filter((item) => item.timestamp !== null);

  if (createdTimes.length > 0) {
    const earliestCreated = createdTimes.reduce((earliest, item) =>
      item.timestamp < earliest.timestamp ? item : earliest,
    );
    entity.createdAt = earliestCreated.value;
  }

  if (updatedTimes.length > 0) {
    const latestUpdated = updatedTimes.reduce((latest, item) =>
      item.timestamp > latest.timestamp ? item : latest,
    );
    entity.updatedAt = latestUpdated.value;
  }
}

function createDetailNoteSource({ role, label, solutionNo, region }) {
  const businessProps = getBusinessProps(region);

  return {
    role,
    label,
    solutionNo: solutionNo || "",
    detailNotes: businessProps.detailNotes || "",
    businessProps,
    region,
  };
}

function finalizeQuestionEntity(entity) {
  entity.stemRegions = sortRegionsByFragmentOrder(entity.stemRegions);
  entity.analysisRegions = sortRegionsByFragmentOrder(entity.analysisRegions);

  const stemBusinessRegion = getFirstBusinessRegion(entity.stemRegions);
  entity.stemBusinessProps = stemBusinessRegion
    ? getBusinessProps(stemBusinessRegion)
    : null;

  const answerGroupsBySolutionNo = new Map();
  entity.answerGroups.forEach((group) => {
    const solutionNo = group.solutionNo || "1";
    const oldGroup = answerGroupsBySolutionNo.get(solutionNo);
    const nextRegions = [
      ...(oldGroup?.regions || []),
      ...(group.regions || []),
    ];

    answerGroupsBySolutionNo.set(solutionNo, {
      solutionNo,
      regions: sortRegionsByFragmentOrder(nextRegions),
    });
  });

  entity.answerGroups = Array.from(answerGroupsBySolutionNo.values()).sort(
    (a, b) => getNumericValue(a.solutionNo, 0) - getNumericValue(b.solutionNo, 0),
  );

  entity.answerBusinessProps = entity.answerGroups
    .map((group) => {
      const businessRegion = getFirstBusinessRegion(group.regions);
      return businessRegion
        ? {
            solutionNo: group.solutionNo,
            businessProps: getBusinessProps(businessRegion),
          }
        : null;
    })
    .filter(Boolean);

  entity.analysisBusinessProps = entity.analysisRegions.map((region) => ({
    businessProps: getBusinessProps(region),
  }));

  entity.detailNoteSources = [
    stemBusinessRegion
      ? createDetailNoteSource({
          role: "stem",
          label: "题干",
          region: stemBusinessRegion,
        })
      : null,
    ...entity.answerGroups.map((group) => {
      const businessRegion = getFirstBusinessRegion(group.regions);
      return businessRegion
        ? createDetailNoteSource({
            role: "answer",
            label: `答案${group.solutionNo}`,
            solutionNo: group.solutionNo,
            region: businessRegion,
          })
        : null;
    }),
  ].filter((source) => source?.detailNotes);

  updateEntityTimeRange(entity, [
    ...entity.stemRegions,
    ...entity.answerGroups.flatMap((group) => group.regions),
    ...entity.analysisRegions,
  ]);

  return entity;
}

export function collectQuestionEntitiesFromTab(tab) {
  const entitiesByKey = new Map();

  collectBusinessRegions(tab).forEach((region) => {
    const props = getBusinessProps(region);
    const questionId = props.questionId || "";
    const key = getQuestionEntityKey(tab?.pdfPath, questionId);
    const entity =
      entitiesByKey.get(key) ||
      createQuestionEntity({
        tabId: tab?.id,
        pdfPath: tab?.pdfPath,
        pdfName: tab?.pdfName,
        questionId,
      });

    if (props.contentType === "stem") {
      entity.stemRegions.push(region);
    } else if (props.contentType === "answer") {
      entity.answerGroups.push({
        solutionNo: String(props.solutionNo || "1"),
        regions: [region],
      });
    } else if (props.contentType === "analysis") {
      entity.analysisRegions.push(region);
    }

    entitiesByKey.set(key, entity);
  });

  return Array.from(entitiesByKey.values()).map(finalizeQuestionEntity);
}

export function collectQuestionEntitiesFromTabs(tabs = []) {
  return tabs.flatMap((tab) => collectQuestionEntitiesFromTab(tab));
}

export function createDefaultQuestionSearchFilters() {
  return {
    questionId: "",
    subject: "",
    stage: "any",
    grade: "",
    chapter: "",
    questionType: "any",
    detailNotes: "",
    createdAtFrom: "",
    createdAtTo: "",
    updatedAtFrom: "",
    updatedAtTo: "",
  };
}

function matchesBusinessPropField(entity, fieldName, filterValue) {
  if (isAnyValue(filterValue)) return true;

  return getQuestionEntityBusinessPropSources(entity).some((businessProps) => {
    if (fieldName === "subject" || fieldName === "grade" || fieldName === "chapter") {
      return includesText(businessProps[fieldName], filterValue);
    }

    return matchesExactOrAny(businessProps[fieldName], filterValue);
  });
}

function getDetailNoteHits(entity, detailNotesFilter) {
  if (!normalizeText(detailNotesFilter)) return [];

  return entity.detailNoteSources.filter((source) =>
    includesText(source.detailNotes, detailNotesFilter),
  );
}

export function searchQuestionEntities(entities = [], filters = {}) {
  const normalizedFilters = {
    ...createDefaultQuestionSearchFilters(),
    ...(filters || {}),
  };

  return entities
    .filter((entity) => {
      if (!includesText(entity.questionId, normalizedFilters.questionId)) {
        return false;
      }

      if (!matchesBusinessPropField(entity, "subject", normalizedFilters.subject)) {
        return false;
      }

      if (!matchesBusinessPropField(entity, "stage", normalizedFilters.stage)) {
        return false;
      }

      if (!matchesBusinessPropField(entity, "grade", normalizedFilters.grade)) {
        return false;
      }

      if (!matchesBusinessPropField(entity, "chapter", normalizedFilters.chapter)) {
        return false;
      }

      if (
        !matchesBusinessPropField(
          entity,
          "questionType",
          normalizedFilters.questionType,
        )
      ) {
        return false;
      }

      if (
        normalizeText(normalizedFilters.detailNotes) &&
        getDetailNoteHits(entity, normalizedFilters.detailNotes).length === 0
      ) {
        return false;
      }

      if (
        !isWithinDateRange(
          entity.createdAt,
          normalizedFilters.createdAtFrom,
          normalizedFilters.createdAtTo,
        )
      ) {
        return false;
      }

      if (
        !isWithinDateRange(
          entity.updatedAt,
          normalizedFilters.updatedAtFrom,
          normalizedFilters.updatedAtTo,
        )
      ) {
        return false;
      }

      return true;
    })
    .map((entity) => {
      const detailHits = getDetailNoteHits(entity, normalizedFilters.detailNotes);
      const detailHitLabels = Array.from(
        new Set(detailHits.map((source) => source.label).filter(Boolean)),
      );
      const businessProps = getPrimaryQuestionBusinessProps(entity);

      return {
        entity,
        key: entity.key,
        tabId: entity.tabId,
        pdfPath: entity.pdfPath,
        pdfName: entity.pdfName,
        questionId: entity.questionId,
        businessProps,
        detailHitLabels,
        detailHitText: detailHitLabels.join(" / "),
      };
    });
}
