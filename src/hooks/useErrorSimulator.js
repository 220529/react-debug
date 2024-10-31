import { useEffect } from "react";

const useErrorSimulator = ({
  probability = 0.5,
  message = "Simulated error occurred",
}) => {
  useEffect(() => {
    const shouldThrowError = Math.random() < probability; // 根据传入的概率抛出错误
    console.log("Checking if error should be thrown:", shouldThrowError);

    if (shouldThrowError) {
      throw new Error(message); // 模拟错误
    }
  }, [probability]);
};

export default useErrorSimulator;
