# Scheduler 调度器

## 核心概念

Scheduler 是 React 的任务调度器，负责：
1. 任务优先级管理
2. 时间切片（Time Slicing）
3. 任务中断与恢复

## 优先级定义

```javascript
// SchedulerPriorities.js
export const NoPriority = 0;
export const ImmediatePriority = 1;    // 立即执行，同步
export const UserBlockingPriority = 2; // 用户交互，250ms
export const NormalPriority = 3;       // 普通，5000ms
export const LowPriority = 4;          // 低优先级，10000ms
export const IdlePriority = 5;         // 空闲时执行
```

### 超时时间

```javascript
// 不同优先级的超时时间
ImmediatePriority  → timeout = -1        // 立即过期
UserBlockingPriority → timeout = 250ms
NormalPriority     → timeout = 5000ms
LowPriority        → timeout = 10000ms
IdlePriority       → timeout = maxSigned31BitInt  // 永不过期
```

## 数据结构

### Task（任务）

```javascript
type Task = {
  id: number,              // 任务 ID
  callback: Callback,      // 任务回调
  priorityLevel: PriorityLevel,
  startTime: number,       // 开始时间
  expirationTime: number,  // 过期时间 = startTime + timeout
  sortIndex: number,       // 排序索引
};
```

### 两个队列

```javascript
var taskQueue: Array<Task> = [];   // 就绪队列（按 expirationTime 排序）
var timerQueue: Array<Task> = [];  // 延迟队列（按 startTime 排序）
```

## 最小堆

任务队列使用最小堆实现，保证 O(1) 获取最高优先级任务：

```javascript
// SchedulerMinHeap.js
export function push(heap, node) {
  heap.push(node);
  siftUp(heap, node, heap.length - 1);  // 上浮
}

export function peek(heap) {
  return heap.length === 0 ? null : heap[0];  // O(1) 获取最小值
}

export function pop(heap) {
  const first = heap[0];
  const last = heap.pop();
  if (last !== first) {
    heap[0] = last;
    siftDown(heap, last, 0);  // 下沉
  }
  return first;
}

// 比较函数：先比较 sortIndex，再比较 id
function compare(a, b) {
  const diff = a.sortIndex - b.sortIndex;
  return diff !== 0 ? diff : a.id - b.id;
}
```

## 核心流程

### scheduleCallback（调度任务）

```javascript
function unstable_scheduleCallback(priorityLevel, callback, options) {
  var currentTime = getCurrentTime();
  var startTime = currentTime;
  
  // 计算过期时间
  var timeout;
  switch (priorityLevel) {
    case ImmediatePriority: timeout = -1; break;
    case UserBlockingPriority: timeout = 250; break;
    case NormalPriority: timeout = 5000; break;
    // ...
  }
  var expirationTime = startTime + timeout;
  
  // 创建任务
  var newTask = {
    id: taskIdCounter++,
    callback,
    priorityLevel,
    startTime,
    expirationTime,
    sortIndex: -1,
  };
  
  if (startTime > currentTime) {
    // 延迟任务，加入 timerQueue
    newTask.sortIndex = startTime;
    push(timerQueue, newTask);
  } else {
    // 就绪任务，加入 taskQueue
    newTask.sortIndex = expirationTime;
    push(taskQueue, newTask);
    requestHostCallback();  // 请求调度
  }
  
  return newTask;
}
```

### workLoop（工作循环）

```javascript
function workLoop(initialTime) {
  let currentTime = initialTime;
  advanceTimers(currentTime);  // 检查延迟任务是否到期
  currentTask = peek(taskQueue);
  
  while (currentTask !== null) {
    if (currentTask.expirationTime > currentTime && shouldYieldToHost()) {
      // 任务未过期，但时间片用完，中断
      break;
    }
    
    const callback = currentTask.callback;
    if (typeof callback === 'function') {
      currentTask.callback = null;
      const didUserCallbackTimeout = currentTask.expirationTime <= currentTime;
      
      // 执行任务
      const continuationCallback = callback(didUserCallbackTimeout);
      
      if (typeof continuationCallback === 'function') {
        // 任务未完成，保留继续执行
        currentTask.callback = continuationCallback;
        return true;  // 还有工作
      } else {
        // 任务完成，移除
        if (currentTask === peek(taskQueue)) {
          pop(taskQueue);
        }
      }
    } else {
      pop(taskQueue);
    }
    
    currentTask = peek(taskQueue);
  }
  
  return currentTask !== null;  // 是否还有工作
}
```

### shouldYieldToHost（是否让出主线程）

```javascript
let frameInterval = 5;  // 默认 5ms 一个时间片
let startTime = -1;

function shouldYieldToHost() {
  const timeElapsed = getCurrentTime() - startTime;
  if (timeElapsed < frameInterval) {
    return false;  // 时间片未用完
  }
  return true;  // 让出主线程
}
```

## 调度触发机制

### MessageChannel

```javascript
// 使用 MessageChannel 实现宏任务调度
const channel = new MessageChannel();
const port = channel.port2;
channel.port1.onmessage = performWorkUntilDeadline;

schedulePerformWorkUntilDeadline = () => {
  port.postMessage(null);
};
```

为什么用 MessageChannel 而不是 setTimeout？
- setTimeout 有最小 4ms 延迟
- MessageChannel 可以更快触发

### performWorkUntilDeadline

```javascript
const performWorkUntilDeadline = () => {
  if (isMessageLoopRunning) {
    const currentTime = getCurrentTime();
    startTime = currentTime;
    
    let hasMoreWork = true;
    try {
      hasMoreWork = flushWork(currentTime);
    } finally {
      if (hasMoreWork) {
        // 还有工作，继续调度
        schedulePerformWorkUntilDeadline();
      } else {
        isMessageLoopRunning = false;
      }
    }
  }
};
```

## 与 React 的关系

```
React 更新 → scheduleUpdateOnFiber → ensureRootIsScheduled
                                            ↓
                                    Scheduler.scheduleCallback
                                            ↓
                                    performConcurrentWorkOnRoot
                                            ↓
                                    workLoopConcurrent（可中断）
```

## 调试技巧

```javascript
// 在以下位置打断点：
// 1. unstable_scheduleCallback - 观察任务创建
// 2. workLoop - 观察任务执行
// 3. shouldYieldToHost - 观察时间切片
// 4. performWorkUntilDeadline - 观察调度循环
```
