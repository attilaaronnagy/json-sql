module.exports = dialect => {
  dialect.modifiers.add('$set', (field, value) => {
    return [field, '=', value].join(' ');
  });

  dialect.modifiers.add('$inc', (field, value) => {
    return [field, '=', field, '+', value].join(' ');
  });

  dialect.modifiers.add('$dec', (field, value) => {
    return [field, '=', field, '-', value].join(' ');
  });

  dialect.modifiers.add('$mul', (field, value) => {
    return [field, '=', field, '*', value].join(' ');
  });

  dialect.modifiers.add('$div', (field, value) => {
    return [field, '=', field, '/', value].join(' ');
  });

  dialect.modifiers.add('$default', field => {
    return [field, '=', 'default'].join(' ');
  });
};
