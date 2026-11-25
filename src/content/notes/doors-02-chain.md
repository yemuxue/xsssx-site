---
title: 'DOORS 全链路：从 CSV 到 995 个对象'
description: '一份中文需求表，经脚本转成 DXL，在运行中的 DOORS 客户端里批量建库、建链、校验：11 个模块、725 条需求、662 条追溯链接。'
date: 2026-11-25
tags: ['DOORS', 'DXL', '自动化']
---

> 版本：v1.0 ｜ 生成时间：2026-11-06 ｜ 环境：IBM Rational DOORS 9.6.1.11 + Windows PowerShell 5.1
>
> 本文档配套一套可直接复跑的脚本与数据，记录"**CSV 输入 → DXL 转换 → DOORS 导入 → 自动校验 → 界面确认**"的完整链路。

---

## 1. 这套东西是做什么的

在企业里，需求往往先在 Excel/Word 里写，再想办法导入需求管理工具。这套东西把这件事流程化：

1. **输入**：一份结构化的中文需求表（CSV，Excel 可直接打开编辑）
2. **转换**：脚本把 CSV 转成 DOORS 的 DXL 脚本
3. **导入**：通过 COM 接口在正在运行的 DOORS 客户端里执行 DXL，批量建目录、建模块、建对象
4. **校验**：自动读回 DOORS 内容，与 CSV 逐模块比对数量
5. **交付**：校验报告 + 截图 + 可重复执行的脚本

**本次实测规模**：11 个模块、995 个对象（725 条需求 + 162 个章节标题），5 个链接模块、**662 条追溯链接**；初始导入 7 个模块 767 个对象耗时 **12 秒**，校验 **100% 通过**。

---

## 2. 环境与前置条件

| 项 | 要求 |
|---|---|
| DOORS 客户端 | 已安装并**已启动、已登录**到目标数据库（本文实测使用具备管理员权限的账号，空库） |
| DOORS 数据库服务 | 服务 `DOORS DB Server 9.6` 处于运行状态 |
| 数据库权限 | 用户需有建文件夹、建模块、修改对象的权限，且具备 `Edit DXL` 权限 |
| Shell | Windows PowerShell 5.1（`powershell.exe`）。本机没有 pwsh 7 |
| 执行策略 | 默认禁止运行 `.ps1`，所有脚本调用都要带 `-ExecutionPolicy Bypass` |
| 执行器 | `doors/doors-run.ps1`（上一阶段交付），负责跑 DXL 并自动点掉错误弹窗 |

> ⚠️ **COM 连接的是"正在运行的那个客户端"**。如果 DOORS 没开、或没登录，`New-Object -ComObject DOORS.Application` 会失败或挂起。

---

## 3. 数据设计

### 3.1 数据库结构（导入后）

```
DOORS Database: /
├── 00 用户需求
│   ├── UR_用户需求               30 个对象（30 需求）
│   └── UR_to_SYS                （链接模块）
├── 01 系统需求
│   ├── SYS_系统需求规格          121 个对象（97 需求 + 24 标题）
│   └── SYS_to_SUB               （链接模块）
├── 02 子系统需求
│   ├── SEC_安防子系统需求        113 个对象（90 需求 + 23 标题）
│   ├── NRG_能源子系统需求        112 个对象（88 需求 + 24 标题）
│   ├── ACS_通行子系统需求         99 个对象（77 需求 + 22 标题）
│   └── SUB_to_SW                （链接模块）
├── 03 软件需求
│   └── SW_平台软件需求           114 个对象（90 需求 + 24 标题）
├── 04 接口与数据
│   └── IF_接口需求规格            91 个对象（70 需求 + 21 标题）
├── 05 验证与确认
│   ├── TC_测试用例规格           117 个对象（93 需求 + 24 标题）
│   ├── TR_测试执行记录            93 个对象（执行记录）
│   └── VERIFY                   （链接模块）
├── 06 变更管理
│   └── CR_变更单                 15 个对象（变更单）
└── 07 代码单元
    ├── CODE_代码单元              90 个对象（代码单元）
    └── SW_to_CODE                （链接模块）
```

合计：8 个项目文件夹、11 个正式模块、5 个链接模块、**995 个对象**。

### 3.2 层级模型（8 层 / V 形）

```
L1 用户需求 UR ──分解──▶ L2 系统需求 SYS ──分解──▶ L3 子系统 SEC/NRG/ACS ──细化──▶ L4 软件需求 SW ◀──实现── L6 代码单元 CODE
                                                                                        ▲
                                                                                  验证 ─┘
                                                                    L5 验证用例 TC（单元/集成/系统/验收）
```

