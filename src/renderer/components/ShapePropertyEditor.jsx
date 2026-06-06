import { useEffect, useMemo, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faAsterisk,
  faCircleExclamation,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import DetailPropertyTextarea from "./DetailPropertyTextarea";
import { normalizeDetailNotes } from "../detailProperties/detailPropertyNotesNormalizer";
import { highSchoolMathDetailProperties } from "../metadata/highSchoolMathDetailProperties";
import { getShapePropertyFieldState } from "../shapeProperties/shapePropertyEditorRules";
import { validateBusinessProps } from "../shapeProperties/shapePropertyUtils";
import "./ShapePropertyEditor.css";

const dockClassNames = {
  none: "",
  left: "dock-left",
  right: "dock-right",
  top: "dock-top",
  bottom: "dock-bottom",
};

function getValueSignature(value) {
  return JSON.stringify(value || {});
}

function getFieldRows(schema) {
  const rows = [];
  let currentRow = null;

  schema.forEach((field) => {
    if (!field.rowGroup) {
      currentRow = null;
      rows.push([field]);
      return;
    }

    if (currentRow?.rowGroup === field.rowGroup) {
      currentRow.fields.push(field);
      return;
    }

    currentRow = {
      rowGroup: field.rowGroup,
      fields: [field],
    };
    rows.push(currentRow.fields);
  });

  return rows;
}

const editorTabLabels = {
  geometry: "几何属性",
  business: "业务属性",
};

const editorSectionLabels = {
  basic: "基本属性",
  detail: "详细属性",
};

function getEditorTabs(schema) {
  const tabIds = [];

  schema.forEach((field) => {
    if (!field.viewTab || tabIds.includes(field.viewTab)) return;
    tabIds.push(field.viewTab);
  });

  return tabIds.map((id) => ({
    id,
    label: editorTabLabels[id] || id,
  }));
}

function isBusinessTabLocked(draftValue) {
  if (draftValue?.isMultiRectPart !== true) return false;
  return String(draftValue?.fragmentOrder || "") !== "1";
}

function isEditorTabDisabled(tabId, draftValue) {
  return tabId === "business" && isBusinessTabLocked(draftValue);
}

function getSectionedFieldRows(schema) {
  const sections = [];
  let currentSection = null;
  const orderedSchema = [...schema].sort(
    (a, b) =>
      (a.viewOrder ?? Number.MAX_SAFE_INTEGER) -
      (b.viewOrder ?? Number.MAX_SAFE_INTEGER),
  );

  orderedSchema.forEach((field) => {
    const sectionId = field.viewSection || "";

    if (!currentSection || currentSection.id !== sectionId) {
      currentSection = {
        id: sectionId,
        label: editorSectionLabels[sectionId] || "",
        fields: [],
      };
      sections.push(currentSection);
    }

    currentSection.fields.push(field);
  });

  return sections.map((section) => ({
    ...section,
    rows: getFieldRows(section.fields),
  }));
}

function getFieldRowClassName(fields) {
  const classNames = [
    fields.length > 1
      ? "shape-property-field-row"
      : "shape-property-single-field-row",
  ];

  if (fields[0]?.rowGroup) {
    classNames.push(`row-group-${fields[0].rowGroup}`);
  }

  if (fields.some((field) => field.name === "note")) {
    classNames.push("note-field-row");
  }

  if (fields.some((field) => field.name === "detailNotes")) {
    classNames.push("detail-notes-field-row");
  }

  return classNames.join(" ");
}

function normalizeDraftBeforeSave(draftValue) {
  if (!Object.prototype.hasOwnProperty.call(draftValue || {}, "detailNotes")) {
    return draftValue;
  }

  return {
    ...draftValue,
    detailNotes: normalizeDetailNotes(
      draftValue.detailNotes,
      highSchoolMathDetailProperties,
    ),
  };
}

export default function ShapePropertyEditor({
  open,
  editorKey,
  mode = "floating",
  dock = "none",
  placement = "center",
  shapeType = "",
  title = "属性编辑",
  schema = [],
  value = {},
  backgroundColor,
  onSave,
  onClose,
}) {
  const dragStateRef = useRef(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [draftValue, setDraftValue] = useState(value);
  const [savedValue, setSavedValue] = useState(value);
  const tabs = useMemo(() => getEditorTabs(schema), [schema]);
  const [activeTabId, setActiveTabId] = useState("");
  const visibleSchema =
    tabs.length > 0
      ? schema.filter((field) => field.viewTab === activeTabId)
      : schema;
  const visibleSections = useMemo(
    () => getSectionedFieldRows(visibleSchema),
    [visibleSchema],
  );

  const errors = useMemo(
    () => validateBusinessProps(schema, draftValue),
    [schema, draftValue],
  );
  const hasErrors = Object.keys(errors).length > 0;
  const isDirty = getValueSignature(draftValue) !== getValueSignature(savedValue);

  useEffect(() => {
    if (!open) return;

    setPosition({ x: 0, y: 0 });
    setDraftValue(value);
    setSavedValue(value);
  }, [open, editorKey]);

  useEffect(() => {
    if (!open) return;

    setActiveTabId(tabs[0]?.id || "");
  }, [open, editorKey, tabs]);

  useEffect(() => {
    if (!open || !activeTabId) return;
    if (!isEditorTabDisabled(activeTabId, draftValue)) return;

    const nextTab = tabs.find((tab) => !isEditorTabDisabled(tab.id, draftValue));
    setActiveTabId(nextTab?.id || "");
  }, [open, activeTabId, draftValue, tabs]);

  useEffect(() => {
    function handleMouseMove(e) {
      const dragState = dragStateRef.current;
      if (!dragState) return;

      setPosition({
        x: dragState.startX + e.clientX - dragState.pointerX,
        y: dragState.startY + e.clientY - dragState.pointerY,
      });
    }

    function handleMouseUp() {
      dragStateRef.current = null;
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e) {
      if (e.key === "Escape") {
        onClose?.();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const isDocked = mode === "dock" && dock !== "none";
  const shellClassName = [
    "shape-property-editor-shell",
    mode === "modal" ? "modal-mode" : "",
    mode === "dock" ? "dock-mode" : "",
    placement === "workspace-bottom-right"
      ? "workspace-bottom-right"
      : "",
    isDocked ? dockClassNames[dock] : "",
    shapeType ? `shape-type-${shapeType}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  function handleHeaderMouseDown(e) {
    if (isDocked) return;
    if (e.button !== 0) return;

    dragStateRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      startX: position.x,
      startY: position.y,
    };
    e.preventDefault();
  }

  function updateField(field, nextValue) {
    setDraftValue((oldValue) => {
      const nextDraftValue = {
        ...oldValue,
        [field.name]: nextValue,
      };

      if (field.name === "contentType" && nextValue === "invalid") {
        nextDraftValue.questionId = "";
      }

      return nextDraftValue;
    });
  }

  function clearField(field) {
    updateField(field, "");
  }

  function saveDraft() {
    if (hasErrors) return false;

    const normalizedDraftValue = normalizeDraftBeforeSave(draftValue);

    onSave?.(normalizedDraftValue);
    setDraftValue(normalizedDraftValue);
    setSavedValue(normalizedDraftValue);
    return true;
  }

  function saveAndClose() {
    if (saveDraft()) {
      onClose?.();
    }
  }

  return (
    <div className={shellClassName}>
      {mode === "modal" && <div className="shape-property-backdrop" />}

      <section
        className="shape-property-editor"
        style={{
          "--editor-x": `${position.x}px`,
          "--editor-y": `${position.y}px`,
          "--editor-bg": backgroundColor || "rgba(255, 255, 255, 0.96)",
        }}
      >
        <header
          className="shape-property-editor-header"
          onMouseDown={handleHeaderMouseDown}
        >
          <div className="shape-property-editor-title">
            <span>{title}</span>
            {isDirty && (
              <FontAwesomeIcon
                className="shape-property-dirty-icon"
                icon={faCircleExclamation}
                title="属性已经改变"
              />
            )}
          </div>
          <button
            type="button"
            className="shape-property-close-button"
            onClick={onClose}
            aria-label="关闭"
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </header>

        {tabs.length > 0 && (
          <nav className="shape-property-tabs" aria-label="属性分类">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                disabled={isEditorTabDisabled(tab.id, draftValue)}
                className={`shape-property-tab-button ${
                  activeTabId === tab.id ? "active" : ""
                }`}
                onClick={() => setActiveTabId(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        )}

        <div className="shape-property-editor-body">
          {visibleSections.map((section, sectionIndex) => (
            <div
              key={`${section.id || "default"}-${sectionIndex}`}
              className={`shape-property-section ${
                section.id ? `section-${section.id}` : ""
              }`}
            >
              {section.label && (
                <div className="shape-property-section-title">
                  {section.label}
                </div>
              )}
              {section.rows.map((fields) => (
                <div
                  key={fields.map((field) => field.name).join(":")}
                  className={getFieldRowClassName(fields)}
                >
                  {fields.map((field) => (
                    <DynamicField
                      key={field.name}
                      field={field}
                      value={
                        field.mirrorOf
                          ? draftValue[field.mirrorOf]
                          : draftValue[field.name]
                      }
                      error={errors[field.name]}
                      fieldState={getShapePropertyFieldState(field, draftValue)}
                      onChange={(nextValue) => updateField(field, nextValue)}
                      onClear={() => clearField(field)}
                    />
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>

        <footer className="shape-property-editor-footer">
          <button
            type="button"
            className="shape-property-action-button"
            disabled={hasErrors}
            onClick={saveDraft}
          >
            保存
          </button>
          <button
            type="button"
            className="shape-property-action-button"
            onClick={onClose}
          >
            退出
          </button>
          <button
            type="button"
            className="shape-property-action-button primary"
            disabled={hasErrors}
            onClick={saveAndClose}
          >
            保存并退出
          </button>
        </footer>
      </section>
    </div>
  );
}

function DynamicField({
  field,
  value,
  error,
  fieldState,
  onChange,
  onClear,
}) {
  const fieldId = `shape-property-${field.name}`;
  const isDisabled = Boolean(fieldState?.disabled);
  const fieldClassName = [
    "shape-property-field",
    isDisabled ? "disabled-field" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <label className={fieldClassName} htmlFor={fieldId}>
      <span className="shape-property-label">
        <span>{field.label}</span>
        {field.required && (
          <FontAwesomeIcon
            className="shape-property-required-icon"
            icon={faAsterisk}
            title="必填"
          />
        )}
      </span>

      <div className="shape-property-input-row">
        {renderFieldInput(field, fieldId, value, isDisabled, onChange)}
        {field.clearable && (
          <button
            type="button"
            className="shape-property-clear-field-button"
            disabled={isDisabled || !value}
            onClick={onClear}
          >
            清空
          </button>
        )}
      </div>
      {error && <span className="shape-property-error">{error}</span>}
    </label>
  );
}

function renderFieldInput(field, fieldId, value, disabled, onChange) {
  if (field.type === "select") {
    return (
      <select
        id={fieldId}
        className="shape-property-control"
        disabled={disabled}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      >
        {(field.options || []).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "textarea") {
    if (field.name === "detailNotes") {
      return (
        <DetailPropertyTextarea
          id={fieldId}
          className="shape-property-control"
          disabled={disabled}
          value={value}
          placeholder={field.placeholder}
          onChange={onChange}
        />
      );
    }

    return (
      <textarea
        id={fieldId}
        className="shape-property-control"
        disabled={disabled}
        value={value ?? ""}
        placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (field.type === "checkbox") {
    return (
      <input
        id={fieldId}
        className="shape-property-checkbox"
        type="checkbox"
        disabled={disabled}
        checked={Boolean(value)}
        onChange={(e) => onChange(e.target.checked)}
      />
    );
  }

  if (field.type === "readonly") {
    return (
      <input
        id={fieldId}
        className="shape-property-control readonly-control"
        value={value ?? ""}
        disabled={disabled}
        readOnly
      />
    );
  }

  return (
    <input
      id={fieldId}
      className="shape-property-control"
      type={field.type === "number" ? "number" : "text"}
      disabled={disabled}
      value={value ?? ""}
      placeholder={field.placeholder}
      onChange={(e) =>
        onChange(
          field.type === "number" ? Number(e.target.value) : e.target.value,
        )
      }
    />
  );
}
