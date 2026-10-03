# 作者与文件来源

## 本版作者

- **项目名称：Qf-PV show V1**
- **作者署名：QFziyu**
## 一句话项目说明：在项目JIZUERA基础上，使得画面中的每一个元素得以独立拆分，独立自由调整运动曲线，框选关键帧，利用手动追踪功能自由绘制曲线

。导出画面不会附加作者水印。本版署名不表示以下所有底层代码均从零原创。

## 直接使用的文件来源

| 来源文件 | 用途 | 本版保留与修改 |
| --- | --- | --- |
| `PV-Fusion-v0.3.zip` | 编辑器主体 | 保留独立图层、逐句字幕、关键帧、跟随、追踪、速度曲线、素材管理、保存与导出。 |
| `JIZURA-歌曲风格分类版.zip` | 歌曲分类、动效模板与简体编辑器 | 沿用六类歌曲规则、27 套配色与 860 项注册效果，导入简体模板名称和原版高级编辑器；保留 JIZURA 作者与许可。 |
| PV Fusion 0.4 本地整合版 | V1 的直接开发基线 | 保留上一轮完成的完整模板入口、可变宽高关键帧、动态留白合成及 AE 蒙版导出。 |

两个原始 ZIP 的文件大小与 SHA-256 见 [来源校验记录](docs/integration-sources.json)。记录只保存来源文件名，不保存原用户的绝对本机路径。原始 ZIP 本身没有重复放入仓库。

源码比较确认：PV Fusion 原主体已经包含上述 JIZURA 歌曲分类和注册效果。本次“整合”包括开放完整模板入口、补足开关与简体名称、避免生成时覆盖所选歌曲分类；不是宣称新增了 860 项原创效果。

## 引擎、算法与依赖

### JIZURA

原作者：**hakoniwa**。原始版权：`Copyright (c) 2026 hakoniwa`。许可：MIT，完整原文保存在 [licenses/JIZURA-LICENSE](licenses/JIZURA-LICENSE)。

复用内容包括歌词解析、音乐分析、歌曲风格规划、模板库、Canvas 字效、导出流程和 AE 原生构建器。代码位于 `vendor/jizura/`，原版完整编辑器保存在 `JIZURA-complete.html`。

保留 Fusion 已有的固定随机纹理、统一配色和导出前视频帧准备补丁；动态留白增加了分带空间适配。没有将所有模板内部字形或装饰改造成通用独立图层。

### ManualTracker / PV Fusion 运动系统

来源是 PV Fusion 项目中作者QFziyu自研的 ManualTracker 2.3 相关实现。`src/curves.js` 保留其距离、弧长采样、Catmull–Rom、PCHIP、速度积分、Bezier 与 RDP 等曲线函数；模型、锁定和跟随控制继续通过 Fusion 模块使用。


### mp4-muxer

版本：5.2.2。作者 / 来源：Vanilagy，<https://github.com/Vanilagy/mp4-muxer>。MIT 许可原文在 [第三方通知](licenses/JIZURA-THIRD_PARTY_NOTICES.md)。`vendor/mp4-muxer.min.js` 随发行 HTML 使用。

### 字体与测试依赖

JIZURA 可按原有逻辑请求 Google Fonts，字体未打包进仓库；网络不可用时使用系统字体，画面可能不同。字体信息见原第三方通知。

`@napi-rs/canvas` 0.1.100 是开发测试依赖，MIT 许可；源码：<https://github.com/Brooooooklyn/canvas>。它不被嵌入离线工作台。

### 原项目记载的设计参考

PV Fusion 的旧来源说明将 PV Tool 记为功能方向参考，指出未包含其网站代码、模板、图片或品牌资产。本版未新增使用该网站资源，不将它列为本仓库代码来源。

## Qf-PV show V1 的主要修改

添加了更多独立自由度的编辑按钮
优化了原有UI的显示逻辑
整合了作者本人的PR插件 实现了变速曲线独立调整。对于单一元素的独立调整
增加了一定程度的自动追踪，以及，完成度较高的手动逐帧追踪按钮，这就意味着你可以手绘运动轨迹