| 层级 | 模块 | 对象数 | 定位 |
|---|---|---:|---|
| L1 用户需求 | `UR_用户需求` | 30 | 业务方视角，最上游 |
| L2 系统需求 | `SYS_系统需求规格` | 97 | 系统级能力 |
| L3 子系统需求 | `SEC` / `NRG` / `ACS` | 90 / 88 / 77 | 三大子系统 |
| L4 软件需求 | `SW_平台软件需求` | 90 | 可开发粒度 |
| L5 验证用例 | `TC_测试用例规格` | 93 | 按测试层级分派 |
| L6 代码单元 | `CODE_代码单元` | 90 | 实现物 |

辅助模块：`IF_接口需求规格`（70 接口需求）、`TR_测试执行记录`（93 执行结果）、`CR_变更单`（15 变更单）。

<details>
<summary>原 5 层模型的说明（保留）</summary>

| 层级 | DOORS 中的表现 | 示例 |
|---|---|---|
| 第 1 层 | 项目文件夹 | `02 子系统需求` |
| 第 2 层 | 正式模块（Formal Module） | `SEC_安防子系统需求` |
| 第 3 层 | 章节标题对象（`Object Heading`） | `3 门禁控制` |
| 第 4 层 | 小节标题对象（`Object Heading`） | `3.2 远程开门` |
| 第 5 层 | 需求对象（`Object Text`） | `SEC-0042 门禁远程开门：系统应支持……` |

</details>

> **为什么不用 DOORS 的"对象缩进层级"（Object Level）？**
> DOORS 9.6 的 DXL **没有提供设置对象级别的函数**（`level(Object)` 只有 getter，写 `o."Object Level" = 2` 会报"未知对象属性"）。
> 所以这里用"**章节标题 + 层级编号**"来表达层级：视觉上标题加粗、编号体现 3 → 3.1 → 3.1.2 的从属关系。
> 如果确实需要真正的缩进，两个办法：① 在 GUI 里选中行按 `Tab`；② 用 DOORS 的 CSV/ReqIF 导入功能（导入模板支持 Object Level 列）。

### 3.3 CSV 字段说明

文件：`data/requirements.csv`（UTF-8 with BOM，Excel 可直接打开）

| 字段 | 说明 | 示例 |
|---|---|---|
| Module | 模块代号 | `SEC` |
| ModuleName | 模块名（也是数据库里的模块名） | `SEC_安防子系统需求` |
| Folder | 所属项目文件夹 | `02 子系统需求` |
| Kind | 行类型：`章节` / `小节` / `需求` | `需求` |
| Chapter | 所属章节（标题行填标题文本） | `3.2 远程开门` |
| ReqId | 需求编号（需求行才填） | `SEC-0042` |
| Title | 需求标题 | `门禁远程开门` |
| Type | 需求类型（功能/性能/安全/接口/可靠性/测试用例） | `功能` |
| Desc | 需求正文 | `系统应支持门禁远程开门，权限下发在10秒内生效。` |
| Priority | 优先级（高/中/低） | `高` |
| Method | 验证方法（测试/演示/分析/检查） | `测试` |
| Status | 状态（已评审/待评审/草稿） | `已评审` |
| Owner | 责任人 | `张伟` |
| Source | 需求来源 | `客户需求` |

**导入后每条需求的 `Object Text` 形如**：

```
SEC-0042 门禁远程开门：系统应支持门禁远程开门，权限下发在10秒内生效。
【类型:功能｜优先级:高｜验证:测试｜状态:已评审｜责任人:张伟｜来源:客户需求】
```

> 说明：DOORS 9.6 里用 DXL 动态创建自定义属性（AttrDef）比较麻烦，本方案先把元数据**内嵌在需求正文**里。
> 若企业要求"属性列"，可以在 GUI 里先给模板模块定义好属性，再用 DXL 按属性名赋值（`o."优先级" = "高"`）。

### 3.4 数据规模

| 模块 | 需求 | 标题 | 对象合计 |
|---|---:|---:|---:|
| UR 用户需求 | 30 | 0 | 30 |
| SYS 系统需求 | 97 | 24 | 121 |
| SEC 安防子系统 | 90 | 23 | 113 |
| NRG 能源子系统 | 88 | 24 | 112 |
| ACS 通行子系统 | 77 | 22 | 99 |
| SW 平台软件 | 90 | 24 | 114 |
| IF 接口需求 | 70 | 21 | 91 |
| TC 测试用例 | 93 | 24 | 117 |
| CODE 代码单元 | 90 | 0 | 90 |
| **小计（9 个需求模块）** | **725** | **162** | **887** |
| TR 测试执行记录 | — | — | 93 |
| CR 变更单 | — | — | 15 |
| **库内对象总计** | | | **995** |

- 需求数据由 `tools/gen-data.ps1` 用固定随机种子 `20261106` 生成，**可重复复现**。
- 用户需求与代码单元由 `tools/gen-layers.ps1` 生成。

---

## 4. 完整链路（5 步）

所有命令都在 `doors-enterprise` 目录下执行：

```powershell
cd C:\doors-demo\doors-enterprise
```

