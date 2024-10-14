import React from "react";

export default function App() {
  const handleDivClick = (event) => {
    console.log("Div clicked!");
    console.log("Event type:", event.type);
    console.log("Event phase:", event.eventPhase); // 3 表示冒泡阶段
    console.log("Native event:", event.nativeEvent);
    console.log("Is default prevented:", event.defaultPrevented);
  };

  const handleButtonClick = (event) => {
    console.log("Button clicked!");
    console.log("Event type:", event.type);
    console.log("Event phase:", event.eventPhase); // 3 表示冒泡阶段

    // 阻止事件冒泡
    event.stopPropagation();

    // 取消默认行为
    event.preventDefault();

    console.log("Event after stopPropagation:", event.eventPhase);
    console.log("Is default prevented:", event.defaultPrevented);
  };

  return (
    <div
      onClick={handleDivClick}
      style={{ padding: "50px", backgroundColor: "#f0f0f0" }}
    >
      <h1>Click Event Test</h1>
      <button onClick={handleButtonClick} style={{ padding: "10px" }}>
        Click Me
      </button>
    </div>
  );
}
