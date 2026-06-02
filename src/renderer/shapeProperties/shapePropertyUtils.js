import { getDefaultBusinessProps } from "./shapePropertyDefaults";
import { shapePropertySchemas } from "./shapePropertySchemas";

const editorOnlyFieldsByShapeType = {
  freeRect: [
    {
      name: "questionIdReadonly",
      label: "题目ID",
      type: "readonly",
      defaultValue: "",
      viewTab: "business",
      viewSection: "basic",
      mirrorOf: "questionId",
    },
    {
      name: "isLastRect",
      label: "最后矩形",
      type: "checkbox",
      defaultValue: false,
      rowGroup: "multi-rect",
      viewTab: "geometry",
    },
  ],
  detectedRect: [
    {
      name: "questionIdReadonly",
      label: "题目ID",
      type: "readonly",
      defaultValue: "",
      viewTab: "business",
      viewSection: "basic",
      mirrorOf: "questionId",
    },
    {
      name: "isLastRect",
      label: "最后矩形",
      type: "checkbox",
      defaultValue: false,
      rowGroup: "multi-rect",
      viewTab: "geometry",
    },
  ],
};

const businessShapeTypes = new Set(["freeRect", "detectedRect"]);
const businessTabFieldNames = new Set([
  "subject",
  "stage",
  "chapter",
  "grade",
  "questionType",
  "detailNotes",
]);
const basicBusinessFieldNames = new Set([
  "questionIdReadonly",
  "subject",
  "stage",
  "chapter",
  "grade",
  "questionType",
]);

const businessFieldRowGroups = {
  questionIdReadonly: "business-basic-1",
  stage: "business-basic-1",
  grade: "business-basic-2",
  chapter: "business-basic-2",
  subject: "business-basic-3",
  questionType: "business-basic-3",
};

const businessFieldViewOrders = {
  questionIdReadonly: 10,
  stage: 20,
  grade: 30,
  chapter: 40,
  subject: 50,
  questionType: 60,
  detailNotes: 70,
};

function withBusinessRectViewTab(shapeType, field) {
  if (!businessShapeTypes.has(shapeType)) return field;
  const isBusinessField =
    businessTabFieldNames.has(field.name) || field.viewTab === "business";

  return {
    ...field,
    viewTab: field.viewTab || (isBusinessField ? "business" : "geometry"),
    viewSection: isBusinessField
      ? basicBusinessFieldNames.has(field.name)
        ? "basic"
        : "detail"
      : field.viewSection,
    rowGroup: businessFieldRowGroups[field.name] || field.rowGroup,
    viewOrder: businessFieldViewOrders[field.name],
  };
}

export function getShapeBusinessProps(shapeType, shape) {
  const businessProps = shape?.businessProps || {};
  const legacyNotePatch =
    businessShapeTypes.has(shapeType) &&
    !businessProps.detailNotes &&
    businessProps.note
      ? { detailNotes: businessProps.note }
      : {};

  return {
    ...getDefaultBusinessProps(shapeType),
    ...businessProps,
    ...legacyNotePatch,
    questionId: businessProps.questionId || businessProps.questionNo || "",
  };
}

export function getShapePropertyEditorSchema(shapeType) {
  const businessSchema = (shapePropertySchemas[shapeType] || []).map((field) =>
    withBusinessRectViewTab(shapeType, field),
  );
  const editorOnlyFields = (editorOnlyFieldsByShapeType[shapeType] || []).map(
    (field) => withBusinessRectViewTab(shapeType, field),
  );

  if (editorOnlyFields.length === 0) return businessSchema;

  const insertAfterIndex = businessSchema.findIndex(
    (field) => field.name === "isMultiRectPart",
  );

  if (insertAfterIndex === -1) {
    return [...businessSchema, ...editorOnlyFields];
  }

  return [
    ...businessSchema.slice(0, insertAfterIndex + 1),
    ...editorOnlyFields,
    ...businessSchema.slice(insertAfterIndex + 1),
  ];
}

export function getBusinessPropsFromEditorValue(shapeType, editorValue) {
  const businessFieldNames = new Set(
    (shapePropertySchemas[shapeType] || []).map((field) => field.name),
  );

  return Object.fromEntries(
    Object.entries(editorValue || {}).filter(([fieldName]) =>
      businessFieldNames.has(fieldName),
    ),
  );
}

export function updateShapeBusinessPropsInList(
  list,
  shapeId,
  nextProps,
  shapePatch = {},
) {
  return list.map((shape) => {
    const { updatedAt, createdAt, ...oldBusinessProps } =
      shape.businessProps || {};

    return shape.id === shapeId
      ? {
          ...shape,
          ...shapePatch,
          businessProps: {
            ...oldBusinessProps,
            ...nextProps,
          },
        }
      : shape;
  });
}

export function isEmptyFieldValue(field, value) {
  if (field.type === "checkbox") {
    return value !== true && value !== false;
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  return value === undefined || value === null || value === "";
}

export function validateBusinessProps(schema, businessProps) {
  return schema.reduce((errors, field) => {
    if (field.required && isEmptyFieldValue(field, businessProps[field.name])) {
      errors[field.name] = `${field.label}不能为空`;
    }

    return errors;
  }, {});
}
