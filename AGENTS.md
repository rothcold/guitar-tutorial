# 吉他教程项目说明

## 项目目标

- 本项目是一套从零基础到独立演奏、即兴、扒歌、编曲与创作的中文吉他教程。
- 第 1 至第 7 篇为木吉他与电吉他共通路线。
- 第 8 篇分为木吉他 A 路线与电吉他 B 路线。
- 第 9 至第 14 篇重新汇合为共同高级路线。
- `docs/` 下的 Markdown 是教程内容源，后续前端网站从这些文件构建。
- 每一篇必须保存在 `docs/` 下的独立 Markdown 文件中。

## 网站架构

- 网站使用 Astro 7、TypeScript、npm 和 Astro 内置的 GitHub Flavored Markdown 支持，输出纯静态页面。
- Node.js 必须为 22.12.0 或更高版本。
- Vercel 通过 GitHub 集成部署 `main`，构建命令为 `npm run build`，输出目录为 `dist`；纯静态构建不安装 `@astrojs/vercel` adapter。
- 内容集合只在 `src/content.config.ts` 定义，`lessons` 集合通过 `glob()` 直接读取 `docs/*.md`。
- `lessonSchema` 是教程 frontmatter 的单一契约；TypeScript 类型必须从该 Schema 推导，不得另写平行接口。
- 教程 ID 保留 `01`、`08A`、`08B` 等字符串格式；公开 slug 使用 `01`、`08a`、`08b` 等小写无尾斜杠格式。
- `track` 只使用 `common`、`acoustic`、`electric`；`previous` 和 `next` 使用内容集合引用描述分流图。
- `07` 的下一篇为 `08A` 与 `08B`，两条路线都汇合到 `09`；`09` 的上一篇为 `08A` 与 `08B`。
- `src/pages/lessons/[slug].astro` 从 frontmatter 生成静态教程路由；桌面页面使用课程路径、正文和本页目录三栏布局，移动端使用独立的“课程”与“本页”抽屉。
- 教程正文的一级标题来自 Markdown，页面布局不得重复输出标题；本页目录只收录正文中的二至四级标题。
- 网站只使用 `src/styles/global.css` 中的浅色原生 CSS token，不引入 Tailwind 或组件库；宽表格和六线谱必须保留横向滚动。
- `src/markdown/lesson-links.ts` 在构建时把正文中的相对 `.md` 链接改写为公开教程路由；不要为了网站路由破坏 Obsidian 和 GitHub 可用的源文件链接。
- 生产 canonical 域名为 `https://guitar.rothcold.me`；`SITE_INDEXING_ENABLED` 是搜索索引闸门，默认关闭。首次生产 smoke 通过后，只在 Vercel Production 环境将它设为 `true` 并重新部署。
- Vercel Web Analytics 组件只在共享布局中加载，数据使用说明维护在 `/privacy`。
- `script/` 使用 Scripts to Rule Them All：`script/setup` 安装依赖，`script/lint` 运行 ESLint 与 Astro check，`script/test` 校验索引关闭和开启两种静态构建，`script/cibuild` 是 CI 入口，`script/smoke` 验证生产站点。
- GitHub Actions 在 PR 和 `main` push 上运行 `script/cibuild`；`Production smoke` 只手动运行，并要求明确选择预期索引状态。
- 常用命令为 `npm run dev`、`npm run lint`、`npm run check`、`npm test`、`npm run build` 和 `npm run preview`。

## 写作约定

- 面向自学者解释术语，先说明听觉或动作结果，再说明理论。
- 每篇包含学习目标、正文、练习安排、常见问题、完成标准和下一篇衔接。
- 技巧名称第一次出现时使用中文名并附英文名。
- 谱例以原创短练习为主，不收录受版权保护歌曲的完整谱例。
- 不把速度作为唯一进度指标，优先检查节奏、放松、音准和干净度。
- 练习安排必须能够脱离正文单独执行；新增或改写练习时，从零基础学习者视角核对每个动作的前置知识，并确保首次使用前已讲清手型、手指分工、运动方向和复位方式；正文链接只能补充解释，不能承载必要步骤或谱例。
- 每篇提供可叠加的 25、45、90 分钟日程和逐档建议周期；90 分钟包含两段 40 分钟练习及中间 10 分钟休息。
- 每篇写明每周重点、训练日 1 至训练日 7、每日核心项和轮换项；休息后按下一个训练日顺延。
- 每项练习写清目的、准备、步骤、时长或次数、量化要求、自检和难度调整。
- 演奏与节奏任务提供节拍器速度；听力、创作、设备和录音任务使用次数、时限、准确率或产出物。
- 每篇重复说明周期可按掌握速度缩短或延长，完成标准只作自我检查，不作为进阶门槛。
- 每篇只使用一个一级标题作为教程标题；学习目标、编号章节、练习安排、常见问题、完成标准和下一篇衔接使用二级标题；章节内小节和具体常见问题使用三级标题；只有三级标题下的真实子节才使用四级标题；标题不得跳级。
- Markdown 不使用粗体和 em dash。

## 文件命名

- `docs/` 同时是 Obsidian vault，配置保存在 `docs/.obsidian/`。
- `docs/` 下的共通路线使用两位数字前缀，例如 `03-和弦与歌曲伴奏.md`。
- `docs/` 下的分流路线使用 `08A-` 与 `08B-` 前缀。
- 导航和阅读顺序维护在 `README.md`。

## 修改与校验

- 修改教程结构后，同步更新 `README.md` 中的链接与学习路线。
- 新增练习时，按练习卡约定提供完整执行信息，不得只写技巧名称与分钟数。
- 完成修改后，检查 `docs/` 下 15 篇正文均存在、内部链接有效、每篇只有一个一级标题、标题不跳级，并且没有空章节或占位符。
- 修改教程 frontmatter 或网站代码后，运行 `npm run check` 和 `npm run build`。
- 提交网站或教程变更前运行 `script/lint` 和 `script/test`；需要复现 CI 时运行 `script/cibuild`。
- 新增或重排教程时，同步维护 `id`、`slug`、`order`、`track`、`previous` 和 `next`，确保 ID 与 slug 唯一且导航引用双向一致。
- 项目发生有意义的结构、命名、写作标准、网站架构或校验方式变化时，必须同步修订本文件。