### 步骤 1：生成输入数据

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\gen-data.ps1
```

- **输入**：无（内置行业词表 + 句型模板 + 固定种子）
- **输出**：`data/requirements.csv`（767 行）
- **耗时**：< 1 秒

### 步骤 2：CSV → DXL

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\csv2dxl.ps1
```

- **输入**：`data/requirements.csv`
- **输出**：`dxl/import-all.dxl`（1691 行，UTF-8 with BOM）
- **耗时**：< 1 秒

### 步骤 3：导入 DOORS

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File ..\doors\doors-run.ps1 `
  -DxlFile .\dxl\import-all.dxl -WaitSeconds 900
```

- **输入**：`dxl/import-all.dxl`
- **输出**：数据库里的 5 个文件夹 + 7 个模块 + 767 个对象；`output/import.log`
- **耗时**：**约 12 秒**（实测）

`import.log` 示例：

```
import start
folder 01 系统需求: exists
folder 02 子系统需求: created
...
SYS: created (97 reqs, 24 headings)
SEC: created (90 reqs, 23 headings)
...
import done
```

### 步骤 4：自动校验

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\verify.ps1
```

- **做什么**：生成 `dxl/verify.dxl` → 逐模块 `read()` 读回所有对象 → 与 CSV 期望数量逐项比对
- **输出**：`output/all-objects.txt`（全量对象导出）、`output/verify-report.txt`（校验报告）
- **耗时**：约 5 秒

校验报告节选：

```
模块   期望对象  实际对象  期望需求  实际需求  期望标题  实际标题  结果
SYS         121       121        97        97        24        24  OK
SEC         113       113        90        90        23        23  OK
...
合计        767       767       605       605
总体结果: 全部通过
```

### 步骤 5：界面确认

打开 DOORS 客户端，刷新后即可看到：

- 根目录下 5 个项目文件夹：`output/screenshot-root.png`
- 模块内 章节标题 + 需求对象（中文正常显示）：`output/screenshot-module.png`

![根目录](/docs/doors/screenshots/db-tree.png)

![模块内容](/docs/doors/screenshots/module.png)

---

## 5. 关键技术点与踩坑记录

这一节是本文档最有价值的部分——所有坑都是实测踩出来的。

### 5.1 中文编码：三套编码并存

| 环节 | 正确编码 | 说明 |
|---|---|---|
| 含中文的 `.ps1` 脚本 | **UTF-8 with BOM** | PowerShell 5.1 读无 BOM 的文件会按 ANSI(GBK) 解析，中文全乱 |
| 含中文的 `.dxl` 脚本 | **UTF-8 with BOM** | DOORS 靠 BOM 识别 UTF-8；无 BOM 会按本地代码页解析 |
| CSV 输入文件 | **UTF-8 with BOM** | 这样 Excel 双击打开中文不乱码 |
| DOORS 写出的日志/导出文件 | **GBK (代码页 936)** | DXL 的 `Stream` 按系统 ANSI 写文件，读回时必须按 GBK 解码 |

读取 DOORS 输出的正确姿势：

```powershell
[System.IO.File]::ReadAllText($path, [System.Text.Encoding]::GetEncoding(936))
```

### 5.2 `create()` 是相对"当前文件夹"的

这是最坑的一条：

```dxl
Folder f = create("01 系统需求", "描述")      // ← 建到客户端当前所在的文件夹！
Folder f = create("/01 系统需求", "描述")     // ← 绝对路径，建在根目录（正确）
```

我第一次用相对名字，结果 5 个文件夹全被建到了当时客户端停留的 `/Demo Project` 里，而模块路径 `/01 系统需求/...` 找不到父目录，报 **"模块不能位于根文件夹中"**。

**结论**：DXL 里建文件夹和模块，一律用绝对路径。

### 5.3 新对象会插到模块最顶部

`create(Module)` 每次都把新对象插到**第一个位置**，不是追加到末尾。
所以导入脚本必须**倒序生成**：CSV 里的顺序 → 反向写入 → 最终显示顺序才与 CSV 一致。

```powershell
[array]::Reverse($modRows)   # csv2dxl.ps1 里的关键一行
```

### 5.4 重复导入会抛运行时错误

- 文件夹重复创建：返回非空句柄，不报错（会建出同名嵌套，需注意）
- **模块**重复创建：抛"项名称重复"，脚本暂停

**解决**：创建前用 `item("/路径")` 判空：

```dxl
Item ex = item("/02 子系统需求/SEC_安防子系统需求")
if (null ex) { /* 创建 */ } else { /* 跳过 */ }
```

### 5.5 DXL 语法上的三个怪癖

1. **变量不能重复声明**：一个块里写一次 `Object o`，后面用 `o = create(m)` 赋值。
2. **`s << a << b` 链式写经常报错**（"（<<）的自变量不正确"）。稳妥写法是拆开：

   ```dxl
   s << "模块: "
   s << num
   s << "\n"
   ```

   或者先把值赋给 `string` 变量再写。
3. **属性读取不能直接放进 `<<`**：`s << o."Object Text"` 会报错，要先 `txt = o."Object Text"`。

### 5.6 报错会弹模态框，卡死 COM 调用

DXL 编译错误 →「DXL 包含 N 错误」；运行时错误 →「DXL 因运行时错误而暂停」。
弹窗不点掉，`runFile()` 永远不返回。

**解决**：`doors/doors-run.ps1` 把 COM 调用放后台任务，主进程轮询并自动点「确定」，跑完还能读取「DXL 输出」面板的报错原文。

### 5.7 文件路径用正斜杠

DXL 字符串里的 Windows 路径建议写 `C:/Users/...`，写 `C:\Users\...` 需要转义成 `C:\\Users\\...`，容易出错。

### 5.8 模块不能建在根目录

DOORS 规定模块必须位于某个文件夹（项目）里。所以导入脚本第一步永远是建文件夹。

---

## 6. 验证结果

详见 `output/verify-report.txt`。

- 7 个模块数量全部匹配（对象/需求/标题三项分别比对）
- 合计 767 = 767、605 = 605
- 抽样检查中文正文、编号、元数据均正确
- GUI 中标题加粗、需求按编号顺序排列

---

## 7. 常见问题排查（FAQ）

| 现象 | 原因 | 处理 |
|---|---|---|
| 中文变成乱码/问号 | DXL 或 CSV 不是 UTF-8 BOM | 重新用 `UTF8Encoding($true)` 写文件 |
| 读回的报告是乱码 | 用 UTF-8 读了 GBK 文件 | 按 `Encoding.GetEncoding(936)` 读 |
| 报「模块不能位于根文件夹中」 | 模块路径的父文件夹不存在 | 先建文件夹，且用绝对路径 |
| 报「项名称重复」 | 模块已存在 | 删除旧模块，或依赖脚本里的 `item()` 判重 |
| 脚本跑一半停住不动 | 弹了模态错误框 | 用 `doors-run.ps1` 执行（会自动点掉） |
| 导入后顺序是反的 | 没有倒序生成 | 见 5.3，反转行顺序 |
| 对象少了一半 | 中途运行时错误暂停 | 看 `import.log` 最后一条，定位出错行 |
| 文件夹建到了奇怪的地方 | 用了相对名字 | 见 5.2，改绝对路径 |
| `无法加载文件，禁止运行脚本` | 执行策略 | 加 `-ExecutionPolicy Bypass` |

---

## 8. 如何替换成真实业务数据

### 8.1 只换数据（推荐）

1. 按 3.3 的字段说明，把真实需求整理成同样格式的 CSV（Excel 另存为 "CSV UTF-8"）
2. 覆盖 `data/requirements.csv`
3. 重新执行步骤 2 → 3 → 4

脚本不需要改，模块/文件夹结构会自动按 CSV 里的 `Folder`、`Module`、`ModuleName` 生成。

### 8.2 增加字段

- 在 CSV 里加列（如 `版本`、`评审日期`）
- 在 `csv2dxl.ps1` 里拼接 `Object Text` 的那几行加上新字段

### 8.3 想要真正的属性列

1. 先在 GUI 里建一个"模板模块"，定义好属性（文本/枚举）
2. 用 `Module create(path, desc, prefix, absno, false)` 基于模板创建，或创建后用 DXL 赋值：
   ```dxl
   o."优先级" = "高"
   ```
3. 修改 `csv2dxl.ps1`，把元数据从"内嵌正文"改成"逐属性赋值"

### 8.4 下一步可以接的东西

- **追溯链接**：系统需求 → 子系统需求 → 软件需求 → 测试用例（DXL 的 link 创建）
- **基线**：导入完成后 `baseline(Module)` 打基线，形成可审计快照
- **ReqIF 导出**：与甲方/供应商交换需求包
- **Excel 直连**：跳过 CSV，用 PowerShell 读 xlsx 直接生成 DXL

---

## 9. 追溯链接与覆盖报告

前面 1~8 节把"需求灌进 DOORS"跑通了，但那时 605 条需求彼此**没有任何链接**——只是一堆文档。
第 9 节补上 DOORS 真正的核心能力：**追溯（traceability）**与**覆盖率分析**。

### 9.1 链接模型

```
UR 用户需求 ──分解──▶ SYS 系统需求                        （链接模块 UR_to_SYS）
SYS 系统需求 ──分解──▶ SEC / NRG / ACS 子系统需求          （链接模块 SYS_to_SUB）
SEC 子系统需求 ──细化──▶ SW 软件需求                       （链接模块 SUB_to_SW）
CODE 代码单元 ──实现──▶ SW 软件需求                        （链接模块 SW_to_CODE）
TC 测试用例 ──验证──▶ 按层级指向 UR / SYS / SEC / NRG / ACS / SW（链接模块 VERIFY）
```

**方向约定（重要）**：

| 类型 | 方向 | 读法 |
|---|---|---|
| 分解 | 需求 → 子需求（向下） | “父需求分解为子需求” |
| 实现 | 代码单元 → 软件需求（向上） | “这段代码实现了哪条需求” |
| 验证 | 测试用例 → 被验证对象（向上） | “这个用例验证了什么” |

五个链接模块（Link Module）：

| 链接模块 | 路径 | 方向 | 条数 |
|---|---|---|---:|
| UR_to_SYS | `/00 用户需求/UR_to_SYS` | 用户需求 → 系统需求 | 97 |
| SYS_to_SUB | `/01 系统需求/SYS_to_SUB` | 系统需求 → 三个子系统需求 | 292 |
| SUB_to_SW | `/02 子系统需求/SUB_to_SW` | 安防子系统需求 → 软件需求 | 90 |
| SW_to_CODE | `/07 代码单元/SW_to_CODE` | 代码单元 → 软件需求 | 90 |
| VERIFY | `/05 验证与确认/VERIFY` | 测试用例 → 按层级指向各层需求 | 93 |

合计 **662 条链接**。

### 9.2 建链接的三个技术要点

1. **语法**：`源对象 -> "链接模块完整路径" -> 目标对象`
   （例如 `o -> "/01 系统需求/SYS_to_SUB" -> t`）
2. **必须 `edit` 打开源模块**：用 `read()` 打开会报"不具备对源对象的访问权"。
3. **链接模块要先存在**：`Module lm = create("/目录/链接模块名", "描述", manyToMany)`
   —— 第三个参数是映射类型常量 `manyToMany` / `oneToMany` / `manyToOne` / `oneToOne`。
   直接写 `a -> b` 会去找默认的 "DOORS Links"，空库里没有这个模块，会报"无法装入模块 DOORS Links"。

> 文档里的 BOM 坑再次出现：`link-coverage.dxl` 第一次没写 BOM，中文路径被按 GBK 解析，
> 六个模块全部 `OPEN-FAILED`。**含中文的 DXL 一律 UTF-8 with BOM。**

### 9.3 执行

```powershell
# ① 建基础链接（约 4.5 分钟，475 条）
powershell -NoProfile -ExecutionPolicy Bypass -File ..\doors\doors-run.ps1 `
  -DxlFile .\dxl\build-links.dxl -WaitSeconds 600

# ② 生成新增层（用户需求 30 条 + 代码单元 90 个）
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\gen-layers.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File ..\doors\doors-run.ps1 `
  -DxlFile .\dxl\import-ur.dxl -WaitSeconds 300
