# 让知识库真正"链"起来：OKF 规范与 xOKF 插件

## 前言

个人和团队的知识库，正在越来越多地长成一棵棵 Markdown 目录树：笔记、概念、索引，用文件夹和链接组织起来，用 Git 管理。这套朴素的做法有个名字——**OKF（Open Knowledge Format）**。但当知识长成多棵独立的树，"跨树引用"就成了一道天然的坎。**xOKF** 就是为解决这道坎而生的 VS Code 插件。

## 什么是 OKF

OKF 的核心思想很克制：**不建数据库，不搞 schema，结构完全交给文件系统承载**。

- 一个 Markdown 文件 = 一个 Concept（概念）
- 概念之间的关系，就是普通的 Markdown 链接，语义写在链接前后的文字里
- 唯一强制要求的元数据，只有 `type` 一个字段
- **损坏的链接是被允许的**——指向尚未创建的概念，不阻断整个知识库的生长

这套规则让知识库可以增量生长、随手扩展，但也带来一个缺口：规范本身**没有定义"跨 bundle 引用"该怎么写**。

## xokf:// ：一个自然生长出来的跨库引用扩展

为此，我们在 OKF 之上补了一个本地扩展：`xokf://<bundleID>/<conceptID>`。以一个约定文件 `xokf.md` 作为"联邦锚点"，任何引用只需向上找到最近的锚点，就能定位到另一棵知识树里的目标文件——即使两棵树来自完全不同的目录、完全不同的主题。

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 700" font-family="PingFang SC, Microsoft YaHei, sans-serif">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f8fafc"/>
      <stop offset="1" stop-color="#eaf3fc"/>
    </linearGradient>
    <marker id="arrowBlue" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="#1c83df"/>
    </marker>
  </defs>

  <rect width="1200" height="700" fill="url(#bg)"/>

  <text x="600" y="55" text-anchor="middle" font-size="30" font-weight="700" fill="#1f2937">OKF：知识以 Markdown 目录树的形式存在</text>

  <!-- federation anchor -->
  <rect x="500" y="90" width="200" height="50" rx="10" fill="#1c83df"/>
  <text x="600" y="122" text-anchor="middle" font-size="19" font-weight="700" fill="#ffffff">xokf.md · 联邦锚点</text>
  <line x1="560" y1="140" x2="300" y2="200" stroke="#1c83df" stroke-width="1.5" stroke-dasharray="4 5"/>
  <line x1="640" y1="140" x2="900" y2="200" stroke="#1c83df" stroke-width="1.5" stroke-dasharray="4 5"/>

  <!-- bundle A -->
  <rect x="80" y="200" width="430" height="390" rx="16" fill="#eef4fb" stroke="#1c83df" stroke-width="2"/>
  <text x="105" y="238" font-size="19" font-weight="700" fill="#1c3a5e">bundle · formal-sciences/cryptography</text>

  <g>
    <rect x="120" y="270" width="150" height="58" rx="8" fill="#ffffff" stroke="#94a3b8" stroke-width="1.5"/>
    <text x="195" y="304" text-anchor="middle" font-size="15" fill="#334155">index.md</text>

    <rect x="120" y="366" width="150" height="58" rx="8" fill="#ffffff" stroke="#94a3b8" stroke-width="1.5"/>
    <text x="195" y="400" text-anchor="middle" font-size="15" fill="#334155">rsa.md</text>

    <rect x="320" y="366" width="150" height="58" rx="8" fill="#ffffff" stroke="#1c83df" stroke-width="2"/>
    <text x="395" y="400" text-anchor="middle" font-size="15" fill="#1c3a5e">aes.md</text>

    <line x1="195" y1="328" x2="195" y2="366" stroke="#94a3b8" stroke-width="2"/>
    <line x1="270" y1="304" x2="320" y2="390" stroke="#94a3b8" stroke-width="2"/>
  </g>

  <!-- bundle B -->
  <rect x="690" y="200" width="430" height="390" rx="16" fill="#eef4fb" stroke="#1c83df" stroke-width="2"/>
  <text x="715" y="238" font-size="19" font-weight="700" fill="#1c3a5e">bundle · engineering-technology/.../blockchain</text>

  <g>
    <rect x="730" y="270" width="170" height="58" rx="8" fill="#ffffff" stroke="#94a3b8" stroke-width="1.5"/>
    <text x="815" y="304" text-anchor="middle" font-size="15" fill="#334155">index.md</text>

    <rect x="730" y="366" width="190" height="58" rx="8" fill="#ffffff" stroke="#1c83df" stroke-width="2"/>
    <text x="825" y="400" text-anchor="middle" font-size="14" fill="#1c3a5e">concepts/consensus.md</text>

    <rect x="950" y="366" width="150" height="58" rx="8" fill="#ffffff" stroke="#94a3b8" stroke-width="1.5"/>
    <text x="1025" y="400" text-anchor="middle" font-size="14" fill="#334155">concepts/pos.md</text>

    <line x1="815" y1="328" x2="825" y2="366" stroke="#94a3b8" stroke-width="2"/>
    <line x1="900" y1="304" x2="990" y2="366" stroke="#94a3b8" stroke-width="2"/>
  </g>

  <!-- cross-bundle reference -->
  <path d="M470,392 C 560,345 640,345 730,392" fill="none" stroke="#1c83df" stroke-width="3" stroke-dasharray="9 7" marker-end="url(#arrowBlue)"/>
  <rect x="500" y="332" width="300" height="32" rx="8" fill="#ffffff" stroke="#1c83df" stroke-width="1.5"/>
  <text x="650" y="353" text-anchor="middle" font-size="14" fill="#1c3a5e" font-family="Menlo, Consolas, monospace">xokf://&lt;bundleID&gt;/&lt;conceptID&gt;</text>

  <!-- legend -->
  <line x1="110" y1="655" x2="160" y2="655" stroke="#94a3b8" stroke-width="2"/>
  <text x="172" y="660" font-size="15" fill="#475569">bundle 内引用 · ./x.md（Markdown 普通链接）</text>

  <line x1="620" y1="655" x2="670" y2="655" stroke="#1c83df" stroke-width="3" stroke-dasharray="9 7"/>
  <text x="682" y="660" font-size="15" fill="#475569">跨 bundle 引用 · xokf://（本文扩展）</text>
