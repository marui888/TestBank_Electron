## 打包报错
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"

## 查询系统代理和设置系统代理
Get-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings" | Select-Object ProxyEnable, ProxyServer

git config --global http.proxy http://127.0.0.1:7890
git config --global https.proxy http://127.0.0.1:7890

git remote -v
git config --global --get http.proxy
git config --global --get https.proxy

## 打开大型PDF，UI冻结。

问题根因基本清楚了：

一开始第 1、2 步改造时，我把“多 PDF Tab 状态”和“PDF 二进制内容”混在了一起处理。对小 PDF 没明显问题，但 43MB PDF 会把 renderer 线程压住。

具体过程是：

最初的问题点：PDF 二进制进了 React state / Tab 快照
我一开始把 Uint8Array 形式的 PDF 数据放进 pdfTabs 或当前 pdfFile state。
43MB 数据进入 React state 后，React、DevTools、Vite 开发环境都会参与追踪/更新这个大对象，容易卡死。

第二个问题点：为避开 PDF.js Worker 复用问题，又加了复制
我曾加过：

sourceData.slice(0)
这会复制 43MB 数据。打开一次可能出现多次 43MB 级别复制，导致 UI 更容易冻结。

第三个问题点：改造后没有完全保留旧项目验证过的打开时序
旧项目里已经证明，大 PDF 要分阶段：

先设置轻量状态
延迟设置 PDF 数据
再延迟挂载 <Document>
我第一次改造时虽然保留了一部分延迟，但仍然太早把大二进制放入 state。

最终修复是：

PDF 原始二进制只放在 pdfDataByTabIdRef，不进 React state。
React state 里只保存轻量的 pdfObjectUrl 字符串。
渲染时用：
const blob = new Blob([sourceData], { type: "application/pdf" });
const url = URL.createObjectURL(blob);
然后传给：
<Document file={url}>
继续使用两段延迟打开流程。
关闭/切换时用 URL.revokeObjectURL() 回收 URL。
一句话总结：
PDF 文件内容是大资源，不应该放进 React state；React 只管理轻量状态，PDF 二进制放 ref，渲染层通过 Blob URL 交给 PDF.js。