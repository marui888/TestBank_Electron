const oneToEightOptions = Array.from({ length: 8 }, (_, index) => {
  const value = String(index + 1);

  return {
    label: value,
    value,
  };
});

const questionMatchFields = [
  {
    name: "questionId",
    label: "题目ID",
    type: "text",
    defaultValue: "",
    placeholder: "例如 1.2.3.4",
    clearable: true,
  },
  {
    name: "contentType",
    label: "内容分类",
    type: "select",
    required: true,
    defaultValue: "stem",
    options: [
      { label: "题干", value: "stem" },
      { label: "答案", value: "answer" },
      { label: "分析", value: "analysis" },
    ],
  },
  {
    name: "isMultiRectPart",
    label: "多个矩形的一部分",
    type: "checkbox",
    defaultValue: false,
    rowGroup: "multi-rect",
  },
  {
    name: "solutionNo",
    label: "第几种解法",
    type: "select",
    defaultValue: "1",
    options: oneToEightOptions,
    rowGroup: "solution-fragment",
  },
  {
    name: "fragmentOrder",
    label: "分片顺序",
    type: "select",
    defaultValue: "1",
    options: oneToEightOptions,
    rowGroup: "solution-fragment",
  },
  {
    name: "updatedAt",
    label: "修改时间",
    type: "readonly",
    defaultValue: "",
  },
];

export const shapePropertySchemas = {
  rect: [
    {
      name: "purpose",
      label: "用途",
      type: "select",
      required: true,
      options: [
        { label: "临时标注", value: "temporary" },
        { label: "人工修正", value: "manual_fix" },
        { label: "待确认", value: "pending" },
      ],
    },
    {
      name: "note",
      label: "备注",
      type: "textarea",
    },
  ],
  freeRect: [
    {
      name: "locked",
      label: "锁定",
      type: "checkbox",
    },
    ...questionMatchFields,
    {
      name: "note",
      label: "备注",
      type: "textarea",
    },
  ],
  detectedRect: [
    {
      name: "confirmed",
      label: "已确认",
      type: "checkbox",
      defaultValue: false,
      required: true,
    },
    {
      name: "source",
      label: "来源",
      type: "readonly",
      defaultValue: "auto_detected",
    },
    ...questionMatchFields,
    {
      name: "note",
      label: "备注",
      type: "textarea",
    },
  ],
  line: [
    {
      name: "lineRole",
      label: "直线用途",
      type: "select",
      required: true,
      options: [
        { label: "分割线", value: "divider" },
        { label: "辅助线", value: "helper" },
        { label: "边界线", value: "boundary" },
      ],
    },
    {
      name: "note",
      label: "备注",
      type: "textarea",
    },
  ],
};