powershell -NoProfile -ExecutionPolicy Bypass -File ..\doors\doors-run.ps1 `
  -DxlFile .\dxl\import-code.dxl -WaitSeconds 300

# ③ 标注测试层级 + 重建全部链接（约 15 分钟）
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\gen-relink.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File ..\doors\doors-run.ps1 `
  -DxlFile .\dxl\relink.dxl -WaitSeconds 900

# ④ 生成覆盖报告
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\link-report.ps1
```

**测试层级分派规则**（`relink.dxl`）：

| 序号范围 | 层级 | 连到 |
|---|---|---:|
| TC 1–30 | 单元测试 | 软件需求 SW（对位） |
| TC 31–38 | 集成测试 | SEC 1–8 |
| TC 39–46 | 集成测试 | NRG 1–8 |
| TC 47–55 | 集成测试 | ACS 1–9 |
| TC 56–80 | 系统测试 | SYS 1–25 |
| TC 81–93 | 验收测试 | UR 1–13 |

每条 TC 的正文末尾会被追加 `【测试层级:xxx】`，便于在界面筛选。

`build-links.dxl` 的配对规则：每个模块内按对象顺序“轮询”配对（源模块第 k 条需求 → 目标模块第 k 条需求，目标用完则回绕），
跳过章节标题对象，只连需求对象。

> 注：`relink.dxl` 使用 `edit(path, true)` 打开 8 个模块，会同时弹出 8 个窗口，执行较慢（约 15 分钟）。
> 期间不要关闭这些窗口。

### 9.4 结果（output/link-report.txt）

| 层级 | 模块 | 对象数 | 有出链 | 有入链 | 出链合计 | 入链合计 |
|---|---|---:|---:|---:|---:|---:|
| L1 | UR | 30 | 30 | 13 | 97 | 13 |
| L2 | SYS | 97 | 97 | 97 | 292 | 122 |
| L3 | SEC | 90 | 90 | 90 | 90 | 106 |
| L3 | NRG | 88 | 0 | 88 | 0 | 105 |
| L3 | ACS | 77 | 0 | 77 | 0 | 106 |
| L4 | SW | 90 | 0 | 90 | 0 | 210 |
| L5 | TC | 93 | 93 | 0 | 93 | 0 |
| L6 | CODE | 90 | 90 | 0 | 90 | 0 |

关键指标（全部 100%）：

| 指标 | 结果 |
|---|---|
| 用户需求分解率（有系统需求承接） | **100.0%**（30/30） |
| 系统需求分解率（有子系统需求承接） | **100.0%**（97/97） |
| 子系统需求承接率（有上游来源） | **100.0%**（255/255） |
| 软件需求实现率（有代码单元实现） | **100.0%**（90/90） |
| 代码单元关联率（已关联需求） | **100.0%**（90/90） |
| 测试用例关联率（已关联需求） | **100.0%**（93/93） |

共创建链接 **662 条**（97 + 292 + 90 + 90 + 93）。

**测试层级分布**：单元 30 / 集成 25（SEC 8 + NRG 8 + ACS 9）/ 系统 25 / 验收 13。

> NRG、ACS 没有出链，是因为“子系统→软件”链路只给 SEC 建了，属于演示范围取舍，不是缺陷。

### 9.5 一条完整链路长什么样

实测查询 `SYS-0001` 上下游的结果：

```
UR-0001 统一登录
   │ 分解
   ▼
