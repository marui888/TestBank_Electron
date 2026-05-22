import { useEffect, useMemo, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faAsterisk,
  faCircleExclamation,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
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

export default function ShapePropertyEditor({
  open,
  editorKey,
  mode = "floating",
  dock = "none",
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
    isDocked ? dockClassNames[dock] : "",
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
    setDraftValue((oldValue) => ({
      ...oldValue,
      [field.name]: nextValue,
    }));
  }

  function saveDraft() {
    if (hasErrors) return false;

    onSave?.(draftValue);
    setSavedValue(draftValue);
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

        <div className="shape-property-editor-body">
          {schema.map((field) => (
            <DynamicField
              key={field.name}
              field={field}
              value={draftValue[field.name]}
              error={errors[field.name]}
              onChange={(nextValue) => updateField(field, nextValue)}
            />
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

function DynamicField({ field, value, error, onChange }) {
  const fieldId = `shape-property-${field.name}`;

  return (
    <label className="shape-property-field" htmlFor={fieldId}>
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

      {renderFieldInput(field, fieldId, value, onChange)}
      {error && <span className="shape-property-error">{error}</span>}
    </label>
  );
}

function renderFieldInput(field, fieldId, value, onChange) {
  if (field.type === "select") {
    return (
      <select
        id={fieldId}
        className="shape-property-control"
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
    return (
      <textarea
        id={fieldId}
        className="shape-property-control"
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
        checked={Boolean(value)}
        onChange={(e) => onChange(e.target.checked)}
      />
    );
  }

  if (field.type === "readonly") {
    return (
      <input
        id={fieldId}
        className="shape-property-control"
        value={value ?? ""}
        readOnly
      />
    );
  }

  return (
    <input
      id={fieldId}
      className="shape-property-control"
      type={field.type === "number" ? "number" : "text"}
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
