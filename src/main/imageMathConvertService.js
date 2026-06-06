/**
 * 数学图片源码转换服务。
 *
 * 这个文件服务于“把题目图片交给大模型识别，再保存为可校对源码”的方案。
 * 它只处理功能性流程，不处理 Electron 窗口、IPC 绑定和前端 UI。
 *
 * 当前流程：
 * 1. 读取题目图片并转换为 data URL。
 * 2. 按用户选择的输出格式生成不同提示词。
 * 3. 通过 OpenAI SDK 或 fetch 调用通义千问兼容接口。
 * 4. 保存模型原始返回、LaTeX 片段或 Typst 片段到 output_typst。
 * 5. 当选择 LatexToTypst_Local_MathOnly / All 时，先让模型输出 LaTeX，
 *    再使用 tex2typst 在本地转换为 Typst 片段。
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';
import { tex2typst } from 'tex2typst';

export function getOutputPictureDir() {
  return path.join(process.cwd(), 'output_picture');
}

export function getTypstOutputDir() {
  return path.join(process.cwd(), 'output_typst');
}

export function getSafeOutputPictureDir(outputDir) {
  const text = String(outputDir || '').trim();

  return text || getOutputPictureDir();
}

export function sanitizeOutputPictureFileName(fileName) {
  const fallbackName = `output_${Date.now()}.png`;
  const safeName = String(fileName || fallbackName)
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 180);

  const normalizedName = safeName || fallbackName;

  return /\.png$/i.test(normalizedName)
    ? normalizedName
    : `${normalizedName}.png`;
}

export function sanitizeOutputBaseName(fileName) {
  return String(fileName || `output_${Date.now()}`)
    .replace(/\.[^.]+$/i, '')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 160) || `output_${Date.now()}`;
}

export function getPngBytesFromDataUrl(pngDataUrl) {
  const text = String(pngDataUrl || '');
  const match = text.match(/^data:image\/png;base64,(.+)$/);

  if (!match) {
    throw new Error('Invalid PNG data URL.');
  }

  return Buffer.from(match[1], 'base64');
}

export function normalizeOutputFormat(outputFormat) {
  if (outputFormat === 'latex-to-typst-local') return 'latex-to-typst-local-math-only';
  if (outputFormat === 'latex-to-typst-local-math-only') {
    return 'latex-to-typst-local-math-only';
  }
  if (outputFormat === 'latex-to-typst-local-all') return 'latex-to-typst-local-all';
  return outputFormat === 'latex' ? 'latex' : 'typst';
}

export function getOutputFormatExtension(outputFormat) {
  return outputFormat === 'latex' ? 'tex' : 'typ';
}

export function getOutputFormatLabel(outputFormat) {
  if (outputFormat === 'latex-to-typst-local-math-only') {
    return 'LatexToTypst_Local_MathOnly';
  }
  if (outputFormat === 'latex-to-typst-local-all') return 'LatexToTypst_Local_All';
  return outputFormat === 'latex' ? 'LaTeX' : 'Typst';
}

export function getPromptOutputFormat(outputFormat) {
  return outputFormat === 'latex' ||
    outputFormat === 'latex-to-typst-local-math-only' ||
    outputFormat === 'latex-to-typst-local-all'
    ? 'latex'
    : 'typst';
}

function getImageMimeType(imagePath) {
  const ext = path.extname(imagePath || '').toLowerCase();

  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';

  return 'image/png';
}

function stripSourceCodeFence(text) {
  const value = String(text || '').trim();
  const match = value.match(/^```(?:typst|typ|latex|tex)?\s*([\s\S]*?)\s*```$/i);

  return match ? match[1].trim() : value;
}

function createImageToTypstPrompt() {
  return `请识别图片中的数学题内容，并转换为可编译的 Typst 源码。

严格要求：
1. 只输出 Typst 源码，不要解释，不要 Markdown 代码围栏。
2. 禁止输出 LaTeX 语法。不要使用 \\begin、\\end、\\frac、\\sqrt、\\overrightarrow、\\left、\\right、tabular、array 等 LaTeX 命令或环境。
3. 数学表达式必须使用 Typst 数学语法，数学内容放在 $...$ 中。
4. 向量箭头使用 Typst 写法，例如 $arrow(A B)$，不要写 \\overrightarrow{AB}，也不要写 overrightarrow 或 verrightarrow。
5. 分式使用 Typst 写法，例如 $frac(a, b)$；根号使用 $sqrt(x)$。
6. 在几何题中，点名、线段名、多边形顶点名如果由连续大写英文字母组成，必须在 Typst 数学环境中用空格分开：$AB$ 写成 $A B$，$ABCD$ 写成 $A B C D$；不要写成 $AB$ 或 $ABCD$。普通代数变量 a、b、c、d 可以保持原样。
7. 选择题选项用普通分行文本，不要用表格环境。
8. 尽量保持题干、答案、解题步骤的原有结构和阅读顺序。
9. 中文必须保持为正常 UTF-8 中文，不要输出乱码；如果无法识别，使用 #text(fill: red)[待核对]。
10. 不要臆造图片中没有的内容；看不清的位置用 #text(fill: red)[待核对] 标注。

输出示例风格：
6. 化简：$arrow(A B) - arrow(D C) - arrow(C B) = $（  ）

已知四边形 $A B C D$ 为平行四边形。

A. $arrow(A C)$
B. $arrow(D A)$
C. $arrow(A D)$
D. $arrow(D B)$`;
}

function createImageToLatexPrompt() {
  return `请识别图片中的数学题内容，并转换为 LaTeX 源码片段。

严格要求：
1. 只输出 LaTeX 源码片段，不要解释，不要 Markdown 代码围栏。
2. 不要输出完整文档。不要包含 \\documentclass、\\begin{document}、\\end{document}。
3. 数学表达式必须使用 LaTeX 标准语法，数学内容放在 $...$ 中。
4. 向量箭头使用 LaTeX 标准写法，例如 $\\overrightarrow{AB}$，不要使用 \\vv。
5. 分式使用 \\frac{a}{b}；根号使用 \\sqrt{x}。
6. 选择题选项用普通分行文本，不要用 tabular、array 等表格环境。
7. 尽量保持题干、答案、解题步骤的原有结构和阅读顺序。
8. 中文必须保持为正常 UTF-8 中文，不要输出乱码；如果无法识别，使用 \\textcolor{red}{待核对} 标注。
9. 不要臆造图片中没有的内容。

输出示例风格：
6. 化简：$\\overrightarrow{AB}-\\overrightarrow{DC}-\\overrightarrow{CB}=$（  ）

A. $\\overrightarrow{AC}$
B. $\\overrightarrow{DA}$
C. $\\overrightarrow{AD}$
D. $\\overrightarrow{DB}$`;
}

function getImageConvertPrompt(outputFormat) {
  return outputFormat === 'latex'
    ? createImageToLatexPrompt()
    : createImageToTypstPrompt();
}

function convertLatexMathToTypstMath(latexMath) {
  return tex2typst(latexMath, {
    fracToSlash: false,
  });
}

export function convertLatexFragmentToTypstFragment(latexSource) {
  const text = String(latexSource || '');
  let index = 0;
  let result = '';

  while (index < text.length) {
    const dollarIndex = text.indexOf('$', index);
    const inlineParenIndex = text.indexOf('\\(', index);
    const displayBracketIndex = text.indexOf('\\[', index);
    const candidates = [
      dollarIndex >= 0 ? { index: dollarIndex, type: 'dollar' } : null,
      inlineParenIndex >= 0 ? { index: inlineParenIndex, type: 'inlineParen' } : null,
      displayBracketIndex >= 0 ? { index: displayBracketIndex, type: 'displayBracket' } : null,
    ].filter(Boolean).sort((left, right) => left.index - right.index);
    const next = candidates[0];

    if (!next) {
      result += text.slice(index);
      break;
    }

    result += text.slice(index, next.index);

    if (next.type === 'dollar') {
      const endIndex = text.indexOf('$', next.index + 1);

      if (endIndex < 0) {
        result += text.slice(next.index);
        break;
      }

      const latexMath = text.slice(next.index + 1, endIndex);
      result += `$${convertLatexMathToTypstMath(latexMath)}$`;
      index = endIndex + 1;
      continue;
    }

    if (next.type === 'inlineParen') {
      const endIndex = text.indexOf('\\)', next.index + 2);

      if (endIndex < 0) {
        result += text.slice(next.index);
        break;
      }

      const latexMath = text.slice(next.index + 2, endIndex);
      result += `$${convertLatexMathToTypstMath(latexMath)}$`;
      index = endIndex + 2;
      continue;
    }

    const endIndex = text.indexOf('\\]', next.index + 2);

    if (endIndex < 0) {
      result += text.slice(next.index);
      break;
    }

    const latexMath = text.slice(next.index + 2, endIndex);
    result += `\n$${convertLatexMathToTypstMath(latexMath)}$\n`;
    index = endIndex + 2;
  }

  return result;
}

export function convertLatexFragmentToTypstAll(latexSource) {
  return tex2typst(String(latexSource || ''), {
    fracToSlash: false,
  });
}

function getImageConvertModelRequest({ imageDataUrl, model, outputFormat }) {
  return {
    model,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: getImageConvertPrompt(getPromptOutputFormat(outputFormat)) },
          {
            type: 'image_url',
            image_url: { url: imageDataUrl },
          },
        ],
      },
    ],
    temperature: 0.1,
  };
}

function getSourceCodeFromApiContent(rawText) {
  if (!rawText) {
    throw new Error('通义千问 API 没有返回文本内容。');
  }

  return {
    rawText,
    sourceCode: stripSourceCodeFence(rawText),
  };
}

async function convertImageToSourceWithOpenAI({
  apiKey,
  baseUrl,
  model,
  imageDataUrl,
  outputFormat,
}) {
  const openai = new OpenAI({
    apiKey,
    baseURL: baseUrl,
  });
  const completion = await openai.chat.completions.create(
    getImageConvertModelRequest({ imageDataUrl, model, outputFormat }),
  );
  const rawText = completion?.choices?.[0]?.message?.content || '';

  return {
    ...getSourceCodeFromApiContent(rawText),
    clientUsed: 'openai',
  };
}

async function convertImageToSourceWithFetch({
  apiKey,
  baseUrl,
  model,
  imageDataUrl,
  outputFormat,
}) {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(getImageConvertModelRequest({ imageDataUrl, model, outputFormat })),
  });

  const responseText = await response.text();
  let responseJson;

  try {
    responseJson = JSON.parse(responseText);
  } catch {
    throw new Error(`通义千问 API 返回非 JSON 内容：${responseText.slice(0, 300)}`);
  }

  if (!response.ok) {
    throw new Error(
      responseJson?.error?.message ||
        responseJson?.message ||
        `通义千问 API 调用失败：HTTP ${response.status}`,
    );
  }

  const rawText = responseJson?.choices?.[0]?.message?.content || '';

  return {
    ...getSourceCodeFromApiContent(rawText),
    clientUsed: 'fetch',
  };
}

export async function convertImageToSource({
  imagePath,
  baseUrl,
  model,
  client = 'openai',
  outputFormat = 'typst',
}) {
  const apiKey = process.env.DASHSCOPE_API_KEY;

  if (!apiKey) {
    throw new Error('DASHSCOPE_API_KEY 环境变量未设置。');
  }

  if (!imagePath) {
    throw new Error('未选择图片。');
  }

  const safeBaseUrl = String(baseUrl || '').replace(/\/+$/, '');
  const safeModel = String(model || '').trim();

  if (!safeBaseUrl) {
    throw new Error('API 地址不能为空。');
  }

  if (!safeModel) {
    throw new Error('视觉模型不能为空。');
  }

  const imageBytes = await fs.readFile(imagePath);
  const imageDataUrl = `data:${getImageMimeType(imagePath)};base64,${imageBytes.toString('base64')}`;
  const safeClient = String(client || 'openai').trim().toLowerCase();
  const safeOutputFormat = normalizeOutputFormat(outputFormat);

  if (safeClient === 'fetch') {
    return convertImageToSourceWithFetch({
      apiKey,
      baseUrl: safeBaseUrl,
      model: safeModel,
      imageDataUrl,
      outputFormat: safeOutputFormat,
    });
  }

  return convertImageToSourceWithOpenAI({
    apiKey,
    baseUrl: safeBaseUrl,
    model: safeModel,
    imageDataUrl,
    outputFormat: safeOutputFormat,
  });
}
