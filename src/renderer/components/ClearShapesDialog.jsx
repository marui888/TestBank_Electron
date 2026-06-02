import "./ClearShapesDialog.css";

export default function ClearShapesDialog({
  value,
  onChange,
  onConfirm,
  onCancel,
}) {
  if (!value) return null;

  const isRangeMode = value.mode === "range";

  function updateField(name, nextValue) {
    onChange?.({
      [name]: nextValue,
      error: "",
    });
  }

  return (
    <div className="clear-shapes-dialog-shell">
      <div className="clear-shapes-dialog-backdrop" onMouseDown={onCancel} />
      <section className="clear-shapes-dialog">
        <header className="clear-shapes-dialog-header">
          <div>
            <div className="clear-shapes-dialog-title">
              {isRangeMode ? "Clear" : "Clear page"}
            </div>
            <div className="clear-shapes-dialog-subtitle">
              {isRangeMode ? "Select page range and content" : "Current page"}
            </div>
          </div>
        </header>

        <div className="clear-shapes-dialog-body">
          <label className="clear-shapes-checkbox-row">
            <input
              type="checkbox"
              checked={value.allLines}
              onChange={(event) => updateField("allLines", event.target.checked)}
            />
            <span>All Lines</span>
          </label>
          <label className="clear-shapes-checkbox-row">
            <input
              type="checkbox"
              checked={value.allBasicRects}
              onChange={(event) =>
                updateField("allBasicRects", event.target.checked)
              }
            />
            <span>All Basic Rects</span>
          </label>
          <label className="clear-shapes-checkbox-row">
            <input
              type="checkbox"
              checked={value.allManualRects}
              onChange={(event) =>
                updateField("allManualRects", event.target.checked)
              }
            />
            <span>All Manual Rects</span>
          </label>

          {isRangeMode && (
            <div className="clear-shapes-range-block">
              <label className="clear-shapes-checkbox-row">
                <input
                  type="checkbox"
                  checked={value.allPages}
                  onChange={(event) =>
                    updateField("allPages", event.target.checked)
                  }
                />
                <span>All pages</span>
              </label>
              <div className="clear-shapes-page-row">
                <label>
                  <span>开始页</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    disabled={value.allPages}
                    value={value.startPage}
                    onChange={(event) =>
                      updateField("startPage", event.target.value)
                    }
                  />
                </label>
                <label>
                  <span>结束页</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    disabled={value.allPages}
                    value={value.endPage}
                    onChange={(event) =>
                      updateField("endPage", event.target.value)
                    }
                  />
                </label>
              </div>
            </div>
          )}

          {value.error && (
            <div className="clear-shapes-dialog-error">{value.error}</div>
          )}
        </div>

        <footer className="clear-shapes-dialog-footer">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="primary" onClick={onConfirm}>
            Confirm
          </button>
        </footer>
      </section>
    </div>
  );
}
