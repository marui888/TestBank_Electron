import { getDefaultBusinessProps } from "./shapePropertyDefaults";

export function getShapeBusinessProps(shapeType, shape) {
  return {
    ...getDefaultBusinessProps(shapeType),
    ...(shape?.businessProps || {}),
  };
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
