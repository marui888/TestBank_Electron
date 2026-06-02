const rootDefinitions = [
  {
    key: "basicKnowledgePoints",
    label: "基础知识点",
    kind: "twoLevel",
  },
  {
    key: "extendedKnowledgePoints",
    label: "延伸知识点",
    kind: "oneLevel",
  },
  {
    key: "thinkingOrSkills",
    label: "思想或技巧",
    kind: "oneLevel",
  },
  {
    key: "mistakesAndReflection",
    label: "错题与反思",
    kind: "twoLevel",
  },
  {
    key: "uncategorized",
    label: "其它未归类",
    kind: "oneLevel",
  },
];

function getCommandRange(text, cursorIndex) {
  const beforeCursor = text.slice(0, cursorIndex);
  const start = beforeCursor.lastIndexOf(">>");

  if (start === -1) return null;

  const commandText = text.slice(start, cursorIndex);

  if (/\s/.test(commandText)) return null;

  return {
    start,
    end: cursorIndex,
    commandText,
  };
}

function includesText(value, query) {
  return String(value || "").includes(query);
}

function getRootNodes(metadata) {
  return rootDefinitions.map((definition, index) => ({
    ...definition,
    label: definition.label,
    index: index + 1,
    path: [index + 1],
    level: 1,
    value: definition.key,
    node: metadata?.[definition.key],
  }));
}

function getNodeLabelPath(node) {
  const labels = [];
  let currentNode = node;

  while (currentNode) {
    if (currentNode.label) {
      labels.unshift(currentNode.label);
    }
    currentNode = currentNode.parent;
  }

  return labels;
}

function getNodeInsertText(node) {
  return getNodeLabelPath(node).join("/");
}

function getChildNodes(parent) {
  if (!parent) return [];

  if (parent.kind === "twoLevel") {
    if (parent.level === 1) {
      return (Array.isArray(parent.node) ? parent.node : []).map(
        (categoryNode, index) => ({
          key: `${parent.key}:${categoryNode.category}`,
          label: categoryNode.category,
          index: index + 1,
          path: [...parent.path, index + 1],
          level: 2,
          parent,
          kind: "twoLevelLeafGroup",
          node: categoryNode.items || [],
        }),
      );
    }

    return (Array.isArray(parent.node) ? parent.node : []).map((item, index) => {
      const leafNode = {
        key: `${parent.key}:${item}`,
        label: item,
        index: index + 1,
        path: [...parent.path, index + 1],
        level: parent.level + 1,
        parent,
        kind: "leaf",
      };

      return {
        ...leafNode,
        insertText: getNodeInsertText(leafNode),
      };
    });
  }

  return (Array.isArray(parent.node) ? parent.node : []).map((item, index) => {
    const leafNode = {
      key: `${parent.key}:${item}`,
      label: item,
      index: index + 1,
      path: [...parent.path, index + 1],
      level: parent.level + 1,
      parent,
      kind: "leaf",
    };

    return {
      ...leafNode,
      insertText: getNodeInsertText(leafNode),
    };
  });
}

function matchNodes(nodes, token) {
  if (!token) return nodes;

  const numericIndex = Number(token);
  if (Number.isInteger(numericIndex) && numericIndex > 0) {
    return nodes.filter((node) => node.index === numericIndex);
  }

  return nodes.filter((node) => includesText(node.label, token));
}

function getDisplayItems(nodes) {
  return nodes.map((node) => ({
    key: node.key,
    label: node.label,
    path: node.path,
    level: node.level,
    isLeaf: node.kind === "leaf",
    insertText: node.insertText || (node.kind === "leaf" ? getNodeInsertText(node) : ""),
  }));
}

function buildResult(commandRange, patch) {
  return {
    active: true,
    commandRange,
    items: [],
    error: "",
    ...patch,
  };
}

function parseTokens(commandText) {
  return commandText.slice(2).split(">");
}

export function parseDetailPropertyCommand({
  text,
  cursorIndex,
  metadata,
}) {
  const commandRange = getCommandRange(text, cursorIndex);

  if (!commandRange) {
    return {
      active: false,
      commandRange: null,
      items: [],
      error: "",
    };
  }

  const tokens = parseTokens(commandRange.commandText);
  let currentNodes = getRootNodes(metadata);
  let selectedNode = null;

  for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex += 1) {
    const token = tokens[tokenIndex];
    const isLastToken = tokenIndex === tokens.length - 1;
    const matches = matchNodes(currentNodes, token);

    if (isLastToken) {
      if (matches.length === 1 && token && matches[0].kind !== "leaf") {
        const childNodes = getChildNodes(matches[0]);

        return buildResult(commandRange, {
          items: getDisplayItems(childNodes),
        });
      }

      return buildResult(commandRange, {
        items: getDisplayItems(matches),
        error: matches.length === 0 ? "没有匹配项" : "",
      });
    }

    if (matches.length === 0) {
      return buildResult(commandRange, {
        error: "路径没有匹配项",
      });
    }

    if (matches.length > 1) {
      return buildResult(commandRange, {
        items: getDisplayItems(matches),
        error: "路径不明确，请先选择一个候选项",
      });
    }

    selectedNode = matches[0];

    if (selectedNode.kind === "leaf") {
      return buildResult(commandRange, {
        items: getDisplayItems([selectedNode]),
        error: "已到最后一级，不能继续输入下一级",
      });
    }

    currentNodes = getChildNodes(selectedNode);
  }

  return buildResult(commandRange, {
    items: getDisplayItems(currentNodes),
  });
}

export function getDetailPropertyLeafPaths(metadata) {
  return getDetailPropertyLeafItems(metadata).map((item) => item.insertText);
}

export function getDetailPropertyLeafItems(metadata) {
  const leafItems = [];

  function collect(nodes) {
    nodes.forEach((node) => {
      if (node.kind === "leaf") {
        leafItems.push({
          ...getDisplayItems([node])[0],
          labelPath: getNodeLabelPath(node),
        });
        return;
      }

      collect(getChildNodes(node));
    });
  }

  collect(getRootNodes(metadata));
  return leafItems;
}