SYS-0001 工作流引擎 ◀──验证── TC-0056（系统测试）
   │ 分解
   ▼
SEC-0001 智能行为分析
   │ 细化
   ▼
SW-0001 健康检查 ◀──实现── CODE-0001
                ◀──验证── TC-0001（单元测试）
```

**最长单向路径仍是 3 跳**（UR → SYS → SEC → SW），因为“实现/验证”都是向上指入 SW 的；
完整 V 形关系需在 SW 处反向一次才能看到 CODE 和 TC。
### 9.6 报告怎么读

- **出链** = 这条需求指向别人（如系统需求分解到子系统需求）
- **入链** = 别人指向这条需求（如系统需求被测试用例验证）
- **孤立** = 两条都没有 → 这类需求在评审时是重点：要么漏了分解，要么漏了测试
- 覆盖率低于 100% 时，直接按"有出链/有入链"筛出缺口清单

---

## 10. 变更影响分析（基线 + 变更演示）

### 10.1 关于 DOORS 原生基线

DOORS 的基线（Baseline）正常是在模块窗口里交互创建的。DXL 侧有两套接口：

| 接口 | 本次实测结果 |
|---|---|
| `bool baseline(Module)` | 返回 `false`，`canCreateBaselineInModule()` 为 `true`，但调用后无基线产生 |
| 基线集 `BaselineSetDefinition` + `create(..., BaselineSet&)` | 带 `&` 出参的调用在本环境统一报"已将空 string 参数传递到自变量位置 2" |

结论：**本环境的 DXL 无法可靠创建原生基线**（出参调用不可用 + baseline 需要交互）。
原生基线的操作步骤（手工）：

1. 打开模块窗口 → `文件` → `基线` → `新建基线…`
2. 填基线名称/描述 → 确定
3. 后续在 `文件 → 基线 → 比较` 中对比两个基线

因此本节用**"快照 + 差异对比"**实现等价的"基线比对 + 变更影响"效果，数据依据完全一样。

### 10.2 演示流程

```
snapshot.dxl        → 导出全部需求快照（基线 v1.0）
change-demo.dxl     → 修改 SYS 模块第 1 条需求（SYS-0001），模拟 v1.1 变更
snapshot.dxl        → 再导出一次快照
impact.dxl          → 沿链接图做影响分析（一跳 + 二跳）
change-impact.ps1   → 对比两份快照 + 汇总影响 → 报告
```

一条命令跑完：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\change-impact.ps1
```

