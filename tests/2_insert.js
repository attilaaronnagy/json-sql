var jsonSql = require('../lib')();
var expect = require('chai').expect;

describe('Insert', () => {
  it('should throw error without `values` property', () => {
    expect(() => {
      jsonSql.build({
        type: 'insert',
        table: 'users'
      });
    }).to.throw('`values` property is not set in `insert` clause');
  });

  it('should be ok with `values` property', () => {
    var date = new Date();
    var result = jsonSql.build({
      type: 'insert',
      table: 'users',
      values: {
        id: 1,
        name: 'Max',
        date: date
      }
    });

    expect(result.query).to.be.equal('insert into "users" ("id", "name", "date") values (1, $p1, $p2);');
    expect(result.values).to.be.eql({ p1: 'Max', p2: date });
  });

  it('should be ok with `with` property', () => {
    var date = new Date();
    var result = jsonSql.build({
      with: [
        {
          name: 't_1',
          select: {
            table: 't_1'
          }
        }
      ],
      type: 'insert',
      table: 'users',
      values: {
        name: 'Max',
        age: 17,
        lastvisit: null,
        active: true,
        date: date
      }
    });

    expect(result.query).to.be.equal(
      'with "t_1" as (select * from "t_1") insert into "users" ' + '("name", "age", "lastvisit", "active", "date") values ($p1, 17, null, true, $p2);'
    );
    expect(result.values).to.be.eql({ p1: 'Max', p2: date });
  });

  it('should be ok with `returning` property', () => {
    var date = new Date();
    var result = jsonSql.build({
      type: 'insert',
      table: 'users',
      values: {
        name: 'Max',
        age: 17,
        lastvisit: null,
        active: true,
        date: date
      },
      returning: ['users.*']
    });

    expect(result.query).to.be.equal(
      'insert into "users" ("name", "age", "lastvisit", "active", "date") ' + 'values ($p1, 17, null, true, $p2) returning "users".*;'
    );
    expect(result.values).to.be.eql({ p1: 'Max', p2: date });
  });
});
