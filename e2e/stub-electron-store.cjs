// E2E 测试用 electron-store 桩(内存实现, config 预载真实配置)
const fs = require('fs');
module.exports = class Store {
  constructor(opts) {
    this.name = opts.name;
    this._data = opts.defaults ? JSON.parse(JSON.stringify(opts.defaults)) : {};
    if (this.name === 'config') {
      try {
        const real = JSON.parse(fs.readFileSync('C:/Users/57699/AppData/Roaming/novel-generator/config.json', 'utf8'));
        Object.assign(this._data, real);
      } catch (e) { /* ignore */ }
    }
    if (this.name === 'saves') this._data.saves = [];
  }
  get store() { return this._data; }
  set store(v) { this._data = v; }
  get(k) { return this._data[k]; }
  set(k, v) { this._data[k] = v; }
};
