# Cloudflare Pages（非官方）部署指南

> ⚠️ **非官方说明**：本项目官方 README 未提供 Cloudflare Pages 部署说明，本文件为实验性指南，可能因平台限制而失败。

## 一句话结论
Cloudflare Pages 可以尝试部署，但 **必须改用本文件的构建脚本**，并接受 **部分后端能力可能不可用** 的限制。

## 适用场景
- 你只想要 **免费、简单、前后端一体** 的部署方式。
- 你可以接受 **Redis/Kvrocks/Upstash 等外部存储在 Pages 上不可用**。
- 推荐使用 `localstorage` 作为存储模式。

## 1. 修改后的构建脚本（已在 package.json 中加入）
```bash
pnpm pages:build
```
这个脚本会执行：
1) 生成 manifest  
2) Next.js 构建  
3) 使用 `@cloudflare/next-on-pages` 生成 Pages 输出目录

## 2. 在 Cloudflare Pages 上配置
**Build command**
```
pnpm pages:build
```

**Build output directory**
```
.vercel/output/static
```

## 3. 必填环境变量（重要）
在 Cloudflare Pages 的「Settings → Environment variables」中添加：

```
PASSWORD=你自己的访问密码
NEXT_PUBLIC_STORAGE_TYPE=localstorage
```

> ⚠️ **注意**：如果你设置成 redis/kvrocks/upstash，会因为 Pages 运行环境限制而失败。

## 4. 部署后访问
部署完成后直接访问 Pages 提供的域名即可登录使用。

## 5. 常见问题
### 1) 构建失败 / 运行失败
Cloudflare Pages 是 Worker 环境，不支持 Node.js 原生 API。  
如果你在后端 API 中使用了 Node-only 能力，会导致报错。

### 2) 登录后闪退或白屏
通常是因为环境变量缺失或存储模式设置不正确（必须 localstorage）。

---

> 如果你需要我进一步改代码来提高 Pages 兼容性（例如移除 Node-only 依赖或改为 Edge Runtime），请直接告诉我。
