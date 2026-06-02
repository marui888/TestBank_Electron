import { useEffect, useMemo, useRef, useState } from "react";
import PdfCompositeRegionView from "./PdfCompositeRegionView";
import {
  getQuestionRegionsById,
  getQuestionRegionsByIdAcrossSources,
} from "../questionRegionUtils";

const MIN_STEM_PERCENT = 20;
const MAX_STEM_PERCENT = 65;

export default function QuestionBrowseView({
  pdfDoc,
  pdfDocsByTabId,
  questionId,
  onQuestionIdChange,
  freeRectangles,
  detectedRectangles,
  sources = [],
  missingRelatedFiles = [],
  relatedErrors = [],
  relatedWarnings = [],
  onBack,
}) {
  const contentRef = useRef(null);
  const [activeSolutionNo, setActiveSolutionNo] = useState("");
  const [stemPercent, setStemPercent] = useState(34);
  const [isDraggingSplitter, setIsDraggingSplitter] = useState(false);
  const questionRegions = useMemo(
    () => {
      if (sources.length > 0) {
        return getQuestionRegionsByIdAcrossSources(questionId, sources);
      }

      return getQuestionRegionsById(questionId, {
        freeRectangles,
        detectedRectangles,
      });
    },
    [questionId, freeRectangles, detectedRectangles, sources],
  );
  const sourceSummary = useMemo(() => {
    const sourceNames = Array.from(
      new Set(
        [
          ...questionRegions.stemRegions,
          ...questionRegions.answerGroups.flatMap((group) => group.regions),
        ]
          .map((region) => region.sourcePdfName)
          .filter(Boolean),
      ),
    );

    return sourceNames.join(" / ");
  }, [questionRegions]);
  const activeAnswerGroup =
    questionRegions.answerGroups.find(
      (group) => group.solutionNo === activeSolutionNo,
    ) ||
    questionRegions.answerGroups[0] ||
    null;

  function handleQuestionIdChange(event) {
    setActiveSolutionNo("");
    onQuestionIdChange?.(event.target.value);
  }

  function handleSplitterMouseDown(event) {
    setIsDraggingSplitter(true);
    event.preventDefault();
  }

  useEffect(() => {
    if (!isDraggingSplitter) return undefined;

    function handleMouseMove(event) {
      const content = contentRef.current;
      if (!content) return;

      const rect = content.getBoundingClientRect();
      const nextPercent = ((event.clientX - rect.left) / rect.width) * 100;
      const clampedPercent = Math.min(
        MAX_STEM_PERCENT,
        Math.max(MIN_STEM_PERCENT, nextPercent),
      );

      setStemPercent(clampedPercent);
    }

    function handleMouseUp() {
      setIsDraggingSplitter(false);
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingSplitter]);

  return (
    <section className="question-browse-view">
      <header className="question-browse-toolbar">
        <div className="question-browse-title-block">
          <div className="question-browse-title">实体浏览模式</div>
          {sourceSummary && (
            <div className="question-browse-source-summary">
              {sourceSummary}
            </div>
          )}
          <label className="question-browse-id-field">
            <span>questionId</span>
            <input value={questionId} onChange={handleQuestionIdChange} />
          </label>
        </div>
        <button
          type="button"
          className="question-browse-return-button"
          onClick={onBack}
        >
          返回标注模式
        </button>
      </header>

      {!questionId && (
        <div className="question-browse-empty">
          请输入 questionId 以浏览题干和答案。
        </div>
      )}

      {questionId && (
        <div
          className={`question-browse-content ${
            isDraggingSplitter ? "dragging-splitter" : ""
          }`}
          ref={contentRef}
        >
          <section
            className="question-browse-stem-pane"
            style={{ flexBasis: `${stemPercent}%` }}
          >
            <div className="question-browse-pane-title">题干</div>
            <div className="question-browse-pane-body">
              <PdfCompositeRegionView
                pdfDoc={pdfDoc}
                pdfDocsByTabId={pdfDocsByTabId}
                regions={questionRegions.stemRegions}
                mode="compose"
                className="question-browse-region-view"
              />
            </div>
          </section>

          <div
            className="question-browse-splitter"
            onMouseDown={handleSplitterMouseDown}
          />

          <section className="question-browse-answer-pane">
            <div className="question-browse-pane-title">答案</div>
            <div className="question-browse-pane-body">
              {(relatedErrors.length > 0 ||
                relatedWarnings.length > 0 ||
                missingRelatedFiles.length > 0) && (
                <div className="question-browse-related-status">
                  {relatedErrors.map((message) => (
                    <div key={`error:${message}`} className="error">
                      {message}
                    </div>
                  ))}
                  {relatedWarnings.map((message) => (
                    <div key={`warning:${message}`}>{message}</div>
                  ))}
                  {missingRelatedFiles.map((file) => (
                    <div key={file.pdfPath}>
                      正在准备关联文件：{file.fileName}
                    </div>
                  ))}
                </div>
              )}
              {activeAnswerGroup ? (
                <PdfCompositeRegionView
                  pdfDoc={pdfDoc}
                  pdfDocsByTabId={pdfDocsByTabId}
                  regions={activeAnswerGroup.regions}
                  mode="compose"
                  className="question-browse-region-view"
                />
              ) : (
                <div className="question-browse-empty compact">
                  未找到答案矩形。
                </div>
              )}
            </div>

            <div className="question-answer-tab-list" role="tablist">
              {questionRegions.answerGroups.length === 0 && (
                <div className="question-answer-tab-empty">No answers</div>
              )}
              {questionRegions.answerGroups.map((group) => {
                const isActive =
                  group.solutionNo ===
                  (activeAnswerGroup?.solutionNo || group.solutionNo);

                return (
                  <button
                    key={group.solutionNo}
                    type="button"
                    role="tab"
                    className={`question-answer-tab ${
                      isActive ? "active" : ""
                    }`}
                    onClick={() => setActiveSolutionNo(group.solutionNo)}
                  >
                    解法 {group.solutionNo}
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
