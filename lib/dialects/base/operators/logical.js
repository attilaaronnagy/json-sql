function buildLogicalOperator(operator, values) {
  if (!values.length) return '';

  var result = values.join(' ' + operator + ' ');
  if (values.length > 1) result = '(' + result + ')';

  return result;
}

module.exports = dialect => {
  dialect.operators.logical.add('$and', {
    fn(values) {
      return buildLogicalOperator('and', values);
    }
  });

  dialect.operators.logical.add('$or', {
    fn(values) {
      return buildLogicalOperator('or', values);
    }
  });

  dialect.operators.logical.add('$not', {
    fn(values) {
      return 'not ' + buildLogicalOperator('and', values);
    }
  });

  dialect.operators.logical.add('$nor', {
    fn(values) {
      return 'not ' + buildLogicalOperator('or', values);
    }
  });
};
