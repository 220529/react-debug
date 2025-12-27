'use strict';

function checkDCE() {
  /* global __REACT_DEVTOOLS_GLOBAL_HOOK__ */
  if (
    typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ === 'undefined' ||
    typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE !== 'function'
  ) {
    return;
  }
  if (process.env.NODE_ENV !== 'production') {
    throw new Error('^_^');
  }
  try {
    __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(checkDCE);
  } catch (err) {
    console.error(err);
  }
}

if (process.env.NODE_ENV === 'production') {
  checkDCE();
  module.exports = require('./cjs/react-dom.production.js');
} else {
  module.exports = require('./cjs/react-dom.development.js');
}
