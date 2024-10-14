import { useState, useEffect } from "react";

const Count = () => {
  const [count, setCount] = useState(0);
  const handleIncrement = () => {
    setCount((e) => {
      // console.log("setCount...", e);
      return e + 1;
    });
  };

  useEffect(() => {
    console.log("effect...start", count);
    return () => {
      console.log("effect...end", count);
    };
  }, [count]);

  // setCount((e) => e + 1);

  return <button onClick={handleIncrement}>{count}</button>;
};

export default Count;
