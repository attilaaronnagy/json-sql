const comparisonOperatorsInit = require('./comparison');
const logicalOperatorsInit = require('./logical');
const fetchingOperatorsInit = require('./fetching');
const stateOperatorsInit = require('./state');

module.exports = dialect => {
  comparisonOperatorsInit(dialect);
  logicalOperatorsInit(dialect);
  fetchingOperatorsInit(dialect);
  stateOperatorsInit(dialect);
};
