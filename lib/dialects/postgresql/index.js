const BaseDialect = require('../base');
const _ = require('underscore');
const templatesInit = require('./templates');
const blocksInit = require('./blocks');
const operatorsInit = require('./operators');

module.exports = class Dialect extends BaseDialect {
  constructor(builder) {
    super(builder);
    // init templates
    templatesInit(this);
    // init blocks
    blocksInit(this);
    // init operators
    operatorsInit(this);

    this.config = Object.assign({}, this.config, {
      jsonSeparatorRegexp: /->>?/g
    });
  }

  _wrapIdentifier(name) {
    // split by json separator
    const nameParts = name.split(this.config.jsonSeparatorRegexp);
    const separators = name.match(this.config.jsonSeparatorRegexp);

    // wrap base identifier
    let identifier = BaseDialect.prototype._wrapIdentifier.call(this, nameParts[0]);

    // wrap all json identifier and join them with separators
    identifier += _(separators).reduce((memo, separator, index) => {
      return `${memo}${separator}'${nameParts[index + 1]}'`;
    }, '');

    return identifier;
  }
};
