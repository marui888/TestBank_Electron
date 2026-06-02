import { useEffect, useMemo, useRef, useState } from "react";
import {
  getDetailPropertyLeafItems,
  parseDetailPropertyCommand,
} from "../detailProperties/detailPropertyCommandParser";
import { normalizeDetailNotes } from "../detailProperties/detailPropertyNotesNormalizer";
import { highSchoolMathDetailProperties } from "../metadata/highSchoolMathDetailProperties";

const POPOVER_WIDTH = 360;
const POPOVER_MAX_HEIGHT = 240;
const VIEWPORT_MARGIN = 12;
const INSERT_SEPARATOR = "；";
const NORMAL_TEXT_BOUNDARY_PATTERN = /[；;\n\s]/;

function getCaretPopoverPosition(textarea, cursorIndex) {
  if (!textarea) return null;

  const rect = textarea.getBoundingClientRect();
  const computedStyle = window.getComputedStyle(textarea);
  const mirror = document.createElement("div");
  const marker = document.createElement("span");
  const copiedStyleNames = [
    "boxSizing",
    "width",
    "height",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "borderTopWidth",
    "borderRightWidth",
    "borderBottomWidth",
    "borderLeftWidth",
    "fontFamily",
    "fontSize",
    "fontWeight",
    "lineHeight",
    "letterSpacing",
    "whiteSpace",
    "wordBreak",
    "overflowWrap",
  ];

  copiedStyleNames.forEach((name) => {
    mirror.style[name] = computedStyle[name];
  });

  mirror.style.position = "fixed";
  mirror.style.left = `${rect.left}px`;
  mirror.style.top = `${rect.top}px`;
  mirror.style.visibility = "hidden";
  mirror.style.pointerEvents = "none";
  mirror.style.overflow = "hidden";
  mirror.style.whiteSpace = "pre-wrap";

  const beforeCursor = textarea.value.slice(0, cursorIndex);
  const afterCursor = textarea.value.slice(cursorIndex);
  mirror.textContent = beforeCursor;
  marker.textContent = afterCursor.startsWith("\n") ? " " : "\u200b";
  mirror.appendChild(marker);
  document.body.appendChild(mirror);

  const markerRect = marker.getBoundingClientRect();
  const lineHeight = Number.parseFloat(computedStyle.lineHeight) || 18;
  const popoverWidth = Math.min(POPOVER_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2);
  const belowTop = markerRect.top + lineHeight - textarea.scrollTop + 4;
  const aboveTop = markerRect.top - textarea.scrollTop - POPOVER_MAX_HEIGHT - 4;
  const shouldShowAbove =
    belowTop + POPOVER_MAX_HEIGHT > window.innerHeight - VIEWPORT_MARGIN &&
    aboveTop >= VIEWPORT_MARGIN;
  const position = {
    left: Math.min(
      Math.max(markerRect.left, VIEWPORT_MARGIN),
      window.innerWidth - popoverWidth - VIEWPORT_MARGIN,
    ),
    top: shouldShowAbove
      ? aboveTop
      : Math.min(belowTop, window.innerHeight - VIEWPORT_MARGIN - 80),
  };

  document.body.removeChild(mirror);
  return position;
}

function replaceTextRange(text, range, replacement) {
  return `${text.slice(0, range.start)}${replacement}${text.slice(range.end)}`;
}

function getPathCommand(item) {
  return `>>${item.path.join(">")}`;
}

function getLeafInsertText(currentText, range, insertText) {
  const nextCharacter = currentText[range.end] || "";
  const needsSeparator =
    nextCharacter !== INSERT_SEPARATOR &&
    nextCharacter !== ";" &&
    nextCharacter !== "\n";

  return needsSeparator ? `${insertText}${INSERT_SEPARATOR}` : insertText;
}

function getSelectorInsertText(currentText, range, insertText) {
  const previousCharacter = currentText[range.start - 1] || "";
  const needsPrefix =
    previousCharacter &&
    previousCharacter !== INSERT_SEPARATOR &&
    previousCharacter !== ";" &&
    previousCharacter !== "\n";

  return `${needsPrefix ? INSERT_SEPARATOR : ""}${getLeafInsertText(
    currentText,
    range,
    insertText,
  )}`;
}

function getSuggestionFromCommand(commandText) {
  return parseDetailPropertyCommand({
    text: commandText,
    cursorIndex: commandText.length,
    metadata: highSchoolMathDetailProperties,
  });
}

function getNormalTextRange(text, cursorIndex) {
  const beforeCursor = text.slice(0, cursorIndex);
  let start = beforeCursor.length;

  while (
    start > 0 &&
    !NORMAL_TEXT_BOUNDARY_PATTERN.test(beforeCursor[start - 1])
  ) {
    start -= 1;
  }

  const query = beforeCursor.slice(start);

  if (!query || query.includes("/") || query.includes(">")) return null;

  return {
    start,
    end: cursorIndex,
    query,
  };
}

