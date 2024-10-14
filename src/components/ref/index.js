import { useState, useEffect, createRef } from "react";

const Count = () => {
  const ref = createRef();
  const [count, setCount] = useState(0);
  const handleIncrement = () => {
    console.log("handleIncrement", ref.current);
    setCount((e) => {
      console.log("setCount", e);
      const t = e + 1;
      ref.current = t;
      return t;
    });
  };

  useEffect(() => {
    ref.current = count;
  }, [count]);

  return <button onClick={handleIncrement}>ref: {ref.current}</button>;
};

export default Count;
