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
- `src/pages/lessons/[slug].astro` 从 frontmatter 生成静态教程路由；桌面页面使用课程路径、正文和本页目录三栏布局，移动端底部提供“课程”“本页”和“主题”控制，其中前两项打开独立抽屉。
- 教程正文的一级标题来自 Markdown，页面布局不得重复输出标题；本页目录只收录正文中的二至四级标题。
- `design/guitar-tutorial.pen` 是 Pencil v1 设计源；网站使用 K24ce 相思木色系，并只借鉴 DAW 的轨道、时间轴、信号流和状态指示，不制作伪旋钮、推子、传输条或霓虹效果。
- 网站只使用 `src/styles/global.css` 中的原生 CSS token，不引入 Tailwind 或组件库；浅色与深色主题通过 `data-theme` 切换，首次访问跟随系统，手动选择保存在本地；宽表格和文本谱例必须保留横向滚动。
- 主题、上次阅读页面、阅读位置、路线偏好和手动完成状态只保存在浏览器本地存储中，不提供账户、同步、连续打卡、完成百分比或内容锁定；对应说明维护在 `/privacy`。
- fenced `tab-diagram` 用于音阶、和弦形状和指板图，保留六行 ASCII 契约与局部横向滚动；fenced `tab-score` 用于有明确时值的节奏六线谱，旧 fenced `tab` 必须构建失败。
- `src/markdown/tab-score.ts` 解析每小节一行、事件以 `|` 分隔的 DSL，强制拍号和小节时值总和；事件示例为 `e 6:0 {pm down accent}`，整段反复使用 `repeat: N`，入门数拍默认展开使用 `counts: open`。
- `src/scripts/tab-score.ts` 只使用原生 Canvas 2D 绘制节奏谱，不引入 D3 或记谱库；桌面每个系统固定四个等宽小节，不根据音符数量动态换行，密集系统扩大整张 Canvas 并在系统内横向滚动；移动端每个系统一个小节，Canvas 对读屏隐藏，服务端输出逐小节语义描述。
- fenced `text` 仍在客户端增强为可展开的“文本谱例”；只有人工确认的完整音乐信息可以迁移为 `tab-score`，不得推断调弦、拍号、速度、时值或技巧时序。
- `src/markdown/lesson-links.ts` 在构建时把正文中的相对 `.md` 链接改写为公开教程路由；不要为了网站路由破坏 Obsidian 和 GitHub 可用的源文件链接。
- 生产 canonical 域名为 `https://guitar.rothcold.me`；`SITE_INDEXING_ENABLED` 是搜索索引闸门，默认关闭。首次生产 smoke 通过后，只在 Vercel Production 环境将它设为 `true` 并重新部署。
- Vercel Web Analytics 组件只在共享布局中加载，数据使用说明维护在 `/privacy`。
- `script/` 使用 Scripts to Rule Them All：`script/setup` 安装依赖，`script/lint` 运行 ESLint 与 Astro check，`script/test` 使用 `--experimental-strip-types` 兼容 Node.js 22.12 并校验索引关闭和开启两种静态构建，`script/cibuild` 是 CI 入口，`script/smoke` 验证生产站点。
- GitHub Actions 在 PR 和 `main` push 上运行 `script/cibuild`；`Production smoke` 只手动运行，并要求明确选择预期索引状态。
- 常用命令为 `npm run dev`、`npm run lint`、`npm run check`、`npm test`、`npm run build` 和 `npm run preview`。

## 写作约定

- 面向自学者解释术语，先说明听觉或动作结果，再说明理论。
- 每篇包含学习目标、正文、练习安排、常见问题、完成标准和下一篇衔接。
- 技巧名称第一次出现时使用中文名并附英文名。
- 谱例以原创短练习为主，不收录受版权保护歌曲的完整谱例。
- 不把速度作为唯一进度指标，优先检查节奏、放松、音准和干净度。
- 练习安排必须能够脱离正文单独执行；新增或改写练习时，从零基础学习者视角核对每个动作的前置知识；节奏或技巧递进每次只增加一个变量，先建立低密度基础版本，再增加速度、方向或空拍；并确保首次使用前已讲清手型、手指分工、运动方向和复位方式。
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
