const jsonSql = require('../lib')();
const { Builder } = require('../lib');
const { expect } = require('chai');

describe('Builder', () => {
  it('should have fields', () => {
    expect(jsonSql).to.be.ok;
    expect(jsonSql).to.be.an.instanceof(Builder);

    expect(jsonSql.dialect).to.be.ok;

    expect(jsonSql._query).to.be.equal('');
    expect(jsonSql._values).to.be.eql({});

    expect(jsonSql.dialect.blocks).to.be.ok;
    expect(jsonSql.dialect.templates).to.be.ok;
    expect(jsonSql.dialect.operators).to.be.ok;
    expect(jsonSql.dialect.operators.comparison).to.be.ok;
    expect(jsonSql.dialect.operators.logical).to.be.ok;
    expect(jsonSql.dialect.operators.fetching).to.be.ok;
    expect(jsonSql.dialect.operators.state).to.be.ok;
    expect(jsonSql.dialect.modifiers).to.be.ok;
  });

  it('should throw error with wrong `type` property', () => {
    expect(() => {
      jsonSql.build({
        type: 'wrong'
      });
    }).to.throw('Unknown template type "wrong"');
  });

  it('should throw error without `table`, `query` and `select` properties', () => {
    expect(() => {
      jsonSql.build({});
    }).to.throw('Neither `table`, `query`, `select`, `expression` properties are not set in `select` clause');
  });

  it('should throw error with both `table` and `select` properties', () => {
    expect(() => {
      jsonSql.build({
        table: 'users',
        select: { table: 'payments' }
      });
    }).to.throw('Wrong using `table`, `select` properties together in `select` clause');
  });

  it('should throw error with both `table` and `query` properties', () => {
    expect(() => {
      jsonSql.build({
        table: 'users',
        query: { table: 'payments' }
      });
    }).to.throw('Wrong using `table`, `query` properties together in `select` clause');
  });

  it('should throw error with both `query` and `select` properties', () => {
    expect(() => {
      jsonSql.build({
        query: { table: 'payments' },
        select: { table: 'payments' }
      });
    }).to.throw('Wrong using `query`, `select` properties together in `select` clause');
  });

  it('should throw error without `name` property in `with` clause', () => {
    expect(() => {
      jsonSql.build({
        with: [
          {
            select: {
              table: 'payments'
            }
          }
        ],
        table: 'users'
      });
    }).to.throw('`name` property is not set in `with` clause');
  });

  it('should throw error without `query` and `select` properties in `with` clause', () => {
    expect(() => {
      jsonSql.build({
        with: [
          {
            name: 'payments'
          }
        ],
        table: 'users'
      });
    }).to.throw('Neither `query`, `select`, `expression` properties are not set in `with` clause');
  });

  it('should throw error with both `query` and `select` properties in `with` clause', () => {
    expect(() => {
      jsonSql.build({
        with: [
          {
            name: 'payments',
            query: { table: 'table1' },
            select: { table: 'table2' }
          }
        ],
        table: 'users'
      });
    }).to.throw('Wrong using `query`, `select` properties together in `with` clause');
  });

  it('should be ok with array in `with` clause', () => {
    const result = jsonSql.build({
      with: [
        {
          name: 'payments',
          select: {
            table: 'payments'
          }
        }
      ],
      table: 'users'
    });

    expect(result.query).to.be.equal('with "payments" as (select * from "payments") select * from "users";');
    expect(result.values).to.be.eql({});
  });

  it('should be ok with object in `with` clause', () => {
    const result = jsonSql.build({
      with: {
        payments: {
          select: {
            table: 'payments'
          }
        }
      },
      table: 'users'
    });

    expect(result.query).to.be.equal('with "payments" as (select * from "payments") select * from "users";');
    expect(result.values).to.be.eql({});
  });

  it('should throw error with both `with` and `withRecursive` clauses', () => {
    expect(() => {
      jsonSql.build({
        with: {
          payments: {
            select: {
              table: 'payments'
            }
          }
        },
        withRecursive: {
          phones: {
            select: {
              table: 'phones'
            }
          }
        },
        table: 'users'
      });
    }).to.throw('Wrong using `with`, `withRecursive` properties together in `select` clause');
  });

  it('should be ok with array in `withRecursive` clause', () => {
    const result = jsonSql.build({
      withRecursive: [
        {
          name: 'payments',
          select: {
            table: 'payments'
          }
        }
      ],
      table: 'users'
    });

    expect(result.query).to.be.equal('with recursive "payments" as (select * from "payments") select * from "users";');
    expect(result.values).to.be.eql({});
  });

  it('should be ok with object in `withRecursive` clause', () => {
    const result = jsonSql.build({
      withRecursive: {
        payments: {
          select: {
            table: 'payments'
          }
        }
      },
      table: 'users'
    });

    expect(result.query).to.be.equal('with recursive "payments" as (select * from "payments") select * from "users";');
    expect(result.values).to.be.eql({});
  });

  it('should create array values with option `namedValues` = false', () => {
    jsonSql.configure({
      namedValues: false
    });

    expect(jsonSql._values).to.be.eql([]);

    const result = jsonSql.build({
      table: 'users',
      condition: { name: 'John' }
    });

    expect(result.query).to.be.equal('select * from "users" where "name" = $1;');
    expect(result.values).to.be.eql(['John']);
  });

  it('should use prefix `@` for values with option `valuesPrefix` = @', () => {
    jsonSql.configure({
      valuesPrefix: '@'
    });

    const result = jsonSql.build({
      table: 'users',
      condition: { name: 'John' }
    });

    expect(result.query).to.be.equal('select * from "users" where "name" = @p1;');
    expect(result.values).to.be.eql({ p1: 'John' });
  });

  it('should return prefixed values with method `prefixValues`', () => {
    const result = jsonSql.build({
      table: 'users',
      condition: { name: 'John' }
    });

    expect(result.query).to.be.equal('select * from "users" where "name" = @p1;');
    expect(result.values).to.be.eql({ p1: 'John' });
    expect(result.prefixValues()).to.be.eql({ '@p1': 'John' });
  });

  it('should return array values with method `getValuesArray`', () => {
    const result = jsonSql.build({
      table: 'users',
      condition: { name: 'John' }
    });

    expect(result.query).to.be.equal('select * from "users" where "name" = @p1;');
    expect(result.values).to.be.eql({ p1: 'John' });
    expect(result.getValuesArray()).to.be.eql(['John']);
  });

  it('should return object values with method `getValuesObject`', () => {
    jsonSql.configure({
      valuesPrefix: '$',
      namedValues: false
    });

    expect(jsonSql._values).to.be.eql([]);

    const result = jsonSql.build({
      table: 'users',
      condition: { name: 'John' }
    });

    expect(result.query).to.be.equal('select * from "users" where "name" = $1;');
    expect(result.values).to.be.eql(['John']);
    expect(result.prefixValues()).to.be.eql({ $1: 'John' });
    expect(result.getValuesObject()).to.be.eql({ 1: 'John' });
  });

  it('should throw if `indexedValues = false` and `namedValues = true`', () => {
    expect(() => {
      jsonSql.configure({
        namedValues: true,
        indexedValues: false
      });
    }).to.throw('Option `indexedValues`: false is not allowed together with option `namedValues`: true');
  });

  it('should not use index for values with option `indexedValues` = false', () => {
    jsonSql.configure({
      namedValues: false,
      indexedValues: false
    });

    const result = jsonSql.build({
      table: 'users',
      condition: { name: 'John' }
    });

    expect(result.query).to.be.equal('select * from "users" where "name" = $;');
    expect(result.values).to.be.eql(['John']);
  });

  it('should create query without values with option `separatedValues` = false', () => {
    jsonSql.configure({
      separatedValues: false
    });

    expect(jsonSql._values).to.not.be.ok;
    expect(jsonSql._placeholderId).to.not.be.ok;

    const date = new Date();
    const result = jsonSql.build({
      type: 'insert',
      table: 'users',
      values: {
        name: 'John',
        surname: 'Doe',
        date
      }
    });

    expect(result.query).to.be.equal('insert into "users" ("name", "surname", "date") values ' + "('John', 'Doe', '" + date.toISOString() + "');");
    expect(result.values).to.not.be.ok;
  });

  it('should create query without wrapping identifiers with option `wrappedIdentifiers` = false', () => {
    jsonSql.configure({
      wrappedIdentifiers: false
    });

    const result = jsonSql.build({
      type: 'insert',
      table: 'users',
      values: { name: 'John' }
    });

    expect(result.query).to.be.equal('insert into users (name) values ($p1);');
  });

  it("shouldn't wrap identifiers that already wrapped", () => {
    jsonSql.configure({
      wrappedIdentifiers: true
    });

    const result = jsonSql.build({
      type: 'insert',
      table: '"users"',
      values: {
        '"name"': 'John',
        '"users"."age"': 22
      }
    });

    expect(result.query).to.be.equal('insert into "users" ("name", "users"."age") values ($p1, 22);');
  });

  it("shouldn't split identifiers by dots inside quotes", () => {
    jsonSql.configure({
      wrappedIdentifiers: true
    });

    const result = jsonSql.build({
      type: 'insert',
      table: '"users"',
      values: {
        '"users.age"': 22
      }
    });

    expect(result.query).to.be.equal('insert into "users" ("users.age") values (22);');
  });

  it("shouldn't wrap asterisk identifier parts", () => {
    jsonSql.configure({
      wrappedIdentifiers: true
    });

    const result = jsonSql.build({
      fields: ['users.*'],
      table: '"users"'
    });

    expect(result.query).to.be.equal('select "users".* from "users";');
  });

  it('should split identifiers by dots and wrap each part', () => {
    jsonSql.configure({
      wrappedIdentifiers: true
    });

    const result = jsonSql.build({
      type: 'insert',
      table: '"users"',
      values: {
        name: 'John',
        'users.age': 22
      }
    });

    expect(result.query).to.be.equal('insert into "users" ("name", "users"."age") values ($p1, 22);');
  });
});
