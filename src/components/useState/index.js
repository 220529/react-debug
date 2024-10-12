import React, { useState, useRef, useEffect } from 'react';

const App = () => {
  const [value, setValue] = useState(100);
  function clickHandler() {
    setTimeout(() => {
      setValue(value + 1);
      setValue(value + 1);
      console.log(1, value);
      setValue(value + 1);
      setValue(value + 1);
      console.log(2, value);
    });
  }
  const handler = () => {
    setValue(value + 1);
    console.log("value: ", value);
    setTimeout(() => {
      console.log("setTimeout.value: ", value);
    }, 1000)
  }
  return (
    <div>
      <span>{value}</span>
      <button onClick={handler}>increase</button>
      {/* <button onClick={clickHandler}>increase</button> */}
    </div>
  );
};

export default App;
