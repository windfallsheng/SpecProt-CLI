# 速查手册

## 命令 × 参数矩阵

| 命令 | 必填 | 可选 | 别名 |
| :--- | :--- | :--- | :--- |
| `ask [话...]` | — | — | — |
| `run` | `-i` | `-p --from --to -m -y --resume` | r |
| `convert` | `-i` | `-p` | cv |
| `analyze` | `-i -p` | — | az |
| `slice` | `-i -p` | — | sl |
| `deepen` | `-i -p` | `-f --phase` | — |
| `assets` | `-i -p -f` | `-k` | — |
| `schemes` | `-i -p -f` | — | — |
| `iteration create` | `-n` | `-p -g -f -t` | cr |
| `iteration list` | — | — | ls |
| `iteration freeze` | `-n` | `--force` | fz |
| `req new` | `-n` | `-d -p -i` | add |
| `req adopt` | `-i -p -f` | `-pj` | — |
| `req change` | `-r -i` | `-d` | — |
| `req list` | — | `-i` | ls |
| `req show` | `-r` | `-p` | — |
| `req link` | `-r -i` | — | — |
| `req status` | `-r -s` | — | — |
| `check` | — | `-i -s -f -p -u` | ck |
| `prototype` | — | `-i -f -o` | pt |
| `design` | — | `-s -u -c -H -f -p --update -o` | ds |
| `init` | — | — | — |

## 状态枚举(req status)

草稿 / 评审中 / 已通过 / 已冻结 / 开发中 / 已交付 / 已废弃 / 暂缓

## 流水线阶段枚举

convert / analyze / slice / deepen / adopt / freeze

## 输出标记速查

| 标记 | 含义 |
| :--- | :--- |
| `[SPECPROT_PROMPT]` | AI 接力提示块(宿主 AI 按指引成文) |
| `[SPECPROT_STEP_DONE]` | 步骤完成,新会话继续 |
| `[SPECPROT_NEXT_STEP]` | 下一步指令与续跑命令 |
| `[SPECPROT_NEEDS_INFO]` | 参数缺失,点名缺什么 |

## 六闸口

范围确认 · 素材为空 · 空骨架拦截 · 待确认未清 · 风险未裁决 · 收养确认

## 七风险透镜

资金业务 · 金融合规 · 隐私合规 · 无障碍 · 内容合规 · 并发防护 · 状态机完备

## 模板匹配优先级

`{端}/专属` > `根级共用` > `系统默认`

支持覆盖:REQUIREMENT.md(端级)/ UNIT_REQUIREMENT.md(单元)/ CLARIFY.md(待确认)。
不开放覆盖:OUTLINE 四段契约、RISK 三列裁决(系统强制结构)。

## 目录速查

| 目录 | 职责 |
| :--- | :--- |
| `.speccore/GLOBAL/` | 全局需求层(单一事实源) |
| `期次-XXX/00-素材/{端}/` | 投料区 |
| `期次-XXX/00-素材/_templates/` | 产品模板区(可选) |
| `期次-XXX/{端}/REQUIREMENT.md` | 端级需求文档 |
| `期次-XXX/{端}/features/{单元}/` | 功能单元 |
| `期次-XXX/04-交付/` | 冻结交付镜像 → SpecCore 010-requirements/ |

## 三步走

```bash
specprot iteration create -n 期次-XXX -p web,backend   # 建期次
# 投料进期次-XXX/00-素材/{端}/
specprot run -i 期次-XXX -m interactive                # 跑流水线
```