### 10.3 实测结果（output/change-impact-report.txt）

**变更**：1 条（SYS-0001 工作流引擎），变更前后文本完整记录：

```
变更前: SYS-0001 工作流引擎：系统应提供工作流引擎，关键操作需双人复核。【类型:功能｜…】
变更后: SYS-0001 工作流引擎：… 【变更 v1.1：并发上限调整为 1000，并增加变更审计留痕要求】
```

**影响分析**：

| 类型 | 数量 | 说明 |
|---|---:|---|
| 直接下游（子系统需求） | 3 | SEC / NRG / ACS 各 1 条（分解链接） |
| 直接上游（测试用例） | 1 | 验证它的测试用例 |
| 二跳（软件需求） | 2 | 由子系统需求再细化下去的软件需求 |

报告直接列出每个受影响对象的编号和全文，评审时逐条确认是否要同步改。

### 10.4 两个新踩的坑（很重要）

1. **`for obj in m do` 结束后，`obj` 指向最后一个对象，不是匹配到的那个。**
   必须用独立变量 `hit = obj` 保存命中对象，否则改的是模块最后一条需求。
2. **DXL 的 `matches(pattern, string)` 是正则搜索，不是通配符。**
   `matches("SYS-0001*", txt)` 等价于正则 `SYS-000` + 零个或多个 `1`，
   会把 `SYS-0009` 也匹配上（因为包含子串 `SYS-000`）。
   要精确匹配应该用 `^SYS-0001 `（带锚点和空格），或干脆按位置取对象（本方案采用后者）。

