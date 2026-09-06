// E2E 测试用 electron 桩
globalThis.__handlers = {};
globalThis.__events = [];
module.exports = {
  ipcMain: { handle: (n, f) => { globalThis.__handlers[n] = f; } },
  BrowserWindow: { getAllWindows: () => [{ webContents: { send: (c, ev) => globalThis.__events.push(ev) } }] },
  dialog: { showSaveDialog: async () => ({ canceled: true }) }
};
