import { getDefaultBusinessProps } from "./shapePropertyDefaults";
import { shapePropertySchemas } from "./shapePropertySchemas";

const editorOnlyFieldsByShapeType = {
  freeRect: [
    {
      name: "isLastRect",
      label: "最后矩形",
      type: "checkbox",
      defaultValue: false,
      rowGroup: "multi-rect",
    },
  ],
  detectedRect: [
    {
      name: "isLastRect",
      label: "最后矩形",
      type: "checkbox",
      defaultValue: false,
      rowGroup: "multi-rect",
    },
  ],
};

export function getShapeBusinessProps(shapeType, shape) {
  const businessProps = shape?.businessProps || {};

  return {
    ...getDefaultBusinessProps(shapeType),
    ...businessProps,
    questionId: businessProps.questionId || businessProps.questionNo || "",
  };
}

export function getShapePropertyEditorSchema(shapeType) {
  const businessSchema = shapePropertySchemas[shapeType] || [];
  const editorOnlyFields = editorOnlyFieldsByShapeType[shapeType] || [];

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

export function updateShapeBusinessPropsInList(list, shapeId, nextProps) {
  return list.map((shape) =>
    shape.id === shapeId
      ? {
          ...shape,
          businessProps: {
            ...shape.businessProps,
            ...nextProps,
          },
        }
      : shape,
  );
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
