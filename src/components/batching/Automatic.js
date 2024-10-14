import React, { useState, useEffect } from "react";

const AutomaticBatchingExample = () => {
  const [count, setCount] = useState(0);
  const [text, setText] = useState("");

  // 在 useEffect 中进行多个状态更新
  useEffect(() => {
    console.log("useEffect start");
    setCount((prev) => prev + 1);
    setText("Hello World");
    console.log("useEffect end");
  }, []);

  const handleClick = () => {
    // 在异步回调中进行多个状态更新
    setTimeout(() => {
      console.log("Async update start");
      // setCount((prev) => prev + 1);
      setText("Updated Text");
      console.log("Async update end");
    }, 100);
  };

  console.log("Component rendered");

  return (
    <div>
      <p>Count: {count}</p>
      <p>Text: {text}</p>
      <button onClick={handleClick}>Update</button>
    </div>
  );
};

export default AutomaticBatchingExample;
