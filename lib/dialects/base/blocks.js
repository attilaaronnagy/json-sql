const _ = require('underscore');
const objectUtils = require('../../utils/object');

function removeTopBrackets(condition) {
  if (condition.length && condition[0] === '(' && condition[condition.length - 1] === ')') {
    condition = condition.slice(1, condition.length - 1);
  }

  return condition;
}

const termKeys = ['select', 'query', 'field', 'value', 'func', 'expression'];
function isTerm(obj) {
  return objectUtils.isObjectObject(obj) && objectUtils.hasSome(obj, termKeys);
}

module.exports = dialect => {
  dialect.blocks.add('distinct', () => 'distinct');

  dialect.blocks.add('fields', params => {
    let fields = params.fields || {};

    if (!_.isObject(fields)) {
      throw new Error(`Invalid 'fields' property type "${typeof fields}"`);
    }

    if (_.isEmpty(fields)) return '*';

    // If fields is array: ['a', {b: 'c'}, {name: '', table: 't', alias: 'r'}]
    if (Array.isArray(fields)) {
      fields = _(fields).map(field => {
        if (objectUtils.isSimpleValue(field) || isTerm(field) || _.has(field, 'name')) {
          // if field has simple type or is field object: {name: '', table: 't', alias: 'r'}
          return dialect.buildBlock('term', { term: field, type: 'field' });
        }
        // if field is non-field object: {b: 'c'}
        return dialect.buildBlock('fields', { fields: field });
      });

      // If fields is object: {a: 'u', b: {table: 't', alias: 'c'}}
    } else {
      // use keys as field names
      fields = _(fields).map((field, name) => {
        // if field is not an object value, use it as alias
        if (_.isString(field)) field = { alias: field };

        // if field does not have name, get it from key
        if (!_.has(field, 'name')) field = _.defaults({ name }, field);

        return dialect.buildBlock('term', { term: field, type: 'field' });
      });
    }

    return _(fields)
      .compact()
      .join(', ');
  });

  dialect.blocks.add('term', params => {
    let { term } = params;
    let type = params.type || 'field';

    const isSimpleValue = objectUtils.isSimpleValue(term);
    const isArray = Array.isArray(term);

    if ((isSimpleValue && !_.isString(term)) || isArray) type = 'value';

    if (isSimpleValue || !isTerm(term) || isArray) {
      term = _(term)
        .chain()
        .pick('cast', 'alias')
        .extend(_.object([type], [term]))
        .value();
    }

    type = _(termKeys).find(key => {
      return _.has(term, key);
    });

    let result = dialect.buildBlock(type, _(term).pick(type));

    if (_.has(term, 'cast')) {
      let castTerm = term.cast;

      if (dialect.builder.options.deburrIdentifiers) {
        castTerm = castTerm.replace(/[^a-zA-Z0-9"*_.-]/g, '').toLowerCase();
      }

      result = `cast(${result} as ${castTerm})`;
    }

    if (_.has(term, 'alias')) {
      result += ` ${dialect.buildBlock('alias', { alias: term.alias })}`;
    }

    return result;
  });

  dialect.blocks.add('table', params => {
    const name = _.isString(dialect.builder.options.tablePrefix) ? `${dialect.builder.options.tablePrefix}_${params.table}` : params.table;
    return dialect.buildBlock('name', { name });
  });

  dialect.blocks.add('func', params => {
    let { func } = params;

    if (_.isString(func)) func = { name: func };

    if (!_.isObject(func)) {
      throw new Error(`Invalid 'func' property type "${typeof func}"`);
    }

    if (!_.has(func, 'name')) {
      throw new Error('`func.name` property is required');
    }

    let args = '';

    if (Array.isArray(func.args)) {
      args = func.args.map(arg => dialect.buildBlock('term', { term: arg, type: 'value' })).join(', ');
    }

    let funcName = func.name;

    if (dialect.builder.options.deburrIdentifiers) {
      funcName = funcName.replace(/[^a-zA-Z0-9"*_.-]/g, '').toLowerCase();
    }

    return `${funcName}(${args})`;
  });

  dialect.blocks.add('expression', params => {
    let { expression } = params;

    if (_.isString(expression)) expression = { pattern: expression };

    if (!_.isObject(expression)) {
      throw new Error(`Invalid 'expression' property type "${typeof expression}"`);
    }

    if (!_.has(expression, 'pattern')) {
      throw new Error('`expression.pattern` property is required');
    }

    const values = expression.values || {};
    const regex = /\{([a-z0-9*]+)\}/gi;
    const regexForCount = /([a-z0-9*]+)/gi;
    expression.pattern = expression.pattern.replace(/[^a-zA-Z0-9*(_){.}-]/g, '').toLowerCase();

    const regexCheck = expression.pattern.match(regex);
    const regexCountCheck = expression.pattern.match(regexForCount);
    if (regexCheck === null && regexCountCheck === null) {
      throw new Error('Expression regex error!');
    }

    return expression.pattern
      .replace(regex, (fullMatch, block) => {
        if (!_.has(values, block)) {
          throw new Error(`Field '${block}' is required in 'expression.values' property`);
        }

        return dialect.buildBlock('term', { term: values[block], type: 'value' });
      })
      .trim();
  });

  dialect.blocks.add('field', params => {
    let { field } = params;

    if (_.isString(field)) field = { name: field };

    if (!_.isObject(field)) {
      throw new Error(`Invalid 'field' property type "${typeof field}"`);
    }

    if (!_.has(field, 'name')) {
      throw new Error('`field.name` property is required');
    }

    let result = dialect.buildBlock('name', { name: field.name });

    if (_.has(field, 'table')) {
      result = `${dialect.buildBlock('table', { table: field.table })}.${result}`;
    }

    return result;
  });

  dialect.blocks.add('value', params => {
    let { value } = params;
    if (_.isRegExp(value)) value = value.source;
    return dialect.builder._pushValue(value);
  });

  dialect.blocks.add('name', params => {
    return dialect._wrapIdentifier(params.name);
  });

  dialect.blocks.add('alias', params => {
    let { alias } = params;

    if (_.isString(alias)) alias = { name: alias };

    if (!_.isObject(alias)) {
      throw new Error(`Invalid 'alias' property type "${typeof alias}"`);
    }
    if (!_.has(alias, 'name')) {
      throw new Error('`alias.name` property is required');
    }

    let result = `as ${dialect._wrapIdentifier(alias.name)}`;

    if (Array.isArray(alias.columns)) {
      result += `(${alias.columns.map(column => dialect._wrapIdentifier(column)).join(', ')})`;
    }

    return result;
  });

  dialect.blocks.add('condition', params => {
    let result = dialect.buildCondition({
      value: params.condition,
      defaultFetchingOperator: '$value'
    });

    if (result) {
      result = `where ${removeTopBrackets(result)}`;
    }

    return result;
  });

  dialect.blocks.add('modifier', params => {
    let result = dialect.buildModifier({
      modifier: params.modifier
    });

    if (result) {
      result = `set ${result}`;
    }

    return result;
  });

  dialect.blocks.add('join', params => {
    const { join } = params;
    let result = '';

    // if join is array -> make each joinItem
    if (Array.isArray(join)) {
      result = _(join)
        .map(joinItem => dialect.buildTemplate('joinItem', joinItem))
        .join(' ');

      // if join is object -> set table name from key and make each joinItem
    } else if (_.isObject(join)) {
      result = _(join)
        .map((joinItem, table) => {
          if (!objectUtils.hasSome(joinItem, ['table', 'query', 'select', 'expression'])) {
            joinItem = _.defaults({ table }, joinItem);
          }

          return dialect.buildTemplate('joinItem', joinItem);
        })
        .join(' ');
    }

    return result;
  });

  dialect.blocks.add('joinItem:type', params => {
    return params.type.toLowerCase();
  });

  dialect.blocks.add('joinItem:on', params => {
    // `on` block is use `$field` as default query operator because it most used case
    let result = dialect.buildCondition({
      value: params.on,
      defaultFetchingOperator: '$field'
    });

    if (result) {
      result = `on ${removeTopBrackets(result)}`;
    }

    return result;
  });

  dialect.blocks.add('group', params => {
    let { group } = params;
    let result = '';

    if (_.isString(group)) group = [group];

    if (Array.isArray(group)) {
      result = group.map(field => dialect._wrapIdentifier(field)).join(', ');
    }

    if (result) {
      result = `group by ${result}`;
    }

    return result;
  });

  dialect.blocks.add('having', params => {
    let result = dialect.buildCondition({
      value: params.having,
      defaultFetchingOperator: '$value'
    });

    if (result) {
      result = `having ${removeTopBrackets(result)}`;
    }

    return result;
  });

  dialect.blocks.add('sort', params => {
    let { sort } = params;
    let result = '';

    if (_.isString(sort)) sort = [sort];

    if (Array.isArray(sort)) {
      result = _(sort)
        .map(sortField => {
          return dialect._wrapIdentifier(sortField);
        })
        .join(', ');
    } else if (_.isObject(sort)) {
      result = _(sort)
        .map((direction, field) => {
          return `${dialect._wrapIdentifier(field)} ${direction > 0 ? 'asc' : 'desc'}`;
        })
        .join(', ');
    }

    if (result) {
      result = `order by ${result}`;
    }

    return result;
  });

  dialect.blocks.add('limit', params => {
    return `limit ${dialect.builder._pushValue(params.limit)}`;
  });

  dialect.blocks.add('offset', params => {
    return `offset ${dialect.builder._pushValue(params.offset)}`;
  });

  dialect.blocks.add('or', params => {
    return `or ${params.or}`;
  });

  dialect.blocks.add('insert:values', params => {
    let { values } = params;

    if (!Array.isArray(values)) values = [values];

    const fields =
      params.fields ||
      _(values)
        .chain()
        .map(row => {
          return _(row).keys();
        })
        .flatten()
        .uniq()
        .value();

    return dialect.buildTemplate('insertValues', {
      fields,
      values: _(values).map(row => {
        return _(fields).map(field => {
          return dialect.buildBlock('value', { value: row[field] });
        });
      })
    });
  });

  dialect.blocks.add('insertValues:values', params => {
    return _(params.values)
      .map(row => `(${row.join(', ')})`)
      .join(', ');
  });

  dialect.blocks.add('queryBody', params => {
    const queryBody = params.queryBody || {};

    return dialect.buildTemplate(queryBody.type || 'select', queryBody);
  });

  dialect.blocks.add('query', params => {
    return dialect.buildTemplate('subQuery', { queryBody: params.query });
  });

  dialect.blocks.add('select', params => {
    return dialect.buildTemplate('subQuery', { queryBody: params.select });
  });

  dialect.blocks.add('queries', params => {
    return _(params.queries)
      .map(query => {
        return dialect.buildTemplate('query', { queryBody: query });
      })
      .join(` ${params.type}${params.all ? ' all' : ''} `);
  });

  function buildWith(withList) {
    let result = '';

    // if with clause is array -> make each withItem
    if (Array.isArray(withList)) {
      result = _(withList)
        .map(withItem => {
          return dialect.buildTemplate('withItem', withItem);
        })
        .join(', ');

      // if with clause is object -> set name from key and make each withItem
    } else if (_.isObject(withList)) {
      result = _(withList)
        .map((withItem, name) => {
          if (!withItem.name) {
            withItem = _.clone(withItem);
            withItem.name = name;
          }
          return dialect.buildTemplate('withItem', withItem);
        })
        .join(', ');
    }

    return result;
  }

  dialect.blocks.add('with', params => {
    let result = buildWith(params.with);
    if (result) {
      result = `with ${result}`;
    }
    return result;
  });

  dialect.blocks.add('withRecursive', params => {
    let result = buildWith(params.withRecursive);
    if (result) {
      result = `with recursive ${result}`;
    }
    return result;
  });

  dialect.blocks.add('returning', params => {
    let result = dialect.buildBlock('fields', { fields: params.returning });
    if (result) {
      result = `returning ${result}`;
    }
    return result;
  });
};
