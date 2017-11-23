const jsonSql = require('../lib')();

const result = jsonSql.build({
  table: 'users',
  condition: {
    $or: [{ name$: 'John' }, { age$: 12 }]
  }
});

console.log(result.query);
console.log(result.values);