---

---

## 11. 落地路线执行状态（第 1-5 步）

| 步骤 | 内容 | 状态 | 结果 |
|---|---|---|---|
| 1 | 变更管理闭环 | ✅ 已跑通 | 15 张变更单、24 条关联链接、5 种状态各 3 条 |
| 2 | 基线发布 | ✅ 已跑通（快照式） | `output/releases/v1.0-manifest.txt` + `v1.0-snapshot.txt` |
| 3 | 验证闭环 VCRM | ✅ 已跑通 | 97 条系统需求矩阵：已验证 70、失败 10、未执行 14、未覆盖 3 |
| 4 | ReqIF 供应链交换 | ✅ 已跑通 | `exchange.reqif`：605 个对象 + 474 条关系，722 KB，XML 校验通过 |
| 5 | 真实数据接入 | ✅ 已跑通 | 新数据集「医院信息平台」123 条需求全部入库 |

### 11.1 第 1 步：变更管理闭环

- 新目录 `/06 变更管理`，模块 `CR_变更单`
- 15 张变更单，字段：类型 / 影响 / 状态 / 提出人 / 评审人 / 提出日期 / 关闭日期 / 关联需求
- 状态分布：待评审、评审中、已批准、已实施、已关闭 **各 3 条**
- 链接模块 `/06 变更管理/CR_to_REQ`，把变更单连到受影响需求（24 条链接）
- 命令：`gen-cr.ps1` → `cr2dxl.ps1` → `doors-run.ps1 -DxlFile import-cr.dxl`

### 11.2 第 2 步：基线发布

```powershell
powershell -File .\tools\publish-baseline.ps1 -Version v1.0
```

产出 `output/releases/v1.0-manifest.txt`：需求总数 535、分模块数量、追溯覆盖率、变更单统计。
这是"快照式基线"；DOORS 原生基线仍需在模块窗口手工创建（见 10.1）。

### 11.3 第 3 步：验证闭环 VCRM

新增模块 `/05 验证与确认/TR_测试执行记录`（93 条执行记录）+ 链接模块 `TR_to_TC`。

数据模型（每轮执行一条记录）：

```
TR-001 用例:TC-0001【轮次:R1｜结果:通过｜执行日期:2026-11-05｜缺陷数:0｜执行人:李文】
```

链路：`系统需求 ←(VERIFY)— 测试用例 ←(TR_to_TC)— 执行记录`，
VCRM 报告沿这条链路把"需求 → 用例 → 结果"串起来。

**结果**（`output/vcrm-report.txt` + `vcrm-matrix.csv`）：

| 结论 | 数量 | 占比 |
|---|---:|---:|
| 已验证 | 70 | 72.2% |
| 存在失败 | 10 | 10.3% |
| 未执行 | 14 | 14.4% |
| 未覆盖 | 3 | 3.1% |

报告直接列出"需返工的需求"和"未覆盖的需求"清单，评审可直接用。

### 11.4 第 4 步：ReqIF 供应链交换

DOORS 自带的 ReqIF 导出向导要 GUI 交互，且 DXL 的 `createPackage(...)` 全部带出参（本环境不可用）。
因此改为：**从 DOORS 导出 → 生成标准 ReqIF 1.2 交换包**。

```powershell
powershell -File .\tools\gen-reqif.ps1
```

产出 `output/exchange.reqif`：

- 605 个 SPEC-OBJECT（需求），474 条 SPEC-RELATION（追溯关系）
- 结构：`THE-HEADER` + `CORE-CONTENT`（DATATYPES / SPEC-OBJECT-TYPES / SPEC-RELATION-TYPES / SPEC-OBJECTS / SPEC-RELATIONS）
- 已用 .NET XML 解析器校验通过
- 回导：DOORS 数据库浏览器 → `文件` → `导入 ReqIF 包`

> 说明：这是"符合 ReqIF 1.2 结构"的交换包，尚未经过 DOORS 官方导入器实测；
> 真正接入供应链前，建议先用 DOORS 的 ReqIF 导入向导验证一次。

### 11.5 第 5 步：真实数据接入

新生成一套**完全不同的领域数据**验证脚本通用性：

- 数据源：`data/his-requirements.csv`（医院信息平台，171 行 / 123 条需求 / 4 个模块）
- 生成器：`tools/gen-his.ps1`
- 转换：`tools/csv2dxl.ps1 -Csv ... -Out ...`（已参数化，可复用）
- 导入结果：4 个项目文件夹 + 4 个模块

