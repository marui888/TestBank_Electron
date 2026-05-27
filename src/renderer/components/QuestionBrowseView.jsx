import { useEffect, useMemo, useRef, useState } from "react";
import PdfCompositeRegionView from "./PdfCompositeRegionView";
import { getQuestionRegionsById } from "../questionRegionUtils";

const MIN_STEM_PERCENT = 20;
const MAX_STEM_PERCENT = 65;

export default function QuestionBrowseView({
  pdfDoc,
  questionId,
  onQuestionIdChange,
  freeRectangles,
  detectedRectangles,
  onBack,
}) {
  const contentRef = useRef(null);
  const [activeSolutionNo, setActiveSolutionNo] = useState("");
  const [stemPercent, setStemPercent] = useState(34);
  const [isDraggingSplitter, setIsDraggingSplitter] = useState(false);
  const questionRegions = useMemo(
    () =>
      getQuestionRegionsById(questionId, {
        freeRectangles,
        detectedRectangles,
      }),
    [questionId, freeRectangles, detectedRectangles],
  );
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
              {activeAnswerGroup ? (
                <PdfCompositeRegionView
                  pdfDoc={pdfDoc}
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
