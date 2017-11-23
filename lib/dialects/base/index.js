const _ = require('underscore');
const ValuesStore = require('../../utils/valuesStore');
const objectUtils = require('../../utils/object');
const templatesInit = require('./templates');
const blocksInit = require('./blocks');
const operatorsInit = require('./operators');
const modifiersInit = require('./modifiers');

const blockRegExp = /\{([a-z0-9]+)\}(.|$)/gi;

module.exports = class Dialect {
  constructor(builder) {
    this.builder = builder;

    this.templates = new ValuesStore();
    this.blocks = new ValuesStore();
    this.operators = {
      comparison: new ValuesStore(),
      logical: new ValuesStore(),
      fetching: new ValuesStore(),
      state: new ValuesStore()
    };
    this.modifiers = new ValuesStore();

    this.config = {
      identifierPrefix: '"',
      identifierSuffix: '"'
    };

    // init templates
    templatesInit(this);

    // init blocks
    blocksInit(this);

    // init operators
    operatorsInit(this);

    // init modifiers
    modifiersInit(this);

    this.identifierPartsRegexp = new RegExp(
      `(${this.config.identifierPrefix}[^${this.config.identifierSuffix}]*${this.config.identifierSuffix}|[^.]+)`,
      'g'
    );
    this.wrappedIdentifierPartRegexp = new RegExp(`^${this.config.identifierPrefix}.*${this.config.identifierSuffix}$`);
  }

  _wrapIdentifier(name) {
    if (this.builder.options.wrappedIdentifiers) {
      if (!_.isString(name)) {
        throw new Error('Identifier is not a string!');
      }

      let initalName = name;

      if (this.builder.options.deburrIdentifiers) {
        initalName = initalName.replace(/[^a-zA-Z0-9"*_.-]/g, '').toLowerCase();
      }

      if (this.builder.options.lowercaseIdentifiers) {
        initalName = initalName.toLowerCase();
      }

      const generatedName = initalName.match(this.identifierPartsRegexp);

      return generatedName
        .map(namePart => {
          if (namePart !== '*' && !this.wrappedIdentifierPartRegexp.test(namePart)) {
            namePart = this.config.identifierPrefix + namePart + this.config.identifierSuffix;
          }

          return namePart;
        })
        .join('.');
    }

    return name;
  }

  buildLogicalOperator(params) {
    const { operator } = params;
    let { value } = params;

    if (objectUtils.isSimpleValue(value)) {
      value = _.object([params.defaultFetchingOperator], [value]);
    }

    if (_.isEmpty(value)) return '';

    let result;

    if (Array.isArray(value)) {
      // if value is array: [{a: 1}, {b: 2}] process each item as logical operator
      result = value.map(item =>
        this.buildOperator({
          context: 'logical',
          contextOperator: operator,
          operator: '$and',
          value: item,
          states: [],
          defaultFetchingOperator: params.defaultFetchingOperator
        })
      );
    } else {
      result = Object.entries(value).map(([field, item]) => {
        // if field name is not a operator convert it to {$field: {name: 'a', $eq: 'b'}}
        if (field[0] !== '$') {
          if (objectUtils.isSimpleValue(item) || Array.isArray(item)) {
            item = { $eq: item };
          }
          item = _.defaults({ name: field }, item);
          field = '$field';
        }

        return this.buildOperator({
          context: 'logical',
          contextOperator: operator,
          operator: field,
          value: item,
          states: [],
          defaultFetchingOperator: params.defaultFetchingOperator
        });
      });
    }

    return this.operators.logical.get(operator).fn(_.compact(result));
  }

  buildComparisonOperator(params) {
    let { operator } = params;

    _(params.states).each(state => {
      operator = this.operators.state.get(state).getOperator(operator);
    });

    const operatorParams = this.operators.comparison.get(operator);

    const value = this.buildEndFetchingOperator({
      context: 'comparison',
      contextOperator: operator,
      value: params.value,
      states: params.states,
      defaultFetchingOperator: operatorParams.defaultFetchingOperator || params.defaultFetchingOperator
    });

    return operatorParams.fn(params.field, value);
  }

  buildFetchingOperator(params) {
    const { operator } = params;
    const { value } = params;

    const field = this.operators.fetching.get(operator).fn(value, params.end);

    let result;
    if (params.end || objectUtils.isSimpleValue(value)) {
      result = field;
    } else {
      result = this.buildOperatorsGroup({
        context: 'fetching',
        contextOperator: operator,
        operator: '$and',
        field,
        value,
        states: params.states,
        defaultFetchingOperator: params.defaultFetchingOperator
      });
    }

    return result;
  }

  buildEndFetchingOperator(params) {
    let { value } = params;
    let operator;

    if (objectUtils.isObjectObject(value)) {
      // get first query operator
      operator = _(value).findKey((item, loperator) => {
        return loperator[0] === '$' && this.operators.fetching.has(loperator);
      });

      if (operator) {
        value = value[operator];
      }
    }

    return this.buildOperator(
      Object.assign({}, params, {
        operator: operator || params.defaultFetchingOperator,
        value,
        end: true
      })
    );
  }

  buildStateOperator(params) {
    return this.buildOperatorsGroup(
      Object.assign({}, params, {
        context: 'state',
        contextOperator: params.operator,
        operator: '$and',
        states: params.states.concat(params.operator)
      })
    );
  }

  buildOperatorsGroup(params) {
    const { value } = params;

    let result;
    if (objectUtils.isObjectObject(value)) {
      result = this.operators.logical.get(params.operator).fn(
        _(value)
          .chain()
          .map((item, operator) => {
            if (operator[0] !== '$') return '';

            if (this.operators.fetching.has(operator)) {
              // convert {a: {$field: 'b'}} to {a: {$eq: {$field: 'b'}}}
              item = _.object([operator], [item]);
              operator = '$eq';
            }

            return this.buildOperator(
              Object.assign({}, params, {
                operator,
                value: item
              })
            );
          })
          .compact()
          .value()
      );

      if (!result) result = params.field;
    } else {
      result = this.buildEndFetchingOperator(params);
    }

    return result;
  }

  buildOperator(params) {
    const isContextValid = (expectedContexts, context) => _.contains(expectedContexts, context);

    const { context } = params;
    const { operator } = params;

    let result;

    const contexts = _(this.operators).mapObject(operatorsGroup => operatorsGroup.has(operator));

    if (!_(contexts).some()) {
      throw new Error(`Unknown operator "${operator}"`);
    }

    if (contexts.logical && isContextValid(['null', 'logical'], context)) {
      result = this.buildLogicalOperator(params);
    } else if (contexts.fetching && isContextValid(['logical', 'comparison'], context)) {
      result = this.buildFetchingOperator(params);
    } else if (contexts.comparison && isContextValid(['fetching', 'state'], context)) {
      result = this.buildComparisonOperator(params);
    } else if (contexts.state && isContextValid(['fetching', 'state'], context)) {
      result = this.buildStateOperator(params);
    } else {
      let errMessage = `Unexpected operator "${operator}" at ${context === 'null' ? 'null ' : ''} context'`;

      if (params.contextOperator) {
        errMessage += ` of operator "${params.contextOperator}"`;
      }

      throw new Error(errMessage);
    }

    return result;
  }

  buildCondition(params) {
    return this.buildOperator({
      context: 'null',
      operator: '$and',
      value: params.value,
      states: [],
      defaultFetchingOperator: params.defaultFetchingOperator
    });
  }

  buildModifier(params) {
    return _(params.modifier)
      .chain()
      .map((values, field) => {
        let modifier;

        if (field[0] === '$') {
          modifier = field;
        } else {
          modifier = '$set';
          values = _.object([field], [values]);
        }

        const modifierFn = this.modifiers.get(modifier);

        if (!modifierFn) {
          throw new Error(`Unknown modifier "${modifier}"`);
        }

        return _(values).map((value, fieldl) => {
          fieldl = this._wrapIdentifier(fieldl);
          value = this.buildBlock('term', { term: value, type: 'value' });

          return modifierFn(fieldl, value);
        });
      })
      .flatten()
      .compact()
      .value()
      .join(', ');
  }

  buildBlock(block, params) {
    const blockFn = this.blocks.get(block);

    if (!blockFn) {
      throw new Error(`Unknown block "${block}"`);
    }

    return blockFn(params);
  }

  buildTemplate(type, params) {
    const template = this.templates.get(type);
    if (!template) {
      throw new Error(`Unknown template type "${type}"`);
    }
    params = Object.assign({}, template.defaults, params);

    if (template.validate) {
      template.validate(type, params);
    }

    return template.pattern
      .replace(blockRegExp, (fullMatch, block, space) => {
        if (params[block] === undefined) {
          return '';
        }
        if (this.blocks.has(`${type}:${block}`)) {
          block = `${type}:${block}`;
        }
        return this.buildBlock(block, params) + space;
      })
      .trim();
  }
};
