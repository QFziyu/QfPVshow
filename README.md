# Qf-PV show V1

**QFziyu 的文字 PV 创作工作台。**

整合与新版设计：**QFziyu**（QF 为简称）。基于 PV Fusion 的编辑能力，结合 JIZURA 歌曲风格与动态留白，把素材、字幕、运动和导出放进同一个离线工作台。

## 直接开始

下载或克隆本仓库，用 **Chrome / Edge 打开 `index.html`** 即可使用。无需安装 Node、Python 或剪辑软件。保留整个目录，可以同时访问使用指南、来源说明和原版高级编辑器。

1. **素材**：导入音乐、背景或人物图片 / 视频，填写歌词，或导入 LRC / SRT。
2. **风格**：选择歌曲分类、视觉配色与生成方案，点击“生成当前风格”。
3. **构图**：设置画幅，启用动态留白；在画布拖动区域或角点，调整位置与大小。
4. **元素 / 运动**：选择字幕句、背景形状或素材，修改属性、关键帧、跟随和追踪路径。
5. **导出**：输出 MP4、PNG 序列、WAV 或 AE 工程包。保存 `.pvf` 项目可以保留素材和编辑记录。

[完整使用指南](docs/USER-GUIDE.md) · [作者与文件来源](README-SOURCES.md) · [版权与许可](LICENSE.md)

## 能做什么

- 六种歌曲分类及自由搭配；27 套视觉配色、860 项注册排版 / 动效（不是 860 套完整成片模板）。
- 保留逐句字幕、独立背景元素、自由文字、图片和视频；每个可编辑元素使用自己的位置、缩放、旋转与关键帧。
- 一个可移动、变宽高和旋转的动态留白区域，支持直接拖动和关键帧动画；人物图片与视频在区域内保留。
- 手动单点 / 两点追踪、手绘路径、跟随图层、速度曲线、原始与处理后两份轨迹。
- 完整 `.pvf` 项目保存，兼容既有 PV Fusion 项目和 JIZURA 项目 JSON。

## 示例

在“打开项目”里选择：

- `examples/Dynamic-space.pvf`：动态留白位置、宽高、旋转与逐句字幕。
- `examples/Sentence-controls.pvf`：独立字幕句控制。
- `examples/collage.pvf`、`construct.pvf`、`orbit.pvf`、`blueprint.pvf`、`pop.pvf`：五套可独立精修的背景。

## 本地开发

仅开发和测试时需要 **Node.js 20+、Python 3.10+**。

```sh
npm install
npm run build
npm test
npm run release
```

构建无需打包器或生产 npm 依赖；`@napi-rs/canvas` 只用于测试。发行 HTML 已随仓库提供。`npm run release` 生成 `dist/Qf-PV-show-V1-GitHub.zip`，打包前会重新构建并运行检查。测试也可通过 `CODEX_PRIMARY_RUNTIME_NODE_MODULES` 复用已有 Canvas 依赖。

## 提交到 GitHub

将**本目录中的文件和子目录**提交到新仓库的根目录，包含 `index.html`、`src/`、`vendor/`、`assets/`、`docs/`、`licenses/` 等。`.gitignore` 已排除安装依赖、缓存和本地测试输出；没有附带 `.git` 历史、凭据或个人媒体。

可以在 GitHub Desktop 中从此文件夹创建本地仓库再 Publish，或使用 Git 将文件推送至你自己创建的仓库。GitHub Actions 已配置构建与自动检查；本次交付没有代为建立或发布远程仓库。

## 项目结构

```text
index.html              可直接打开的离线工作台
src/                    模块化源码、界面结构与样式
assets/                 QF 标识
vendor/                 JIZURA / AE 引擎、MP4 封装依赖
examples/               可编辑示例及实际 Canvas 预览
JIZURA-complete.html     保留原署名的原版高级编辑器
README-SOURCES.md       来源文件、原作者及本版修改范围
docs/                   使用、设计与验证说明
licenses/               原始许可和第三方通知
tests/                  模型、界面逻辑、渲染与导出检查
tools/                  测试汇总与发行打包
```

## 验证与边界

本版通过 **96 项自动检查**，包含 40 项界面事件模拟；歌曲分类检查覆盖 240 个种子组合。Canvas 渲染、透明 PNG 和可编辑项目读写采用实际像素 / 文件测试。完整说明见 [验证记录](docs/VALIDATION.md)。

真实浏览器布局、视频解码、硬件 MP4 编码和真实 AE 宿主尚未实测。AE 输出动态减去蒙版，但原生字幕仍保留原始分带位置，与浏览器动态重新布局有差异；需要保留浏览器画面时使用 PNG 序列与 WAV。

作者署名指本版整合、界面与个人品牌，不替代原引擎和第三方代码作者。源码许可按各来源分别保留，见 [来源说明](README-SOURCES.md)。