这证明"CSV → DXL → DOORS"这条链路**不依赖特定领域**，换数据即可复用。
> 说明：医院信息平台这套验证数据在确认脚本通用性后**已从数据库中删除**（4 个文件夹全部移除）。
> 数据与脚本仍然保留在工程目录（`data/his-requirements.csv`、`tools/gen-his.ps1`），需要时可重新导入。

---
## 12. 文件清单

```
doors-enterprise/
├── data/
│   └── requirements.csv          767 行输入数据（UTF-8 BOM）
├── tools/
│   ├── gen-data.ps1              生成输入数据（固定种子，可复现）
│   ├── csv2dxl.ps1               CSV → DXL 转换器
│   ├── verify.ps1                自动校验（读回 + 比对 + 报告）
│   └── link-report.ps1           追溯覆盖率报告
├── dxl/
│   ├── import-all.dxl            1691 行导入脚本（自动生成）
│   ├── verify.dxl                校验读取脚本（自动生成）
│   ├── build-links.dxl           建追溯链接（3 个链接模块 + 475 条链接）
│   ├── link-coverage.dxl         导出每个需求的出链/入链数
│   ├── snapshot.dxl              需求快照（基线 v1.0 参照）
│   ├── change-demo.dxl           变更演示（改 SYS-0001）
│   └── impact.dxl                链接图影响分析（一跳 + 二跳）
├── output/
│   ├── import.log                导入日志
│   ├── all-objects.txt           全量对象导出（GBK）
│   ├── verify-report.txt         校验报告
│   ├── link-build.log            建链接日志
│   ├── link-coverage.txt         逐对象链接统计（GBK）
│   ├── link-report.txt           追溯覆盖率报告
│   ├── change-impact-report.txt  变更影响分析报告
│   ├── snapshot-before.txt       变更前快照（基线 v1.0）
│   └── snapshot-after.txt        变更后快照
│   ├── screenshot-root.png       根目录截图
│   └── screenshot-module.png     模块内容截图
└── docs/
    └── 使用文档.md               本文档
```

配套依赖：`doors/doors-run.ps1`（DXL 执行器）、`doors/dxl-functions.txt`（DXL 函数签名索引）。
本轮（第 1-5 步）新增文件：

```
data/change-requests.csv     15 张变更单
data/his-requirements.csv    医院信息平台 123 条需求
data/test-results.csv        93 条测试执行记录
tools/gen-cr.ps1             变更单生成
tools/cr2dxl.ps1             变更单 → DXL
tools/gen-his.ps1            医院数据集生成
tools/publish-baseline.ps1   基线发布
tools/gen-tr.ps1             执行记录生成
tools/tr2dxl.ps1             执行记录 → DXL
tools/vcrm.ps1               VCRM 矩阵报告
tools/gen-reqif.ps1          ReqIF 交换包生成
dxl/import-cr.dxl            变更单导入脚本
dxl/import-his.dxl           医院数据集导入脚本
dxl/import-tr.dxl            执行记录导入脚本
dxl/vcrm.dxl                 VCRM 数据导出
dxl/export-exchange.dxl      需求 + 链接导出
output/vcrm-matrix.csv       需求×用例×结果矩阵
output/vcrm-report.txt       VCRM 报告
output/exchange.reqif        ReqIF 1.2 交换包
output/reqif-report.txt      ReqIF 导出报告
output/releases/             v1.0 基线清单与快照
```

---

本轮（第 6 步：八层 V 形模型）新增文件：

```
data/ur-requirements.csv     30 条用户需求
data/code-units.csv          90 个代码单元
tools/gen-layers.ps1         生成上述两层数据
tools/gen-relink.ps1         生成链接重建 DXL（含层级分派）
dxl/import-ur.dxl            用户需求导入脚本（自动生成）
dxl/import-code.dxl          代码单元导入脚本（自动生成）
dxl/relink.dxl               标注层级 + 删旧链 + 重建全部链接（自动生成）
dxl/fix-ur-text.dxl          修正用户需求正文重复
output/relink.log            重建日志
output/link-report.txt       八层模型覆盖报告（已更新）
```

---

## 13. 备注

- 本次数据是**合成数据**，用于验证链路与演示；需求措辞由模板随机组合，个别语句在业务语义上可能不够自然，替换成真实数据即可。
- 早期遗留的 `/Demo Project`、医院信息平台（4 个文件夹）均已清理，当前根目录只有 `00`~`07` 八个项目文件夹。
- 重复执行步骤 3 是安全的：已存在的文件夹和模块会被跳过，不会产生重复数据。
- 2026-11-09 升级：链接 475 → 662 条，模块 7 → 11 个，新增用户需求层与代码单元层，测试用例按四级分派。
- **重复执行 relink.dxl 会重复建链**：它只删 TC 出链，不删 `UR_to_SYS`、`SW_to_CODE` 的旧链；全量重建前需先手工删除这两个链接模块，并清掉 TC 正文里的 `【测试层级:xxx】`。
