const questionMetadataFields = [
  {
    name: "questionNo",
    label: "题号",
    type: "text",
    required: true,
    defaultValue: "0.0.0.0",
    placeholder: "例如 0.0.0.0",
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
    type: "select",
    defaultValue: "undetermined",
    options: [{ label: "未定", value: "undetermined" }],
  },
  {
    name: "grade",
    label: "年级",
    type: "select",
    defaultValue: "undetermined",
    options: [{ label: "未定", value: "undetermined" }],
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
      name: "regionType",
      label: "区域类型",
      type: "select",
      required: true,
      options: [
        { label: "题干", value: "question" },
        { label: "选项", value: "option" },
        { label: "解析", value: "solution" },
      ],
    },
    {
      name: "locked",
      label: "锁定",
      type: "checkbox",
    },
    ...questionMetadataFields,
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
    ...questionMetadataFields,
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
