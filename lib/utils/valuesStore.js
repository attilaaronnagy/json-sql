module.exports = class ValuesStore {
  constructor(options) {
    options = options || {};
    this._values = options.values || {};
    this.set = this.add;
  }

  add(name, value) {
    this._values[name] = value;
  }

  get(name) {
    return this._values[name] || null;
  }

  remove(name) {
    delete this._values[name];
  }

  has(name) {
    return this._values[name] !== undefined;
  }
};
