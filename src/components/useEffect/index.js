import React, { useState, useRef, useEffect } from 'react';

const App = () => {
  const ref = useRef(null);
  const [value, setValue] = useState(0)

  // useEffect(() => {
  //   setInterval(() => { console.log(value) }, 1000)
  //   // 答案：一直是 0 ，因为遇到了 Hooks “闭包陷阱”
  // }, [])

  useEffect(() => {
    ref.current = value
  }, [value])

  useEffect(() => {
    setInterval(() => { console.log(ref.current) }, 1000)
  }, [])

  function clickHandler() { setValue(value + 1) }

  return <div>
    value: {value} <button onClick={clickHandler}>increase</button>
  </div>
};

export default App;