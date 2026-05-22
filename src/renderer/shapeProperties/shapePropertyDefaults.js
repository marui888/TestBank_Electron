import { shapePropertySchemas } from "./shapePropertySchemas";

export function getDefaultBusinessProps(shapeType) {
  const schema = shapePropertySchemas[shapeType] || [];

  return schema.reduce((defaults, field) => {
    if ("defaultValue" in field) {
      defaults[field.name] = field.defaultValue;
      return defaults;
    }

    if (field.type === "checkbox") {
      defaults[field.name] = false;
      return defaults;
    }

    if (field.type === "select") {
      defaults[field.name] = field.options?.[0]?.value || "";
      return defaults;
    }

    defaults[field.name] = "";
    return defaults;
  }, {});
}
