import React, { useState, useEffect } from "react";

function ChildComponent({ parentData }) {
  const [childData, setChildData] = useState("Child Initial Data");

  // 模拟 componentDidMount 和 componentDidUpdate
  useEffect(() => {
    console.log("Child: useEffect (componentDidMount & componentDidUpdate)");

    // 模拟 componentWillUnmount
    return () => {
      console.log("Child: useEffect cleanup (componentWillUnmount)");
    };
  }, [parentData]); // 依赖 parentData，parentData 更新时会触发

  console.log("Child: render");

  return (
    <div>
      <p>子组件数据：{parentData}</p>
      <p>子组件内部数据：{childData}</p>
    </div>
  );
}

function ParentComponent() {
  const [parentData, setParentData] = useState("Parent Initial Data");

  // 模拟 componentDidMount 和 componentDidUpdate
  useEffect(() => {
    console.log("Parent: useEffect (componentDidMount & componentDidUpdate)");

    // 模拟 componentWillUnmount
    return () => {
      console.log("Parent: useEffect cleanup (componentWillUnmount)");
    };
  }, [parentData]); // 依赖 parentData，parentData 更新时会触发

  const updateData = () => {
    setParentData("Parent Updated Data");
  };

  console.log("Parent: render");

  return (
    <div>
      <p>父组件数据：{parentData}</p>
      <button onClick={updateData}>更新父组件数据</button>
      <ChildComponent parentData={parentData} />
    </div>
  );
}

export default ParentComponent;
