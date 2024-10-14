import React, { useState, useEffect } from "react";

const DependencyLoopComponent = () => {
  const [count, setCount] = useState(0);
  const [trigger, setTrigger] = useState(false);

  // useEffect depends on 'trigger', but it changes 'trigger' inside the effect,
  // causing the effect to run again on each render.
  useEffect(() => {
    console.log("useEffect is running");

    // This will cause the 'trigger' state to change and rerun useEffect.
    if (count < 5) {
      setCount(count + 1);
      setTrigger(!trigger); // This change in 'trigger' will cause the effect to run again.
    }
  }, [trigger]); // This dependency on 'trigger' will lead to an infinite loop.

  return (
    <div>
      <h1>Count: {count}</h1>
      <p>
        This component might cause an infinite loop due to improper dependency
        handling in useEffect.
      </p>
    </div>
  );
};

export default DependencyLoopComponent;