function parseNormalTextSuggestion({ text, cursorIndex, metadata }) {
  const commandRange = getNormalTextRange(text, cursorIndex);

  if (!commandRange) {
    return {
      active: false,
      commandRange: null,
      items: [],
      error: "",
    };
  }

  const items = getDetailPropertyLeafItems(metadata).filter((item) =>
    String(item.label || "").includes(commandRange.query),
  );

  return {
    active: items.length > 0,
    commandRange,
    items,
    error: items.length === 0 ? "没有匹配项" : "",
  };
}

export default function DetailPropertyTextarea({
  id,
  className,
  disabled,
  value,
  placeholder,
  onChange,
}) {
  const textareaRef = useRef(null);
  const [suggestion, setSuggestion] = useState({
    active: false,
    commandRange: null,
    items: [],
    error: "",
  });
  const [activeIndex, setActiveIndex] = useState(0);
  const [popoverPosition, setPopoverPosition] = useState(null);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectorCommand, setSelectorCommand] = useState(">>");
  const selectionRef = useRef({ start: 0, end: 0 });
  const activeSuggestItemRef = useRef(null);

  const visibleItems = useMemo(
    () => (suggestion.active ? suggestion.items || [] : []),
    [suggestion],
  );
  const selectorSuggestion = useMemo(
    () => getSuggestionFromCommand(selectorCommand),
    [selectorCommand],
  );
  const selectorItems = selectorSuggestion.items || [];
  const canSelectorGoBack = selectorCommand.slice(2).length > 0;

  function refreshSuggestion(text, cursorIndex) {
    const commandSuggestion = parseDetailPropertyCommand({
      text,
      cursorIndex,
      metadata: highSchoolMathDetailProperties,
    });
    const nextSuggestion = commandSuggestion.active
      ? commandSuggestion
      : parseNormalTextSuggestion({
          text,
          cursorIndex,
          metadata: highSchoolMathDetailProperties,
        });

    setSuggestion(nextSuggestion);
    setActiveIndex(0);

    if (nextSuggestion.active) {
      setPopoverPosition(getCaretPopoverPosition(textareaRef.current, cursorIndex));
    } else {
      setPopoverPosition(null);
    }
  }

  function closeSuggestion() {
    setSuggestion({
      active: false,
      commandRange: null,
      items: [],
      error: "",
    });
    setPopoverPosition(null);
  }

  function applyItem(item) {
    const textarea = textareaRef.current;
    const currentText = value ?? "";
    const range = suggestion.commandRange;

    if (!range || !item) return;

    if (!item.isLeaf) {
      const nextCommand = getPathCommand(item);
      const nextText = replaceTextRange(currentText, range, nextCommand);
      const nextCursorIndex = range.start + nextCommand.length;

      onChange(nextText);
      window.requestAnimationFrame(() => {
        textarea?.focus();
        textarea?.setSelectionRange(nextCursorIndex, nextCursorIndex);
        refreshSuggestion(nextText, nextCursorIndex);
      });
      return;
    }

    const insertText = getLeafInsertText(
      currentText,
      range,
      item.insertText || item.label,
    );
    const nextText = replaceTextRange(currentText, range, insertText);
    const nextCursorIndex = range.start + insertText.length;

    onChange(nextText);
    closeSuggestion();
    window.requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(nextCursorIndex, nextCursorIndex);
    });
  }

  function rememberSelection(target) {
    selectionRef.current = {
      start: target.selectionStart,
      end: target.selectionEnd,
    };
  }

  function toggleSelector() {
    setSelectorOpen((oldOpen) => {
      const nextOpen = !oldOpen;
      if (nextOpen) {
        closeSuggestion();
        setSelectorCommand(">>");
      }
      return nextOpen;
    });
  }

  function closeSelector() {
    setSelectorOpen(false);
    textareaRef.current?.focus();
  }

  function goBackSelector() {
    setSelectorCommand((oldCommand) => {
      const pathText = oldCommand.slice(2);
      const pathParts = pathText.split(">").filter(Boolean);
      pathParts.pop();
      return pathParts.length > 0 ? `>>${pathParts.join(">")}` : ">>";
    });
  }

  function applySelectorItem(item) {
    const textarea = textareaRef.current;

    if (!item) return;

    if (!item.isLeaf) {
      setSelectorCommand(getPathCommand(item));
      return;
    }

    const currentText = value ?? "";
    const range = selectionRef.current;
    const insertText = getSelectorInsertText(
      currentText,
      range,
      item.insertText || item.label,
    );
    const nextText = replaceTextRange(currentText, range, insertText);
    const nextCursorIndex = range.start + insertText.length;

    onChange(nextText);
    setSelectorOpen(false);
    window.requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(nextCursorIndex, nextCursorIndex);
      selectionRef.current = {
        start: nextCursorIndex,
        end: nextCursorIndex,
      };
    });
  }

  function sortDetailNotes() {
    const textarea = textareaRef.current;
    const nextText = normalizeDetailNotes(
      value ?? "",
      highSchoolMathDetailProperties,
    );

    onChange(nextText);
    closeSuggestion();
    window.requestAnimationFrame(() => {
      const nextCursorIndex = nextText.length;
      textarea?.focus();
      textarea?.setSelectionRange(nextCursorIndex, nextCursorIndex);
      selectionRef.current = {
        start: nextCursorIndex,
        end: nextCursorIndex,
      };
    });
  }

  function handleChange(e) {
    rememberSelection(e.target);
    onChange(e.target.value);
    refreshSuggestion(e.target.value, e.target.selectionStart);
  }

  function handleSelect(e) {
    rememberSelection(e.target);
    refreshSuggestion(e.target.value, e.target.selectionStart);
  }

  function handleKeyDown(e) {
    if (!suggestion.active) return;

    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      e.nativeEvent?.stopImmediatePropagation?.();
      closeSuggestion();
      textareaRef.current?.focus();
      return;
    }

    if (visibleItems.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      setActiveIndex((oldIndex) => (oldIndex + 1) % visibleItems.length);
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      setActiveIndex(
        (oldIndex) => (oldIndex - 1 + visibleItems.length) % visibleItems.length,
      );
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      applyItem(visibleItems[activeIndex]);
    }
  }

  useEffect(() => {
    if (disabled) closeSuggestion();
  }, [disabled]);

  useEffect(() => {
    if (!suggestion.active || visibleItems.length === 0) return;

    activeSuggestItemRef.current?.scrollIntoView({
      block: "nearest",
    });
  }, [activeIndex, suggestion.active, visibleItems.length]);

  return (
    <div className="detail-property-textarea-wrap">
      <div className="detail-property-toolbar">
        <button
          type="button"
          className="detail-property-tag-button secondary"
          disabled={disabled || !String(value || "").trim()}
          onClick={sortDetailNotes}
        >
          排序
        </button>
        <button
          type="button"
          className={`detail-property-tag-button ${selectorOpen ? "active" : ""}`}
          disabled={disabled}
          onClick={toggleSelector}
        >
          选择标签
        </button>
        {selectorOpen && (
          <button
            type="button"
            className="detail-property-tag-button secondary"
            onClick={closeSelector}
          >
            收起
          </button>
        )}
      </div>

      {selectorOpen && (
        <div className="detail-property-selector-panel">
          <div className="detail-property-selector-header">
            <span className="detail-property-selector-path">
              {selectorCommand === ">>"
                ? "全部分类"
                : selectorCommand.replace(">>", "")}
            </span>
            <button
              type="button"
              className="detail-property-selector-back"
              disabled={!canSelectorGoBack}
              onClick={goBackSelector}
            >
              返回
            </button>
          </div>

          {selectorItems.length > 0 ? (
            <div className="detail-property-selector-list">
              {selectorItems.map((item) => (
                <button
                  key={`${item.path.join(".")}:${item.label}`}
                  type="button"
                  className={`detail-property-selector-item ${
                    item.isLeaf ? "leaf-item" : "branch-item"
                  }`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applySelectorItem(item)}
                >
                  <span className="detail-property-selector-index">
                    {item.path.join(".")}
                  </span>
                  <span className="detail-property-selector-label">
                    {item.label}
                  </span>
                  <span className="detail-property-selector-action">
                    {item.isLeaf ? "插入" : "下级"}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="detail-property-selector-empty">
              {selectorSuggestion.error || "没有候选项"}
            </div>
          )}
        </div>
      )}

      <textarea
        ref={textareaRef}
        id={id}
        className={className}
        disabled={disabled}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={handleChange}
        onSelect={handleSelect}
        onKeyDown={handleKeyDown}
      />

      {suggestion.active && popoverPosition && (
        <div
          className="detail-property-suggest-popover"
          style={{
            left: `${popoverPosition.left}px`,
            top: `${popoverPosition.top}px`,
          }}
        >
          {visibleItems.length > 0 ? (
            <ul className="detail-property-suggest-list">
              {visibleItems.map((item, index) => (
                <li key={`${item.path.join(".")}:${item.label}`}>
                  <button
                    ref={index === activeIndex ? activeSuggestItemRef : null}
                    type="button"
                    className={`detail-property-suggest-item ${
                      index === activeIndex ? "active" : ""
                    } ${item.isLeaf ? "leaf-item" : "branch-item"}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyItem(item)}
                  >
                    <span className="detail-property-suggest-index">
                      {item.path.join(".")}
                    </span>
                    <span className="detail-property-suggest-label">
                      {item.label}
                    </span>
                    {!item.isLeaf && (
                      <span className="detail-property-suggest-more">下级</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="detail-property-suggest-empty">
              {suggestion.error || "没有候选项"}
            </div>
          )}

          {suggestion.error && visibleItems.length > 0 && (
            <div className="detail-property-suggest-error">
              {suggestion.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
