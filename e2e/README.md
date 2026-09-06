# E2E 游戏循环测试

用桩替换 electron / electron-store，在纯 Node 中运行真实主进程逻辑，
完整模拟：开场答题 → 蓝图生成 → 多轮剧情（随机选选项）→ 主动完结 → 成书。

```bash
# 1. 编译主进程 bundle
npx esbuild electron/main/ipc/handlers.ts --bundle --platform=node --format=cjs \
  --outfile=_e2e.cjs \
  --alias:electron=./e2e/stub-electron.cjs \
  --alias:electron-store=./e2e/stub-electron-store.cjs \
  --external:openai --external:undici

# 2. 运行（需 config.json 中已有可用 Key）
node e2e/playthrough.test.cjs

# 3. 清理
rm _e2e.cjs
```

注意：会真实调用 LLM API（约 20+ 次调用，几分钟耗时）。
stub 会从 %APPDATA%/novel-generator/config.json 预读真实配置。
