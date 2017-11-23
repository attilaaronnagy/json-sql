const _ = require('underscore');
const base = require('./dialects/base');
const mssql = require('./dialects/mssql');
const postgresql = require('./dialects/postgresql');
const sqlite = require('./dialects/sqlite');
const mysql = require('./dialects/mysql');

const dialectsHash = {
  base,
  mssql,
  postgresql,
  sqlite,
  mysql
};

module.exports = class Builder {
  constructor(options) {
    this.configure(options);
  }

  configure(options) {
    options = Object.assign(
      {},
      {
        separatedValues: true,
        namedValues: true,
        valuesPrefix: '$',
        dialect: 'base',
        wrappedIdentifiers: true,
        indexedValues: true
      },
      options
    );

    if (options.namedValues && !options.indexedValues) {
      throw new Error('Option `indexedValues`: false is not allowed together with option `namedValues`: true');
    }

    this.options = options;

    this.setDialect(this.options.dialect);

    this._reset();
  }

  _reset() {
    if (this.options.separatedValues) {
      this._placeholderId = 1;
      this._values = this.options.namedValues ? {} : [];
    } else {
      delete this._placeholderId;
      delete this._values;
    }
    this._query = '';
  }

  _getPlaceholder() {
    let placeholder = '';
    if (this.options.namedValues) placeholder += 'p';
    if (this.options.indexedValues) {
      placeholder += this._placeholderId;
      this._placeholderId += 1;
    }
    return placeholder;
  }

  _wrapPlaceholder(name) {
    return this.options.valuesPrefix + name;
  }

  _pushValue(value) {
    if (_.isUndefined(value) || _.isNull(value)) {
      return 'null';
    } else if (_.isNumber(value) || _.isBoolean(value)) {
      return String(value);
    } else if (_.isString(value) || _.isDate(value)) {
      if (this.options.separatedValues) {
        const placeholder = this._getPlaceholder();

        if (this.options.namedValues) {
          this._values[placeholder] = value;
        } else {
          this._values.push(value);
        }

        return this._wrapPlaceholder(placeholder);
      }
      if (_.isDate(value)) value = value.toISOString();
      return `'${value}'`;
    }
    throw new Error(`Wrong value type "${typeof value}"`);
  }

  build(params) {
    const builder = this;

    this._reset();

    this._query = `${this.dialect.buildTemplate('query', { queryBody: params })};`;

    if (this.options.separatedValues) {
      return {
        query: this._query,
        values: this._values,
        prefixValues() {
          const values = {};
          _(this.getValuesObject()).each((value, name) => {
            values[builder._wrapPlaceholder(name)] = value;
          });
          return values;
        },
        getValuesArray() {
          return Array.isArray(this.values) ? this.values : _(this.values).values();
        },
        getValuesObject() {
          return Array.isArray(this.values) ? _(_.range(1, this.values.length + 1)).object(this.values) : this.values;
        }
      };
    }
    return { query: this._query };
  }

  setDialect(name) {
    if (!dialectsHash[name]) {
      throw new Error(`Unknown dialect '${name}'`);
    }

    this.dialect = new dialectsHash[name](this);
  }
};
