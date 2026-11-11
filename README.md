# 北邮空教室查询（BUPT Empty Classroom）

基于北邮课表数据快照的空教室查询站点：按校区、教学楼、楼层、日期与节次（多选取交集）检索空闲教室。

线上部署于 Vercel；本地开发与生产环境共用同一套业务逻辑。

## 数据说明（重要）

- `backend/data/data.json` 是一次**爬取的课表静态快照**，目前由维护者手动更新，仓库内不含爬虫。
- 查询按「星期几」匹配课表，因此结果反映的是快照对应学期的情况；快照过期后结果可能失真。前端在数据超过 14 天未更新时会展示提示条。
- 数据覆盖以快照实际内容为准：部分教学楼可能缺失或只有少量教室（快照内不含的楼不会出现，也不会用假数据兜底）。
- 快照结构：

  ```jsonc
  {
    "classrooms": [
      {
        "campus": "校本部 | 沙河校区",
        "building": "教三楼",
        "roomName": "3-305",
        "dayOfWeek": "星期一",
        "sections": [{ "section": "01", "occupied": false, "details": "" }]
      }
    ],
    "scrapes": [ ... ]
  }
  ```

## 目录结构

```
api/[...route].js        # Vercel Serverless 入口（零 npm 依赖），委托给 backend/lib
backend/
  server.js              # 本地 Express 服务（API + 静态托管前端构建产物）
  lib/
    classroomService.js  # 课表索引与查询核心逻辑（两套运行时共用）
    api.js               # 统一的路由 / 参数校验 / 响应装配
  data/data.json         # 课表静态快照
frontend/                # React 18 + Vite + TypeScript
tests/                   # 基于真实快照的 API 行为测试（node:test，无额外依赖）
```

## 本地开发

要求 Node.js ≥ 20。

```bash
npm run install:all   # 安装根 / backend / frontend 三处依赖
npm run dev           # 前端 http://localhost:5173（/api 代理到 4000）+ 后端
```

## 构建与测试

```bash
npm run build   # tsc -b 类型检查 + vite 构建 → frontend/dist
npm run lint    # ESLint（frontend）
npm test        # node --test，基于真实数据快照校验 API 行为
```

## 部署（Vercel）

- `vercel.json`：`installCommand` 安装根与前端依赖，`buildCommand` 执行 `npm run build`，静态产物取 `frontend/dist`；
- `/api/*` 路由到 `api/[...route].js`，其余路径回退到 `index.html`（SPA）；
- Serverless 函数与本地后端共用 `backend/lib`，行为一致。

## API

所有接口均为 GET，返回 `{ success, message, ... }`，支持 `campus=xitucheng|shahe`（也接受 `西土城校区` / `沙河校区` / `校本部` 别名）。

| 路径 | 参数 | 说明 |
| --- | --- | --- |
| `/api/health` | — | 健康检查 |
| `/api/buildings` | `campus` | 数据中实际存在教学楼的列表 |
| `/api/floors` | `campus`, `building` | 从房间号派生的楼层列表 |
| `/api/availability` | `campus`, `building`, `date`, `floor?`, `timeSlot`（可重复） | 空闲查询；多节次取交集，`timeSlot` 需为合法节次（如 `08:00-08:45`） |

`/api/availability` 响应含 `lastUpdatedAt`（快照时间）、`summary`（total/available/busy）与 `classrooms`（room/status/floor/description）。容量字段已移除：此前按房间号区间推算的“容量”属于编造数据。

## 已知限制

- 数据快照为手动更新，尚未接入自动抓取管道；
- 楼层由房间号数字推断（如 `N411 → 4F`），个别无数字编号的教室显示为「未知」；
- 日期仅用于匹配星期几，快照内不含具体日期的调课/停课信息。

## License

[MIT](./LICENSE)
