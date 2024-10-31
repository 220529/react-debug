import React, { useEffect } from "react";
import useErrorSimulator from "@/hooks/useErrorSimulator";

const UserBio = () => {
  useErrorSimulator({});

  // 点击按钮时抛出错误
  const handleError = () => {
    throw new Error("UserBio button error"); // 模拟按钮点击错误
  };

  return (
    <div>
      <p>User biography loaded...</p>
      <button onClick={handleError}>点击我抛出错误</button>
    </div>
  );
};
export default UserBio;
