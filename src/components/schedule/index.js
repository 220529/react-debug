import React, { useState, useEffect } from "react";
import { unstable_scheduleCallback, unstable_LowPriority, unstable_NormalPriority, unstable_ImmediatePriority } from "scheduler";

const SchedulerDemo = () => {
  const [tasks, setTasks] = useState([]);

  // 模拟一个低优先级任务
  const scheduleLowPriorityTask = () => {
    unstable_scheduleCallback(unstable_LowPriority, () => {
      setTasks((prevTasks) => [...prevTasks, "Low Priority Task"]);
    });
  };

  // 模拟一个正常优先级任务
  const scheduleNormalPriorityTask = () => {
    unstable_scheduleCallback(unstable_NormalPriority, () => {
      setTasks((prevTasks) => [...prevTasks, "Normal Priority Task"]);
    });
  };

  // 模拟一个立即执行的高优先级任务
  const scheduleImmediatePriorityTask = () => {
    unstable_scheduleCallback(unstable_ImmediatePriority, () => {
      setTasks((prevTasks) => [...prevTasks, "Immediate Priority Task"]);
    });
  };

  // 在组件挂载时安排多个任务
  useEffect(() => {
    scheduleLowPriorityTask();
    scheduleNormalPriorityTask();
    scheduleImmediatePriorityTask();
  }, []);

  return (
    <div>
      <span>React Scheduler Demo</span>
      <button onClick={scheduleLowPriorityTask}>Add Low Priority Task</button>
      <button onClick={scheduleNormalPriorityTask}>Add Normal Priority Task</button>
      <button onClick={scheduleImmediatePriorityTask}>Add Immediate Priority Task</button>
      <ul>
        {tasks.map((task, index) => (
          <li key={index}>{task}</li>
        ))}
      </ul>
    </div>
  );
};

export default SchedulerDemo;
