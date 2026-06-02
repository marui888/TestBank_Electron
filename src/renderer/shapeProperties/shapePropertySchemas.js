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
    rowGroup: "question-type",
  },
  {
    name: "contentType",
    label: "内容分类",
    type: "select",
    required: true,
    defaultValue: "stem",
    rowGroup: "question-type",
    options: [
      { label: "题干", value: "stem" },
      { label: "答案", value: "answer" },
      { label: "分析", value: "analysis" },
      { label: "无效", value: "invalid" },
    ],
  },
  {
    name: "isMultiRectPart",
    label: "一对多",
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
];

const questionBusinessFields = [
  {
    name: "subject",
    label: "科目",
    type: "text",
    defaultValue: "",
  },
  {
    name: "stage",
    label: "学段",
    type: "select",
    defaultValue: "undetermined",
    options: [
      { label: "小学", value: "primary" },
      { label: "初中", value: "junior" },
      { label: "高中", value: "senior" },
      { label: "未定", value: "undetermined" },
    ],
  },
  {
    name: "chapter",
    label: "章节",
    type: "text",
    defaultValue: "未定",
  },
  {
    name: "grade",
    label: "年级",
    type: "text",
    defaultValue: "未定",
  },
  {
    name: "questionType",
    label: "题型",
    type: "select",
    defaultValue: "undetermined",
    options: [
      { label: "选择", value: "choice" },
      { label: "填空", value: "blank" },
      { label: "解答", value: "solution" },
      { label: "未定", value: "undetermined" },
    ],
  },
  {
    name: "detailNotes",
    label: "详细属性",
    type: "textarea",
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
      defaultValue: "region_partition",
      options: [
        { label: "区域划分", value: "region_partition" },
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
    ...questionBusinessFields,
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
    ...questionBusinessFields,
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