</svg>

这个约定写起来很简单，但问题是：**VS Code 的 Markdown 插件根本不认识 `xokf://` 这个协议**——点击即死链接。规范定义了语义，却没有工具帮你"走完最后一步"。

## xOKF：把约定变成真正可点击的能力

xOKF 是一个轻量的 VS Code 插件，只做一件事：**让 `xokf://` 和普通相对链接，在编辑器和预览里都能真正点得开、跳得准**。

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 520" font-family="PingFang SC, Microsoft YaHei, sans-serif">
  <defs>
    <linearGradient id="bg2" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f8fafc"/>
      <stop offset="1" stop-color="#eaf3fc"/>
    </linearGradient>
    <marker id="arrowGray" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="#94a3b8"/>
    </marker>
  </defs>

  <rect width="1200" height="520" fill="url(#bg2)"/>
  <text x="600" y="45" text-anchor="middle" font-size="28" font-weight="700" fill="#1f2937">xOKF：一次点击，直达目标</text>

  <!-- Box 1: preview -->
  <rect x="40" y="90" width="320" height="220" rx="14" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
  <rect x="40" y="90" width="320" height="30" rx="14" fill="#e2e8f0"/>
  <rect x="40" y="106" width="320" height="14" fill="#e2e8f0"/>
  <circle cx="58" cy="105" r="5" fill="#f87171"/>
  <circle cx="74" cy="105" r="5" fill="#fbbf24"/>
  <circle cx="90" cy="105" r="5" fill="#34d399"/>
  <text x="200" y="150" text-anchor="middle" font-size="18" font-weight="700" fill="#1f2937">Markdown 预览</text>
  <rect x="70" y="170" width="260" height="10" rx="5" fill="#e2e8f0"/>
  <rect x="70" y="190" width="200" height="10" rx="5" fill="#e2e8f0"/>
  <text x="70" y="232" font-size="16" fill="#1c83df" text-decoration="underline">consensus 机制</text>
  <circle cx="290" cy="227" r="7" fill="none" stroke="#1c83df" stroke-width="2"/>
  <circle cx="290" cy="227" r="13" fill="none" stroke="#1c83df" stroke-width="1.5" opacity="0.5"/>

  <!-- arrow 1 -->
  <line x1="366" y1="200" x2="434" y2="200" stroke="#94a3b8" stroke-width="3" marker-end="url(#arrowGray)"/>
  <text x="400" y="185" text-anchor="middle" font-size="11" fill="#475569">解析路径</text>

  <!-- Box 2: resolver -->
  <rect x="440" y="90" width="320" height="220" rx="14" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
  <circle cx="600" cy="175" r="42" fill="#1c83df"/>
  <g fill="none" stroke="#ffffff" stroke-width="3.6" stroke-linecap="round">
    <line x1="588.5" y1="186.15" x2="611.5" y2="186.15"/>
    <line x1="588.5" y1="186.15" x2="611.5" y2="203.85"/>
  </g>
  <circle cx="588.5" cy="186.15" r="6.4" fill="#ffffff"/>
  <circle cx="611.5" cy="186.15" r="6.4" fill="#ffffff"/>
  <circle cx="611.5" cy="203.85" r="6.4" fill="#ffffff"/>
  <text x="600" y="245" text-anchor="middle" font-size="18" font-weight="700" fill="#1f2937">xOKF 解析器</text>
  <text x="600" y="272" text-anchor="middle" font-size="13" fill="#64748b">定位联邦根 · 容忍断链 · 防路径穿越</text>

  <!-- arrow 2 -->
  <line x1="766" y1="200" x2="834" y2="200" stroke="#94a3b8" stroke-width="3" marker-end="url(#arrowGray)"/>
  <text x="800" y="185" text-anchor="middle" font-size="11" fill="#475569">非预览组打开</text>

  <!-- Box 3: placement -->
  <rect x="840" y="90" width="320" height="220" rx="14" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
  <text x="1000" y="130" text-anchor="middle" font-size="18" font-weight="700" fill="#1f2937">打开位置</text>

  <rect x="865" y="150" width="125" height="110" rx="8" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1.5"/>
  <rect x="880" y="168" width="95" height="8" rx="4" fill="#cbd5e1"/>
  <rect x="880" y="184" width="70" height="8" rx="4" fill="#cbd5e1"/>
  <rect x="880" y="200" width="85" height="8" rx="4" fill="#cbd5e1"/>
  <text x="927" y="285" text-anchor="middle" font-size="12" fill="#475569">预览（保持原位）</text>

  <rect x="1010" y="150" width="125" height="110" rx="8" fill="#eaf3fc" stroke="#1c83df" stroke-width="2"/>
  <path d="M1030,168 h60 l14,14 v58 h-74 z" fill="#ffffff" stroke="#1c83df" stroke-width="1.5"/>
  <path d="M1090,168 v14 h14" fill="none" stroke="#1c83df" stroke-width="1.5"/>
  <rect x="1038" y="196" width="50" height="6" rx="3" fill="#93c5fd"/>
  <rect x="1038" y="210" width="50" height="6" rx="3" fill="#93c5fd"/>
  <rect x="1038" y="224" width="34" height="6" rx="3" fill="#93c5fd"/>
  <text x="1072" y="285" text-anchor="middle" font-size="12" fill="#1c3a5e">编辑器（新标签组）</text>

  <!-- reverse flow: JSON to preview -->
  <text x="40" y="400" font-size="17" font-weight="700" fill="#1c83df">JSON 联动</text>

  <rect x="220" y="360" width="300" height="100" rx="14" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
  <text x="370" y="392" text-anchor="middle" font-size="17" font-weight="700" fill="#1f2937">JSON 编辑器</text>
  <text x="370" y="420" text-anchor="middle" font-size="13" fill="#64748b" font-family="Menlo, Consolas, monospace">"seeAlso": "./consensus.md"</text>

  <line x1="530" y1="410" x2="640" y2="410" stroke="#94a3b8" stroke-width="3" marker-end="url(#arrowGray)"/>
  <text x="585" y="395" text-anchor="middle" font-size="12" fill="#475569">点击路径</text>

  <rect x="650" y="360" width="330" height="100" rx="14" fill="#ffffff" stroke="#1c83df" stroke-width="2"/>
  <text x="815" y="392" text-anchor="middle" font-size="17" font-weight="700" fill="#1f2937">对应目标</text>
  <text x="815" y="420" text-anchor="middle" font-size="13" fill="#64748b">是 .md → 打开预览；否则 → 打开编辑器</text>
</svg>

具体落地了这些能力：

- **双向可点击**：源码编辑器里 Cmd/Ctrl+点击直接跳转；渲染预览里点击同样有效，而不是停留在"看起来像链接、点了没反应"的死链接。
- **打开位置更懂你**：无论从预览点开，还是从 JSON 里的路径点开，目标文件都会落在**第一个不是预览面板的标签组**——不会把预览页签顶替掉，也不会喧宾夺主。
- **JSON 伙伴文件联动**：JSON 里写的相对路径（如 `"seeAlso": "./consensus.md"`）也能点开——指向 Markdown 就打开渲染预览，指向其他文件就在编辑器里打开。
- **忠于 OKF 的容错哲学**：损坏链接不报错、不阻断；同时严格拦截超出联邦根的路径穿越，安全与宽容并存。

没有数据库，没有索引服务，没有额外的运行时——**xOKF 只是让文件系统本来就有的结构，在你已经在用的编辑器里"显影"出来**，这正是 OKF 精神的自然延伸：结构在文件里，能力在指尖上。

## 获取方式

xOKF 完全开源，欢迎试用、提问题、提 PR：

**项目地址**：https://github.com/LeafAI/xOKF

---
**许可证**：MIT 开源
