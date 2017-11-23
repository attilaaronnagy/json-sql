const _ = require('underscore');

module.exports = dialect => {
  const parentValueBlock = dialect.blocks.get('value');
  dialect.blocks.set('value', params => {
    const { value } = params;

    let result;
    if (_.isArray(value)) {
      result =
        'array[' +
        _(value)
          .map(item => {
            return dialect.builder._pushValue(item);
          })
          .join(', ') +
        ']';
    } else if (_.isObject(value)) {
      result = dialect.builder._pushValue(JSON.stringify(value));
    } else {
      result = parentValueBlock(params);
    }

    return result;
  });

  dialect.blocks.add('explain:options', params => {
    return (
      '(' +
      _(params.options)
        .chain()
        .pick(['analyze', 'verbose', 'costs', 'buffers', 'timing', 'format'])
        .map((value, key) => {
          return key + ' ' + value;
        })
        .value()
        .join(', ') +
      ')'
    );
  });

  dialect.blocks.add('explain:analyze', () => {
    return 'analyze';
  });

  dialect.blocks.add('explain:verbose', () => {
    return 'verbose';
  });

  dialect.blocks.add('distinctOn', params => {
    let { distinctOn } = params;
    let result = '';

    if (_.isString(distinctOn)) distinctOn = [distinctOn];

    if (Array.isArray(distinctOn)) {
      result = distinctOn.map(distinctOnField => dialect._wrapIdentifier(distinctOnField)).join(', ');
    }

    if (result) {
      result = 'distinct on (' + result + ')';
    }

    return result;
  });
};
