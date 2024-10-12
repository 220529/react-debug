/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/* eslint-disable no-var */

import {
  enableSchedulerDebugging,
  enableProfiling,
  enableIsInputPending,
  enableIsInputPendingContinuous,
  frameYieldMs,
  continuousYieldMs,
  maxYieldMs,
} from '../SchedulerFeatureFlags';

import { push, pop, peek } from '../SchedulerMinHeap';

// TODO: Use symbols?
// 优先级级别和超时，超时值确定任务在队列中等待执行的时间。具有较高优先级级别的任务具有较短的超时时间
import {
  ImmediatePriority,
  UserBlockingPriority,
  NormalPriority,
  LowPriority,
  IdlePriority,
} from '../SchedulerPriorities';
import {
  markTaskRun,
  markTaskYield,
  markTaskCompleted,
  markTaskCanceled,
  markTaskErrored,
  markSchedulerSuspended,
  markSchedulerUnsuspended,
  markTaskStart,
  stopLoggingProfilingEvents,
  startLoggingProfilingEvents,
} from '../SchedulerProfiling';

let getCurrentTime;
const hasPerformanceNow =
  typeof performance === 'object' && typeof performance.now === 'function';

if (hasPerformanceNow) {
  const localPerformance = performance;
  getCurrentTime = () => localPerformance.now();
} else {
  const localDate = Date;
  const initialTime = localDate.now();
  getCurrentTime = () => localDate.now() - initialTime;
}

// Max 31 bit integer. The max integer size in V8 for 32-bit systems.
// Math.pow(2, 30) - 1
// 0b111111111111111111111111111111
var maxSigned31BitInt = 1073741823;

// Times out immediately
var IMMEDIATE_PRIORITY_TIMEOUT = -1;
// Eventually times out
var USER_BLOCKING_PRIORITY_TIMEOUT = 250;
var NORMAL_PRIORITY_TIMEOUT = 5000;
var LOW_PRIORITY_TIMEOUT = 10000;
// Never times out
var IDLE_PRIORITY_TIMEOUT = maxSigned31BitInt;

// Tasks are stored on a min heap
var taskQueue = [];
var timerQueue = [];

// Incrementing id counter. Used to maintain insertion order.
var taskIdCounter = 1;

// Pausing the scheduler is useful for debugging.
var isSchedulerPaused = false;

var currentTask = null;
var currentPriorityLevel = NormalPriority;

// This is set while performing work, to prevent re-entrance.
var isPerformingWork = false;

var isHostCallbackScheduled = false;
var isHostTimeoutScheduled = false;

// Capture local references to native APIs, in case a polyfill overrides them.
const localSetTimeout = typeof setTimeout === 'function' ? setTimeout : null;
const localClearTimeout =
  typeof clearTimeout === 'function' ? clearTimeout : null;
const localSetImmediate =
  typeof setImmediate !== 'undefined' ? setImmediate : null; // IE and Node.js + jsdom

const isInputPending =
  typeof navigator !== 'undefined' &&
    navigator.scheduling !== undefined &&
    navigator.scheduling.isInputPending !== undefined
    ? navigator.scheduling.isInputPending.bind(navigator.scheduling)
    : null;

const continuousOptions = { includeContinuous: enableIsInputPendingContinuous };

function advanceTimers(currentTime) {
  // Check for tasks that are no longer delayed and add them to the queue.
  let timer = peek(timerQueue);
  while (timer !== null) {
    if (timer.callback === null) {
      // Timer was cancelled.
      pop(timerQueue);
    } else if (timer.startTime <= currentTime) {
      // Timer fired. Transfer to the task queue.
      pop(timerQueue);
      timer.sortIndex = timer.expirationTime;
      push(taskQueue, timer);
      if (enableProfiling) {
        markTaskStart(timer, currentTime);
        timer.isQueued = true;
      }
    } else {
      // Remaining timers are pending.
      return;
    }
    timer = peek(timerQueue);
  }
}

function handleTimeout(currentTime) {
  isHostTimeoutScheduled = false;
  advanceTimers(currentTime);

  if (!isHostCallbackScheduled) {
    if (peek(taskQueue) !== null) {
      isHostCallbackScheduled = true;
      requestHostCallback(flushWork);
    } else {
      const firstTimer = peek(timerQueue);
      if (firstTimer !== null) {
        requestHostTimeout(handleTimeout, firstTimer.startTime - currentTime);
      }
    }
  }
}

function flushWork(hasTimeRemaining, initialTime) {
  // 如果启用了性能分析
  if (enableProfiling) {
    // 记录调度器未被挂起的时间
    markSchedulerUnsuspended(initialTime);
  }

  // 我们需要在下一次工作被调度时一个主机回调
  isHostCallbackScheduled = false;
  if (isHostTimeoutScheduled) {
    // 如果之前调度了一个超时但现在不再需要，取消它
    isHostTimeoutScheduled = false;
    cancelHostTimeout();
  }

  // 标记开始执行工作
  isPerformingWork = true;
  // 保存当前的优先级级别
  const previousPriorityLevel = currentPriorityLevel;

  try {
    if (enableProfiling) {
      try {
        // 执行工作循环
        return workLoop(hasTimeRemaining, initialTime);
      } catch (error) {
        // 如果工作循环抛出错误
        if (currentTask !== null) {
          const currentTime = getCurrentTime();
          // 记录任务出错的时间
          markTaskErrored(currentTask, currentTime);
          currentTask.isQueued = false; // 标记任务未排队
        }
        // 重新抛出错误
        throw error;
      }
    } else {
      // 在生产环境中没有错误捕获
      return workLoop(hasTimeRemaining, initialTime);
    }
  } finally {
    // 清理状态
    currentTask = null; // 重置当前任务
    currentPriorityLevel = previousPriorityLevel; // 恢复之前的优先级级别
    isPerformingWork = false; // 标记工作执行完毕

    if (enableProfiling) {
      const currentTime = getCurrentTime();
      // 记录调度器被挂起的时间
      markSchedulerSuspended(currentTime);
    }
  }
}

function workLoop(hasTimeRemaining, initialTime) {
  // 初始化当前时间为传入的时间
  let currentTime = initialTime;

  // 更新定时器（处理那些到期的定时器任务）
  advanceTimers(currentTime);

  // 获取任务队列中的第一个任务
  currentTask = peek(taskQueue);

  // 进入任务循环，循环条件：
  // - 任务队列中存在任务
  // - 调试模式下，调度器未被暂停
  while (
    currentTask !== null &&
    !(enableSchedulerDebugging && isSchedulerPaused)
  ) {
    // 判断当前任务是否超过了它的到期时间，并且是否应该放弃继续执行
    if (
      currentTask.expirationTime > currentTime &&
      (!hasTimeRemaining || shouldYieldToHost())
    ) {
      // 当前任务还没到期，并且时间不够或应该让出执行权，退出循环
      break;
    }

    // 获取当前任务的回调函数
    const callback = currentTask.callback;

    // 如果当前任务存在回调函数
    if (typeof callback === 'function') {
      // 将当前任务的回调函数清空，避免重复执行
      currentTask.callback = null;

      // 记录当前的优先级
      currentPriorityLevel = currentTask.priorityLevel;

      // 检查任务是否超时（到期时间是否小于等于当前时间）
      const didUserCallbackTimeout = currentTask.expirationTime <= currentTime;

      // 如果启用了性能分析，标记任务开始执行
      if (enableProfiling) {
        markTaskRun(currentTask, currentTime);
      }

      // 执行当前任务的回调函数，传入是否超时的标志
      const continuationCallback = callback(didUserCallbackTimeout);

      // 更新当前时间
      currentTime = getCurrentTime();

      // 如果回调返回的是一个函数，表示任务未完全结束，需要继续执行
      if (typeof continuationCallback === 'function') {
        // 将任务的回调更新为继续回调
        currentTask.callback = continuationCallback;

        // 如果启用了性能分析，标记任务被挂起
        if (enableProfiling) {
          markTaskYield(currentTask, currentTime);
        }
      } else {
        // 否则，任务已完成，执行相应的清理操作
        if (enableProfiling) {
          markTaskCompleted(currentTask, currentTime);
          currentTask.isQueued = false;
        }

        // 如果当前任务仍然是队列中的第一个任务，则将其移出队列
        if (currentTask === peek(taskQueue)) {
          pop(taskQueue);
        }
      }

      // 再次更新定时器
      advanceTimers(currentTime);
    } else {
      // 如果当前任务没有回调函数，直接将其移出任务队列
      pop(taskQueue);
    }

    // 获取队列中的下一个任务
    currentTask = peek(taskQueue);
  }

  // 判断是否还有更多的任务需要执行
  if (currentTask !== null) {
    // 如果有更多任务，返回 true
    return true;
  } else {
    // 如果没有更多任务，检查定时器队列中是否有任务
    const firstTimer = peek(timerQueue);

    // 如果有定时器任务，设置超时请求
    if (firstTimer !== null) {
      requestHostTimeout(handleTimeout, firstTimer.startTime - currentTime);
    }

    // 返回 false，表示没有更多任务需要处理
    return false;
  }
}

function unstable_runWithPriority(priorityLevel, eventHandler) {
  switch (priorityLevel) {
    case ImmediatePriority:
    case UserBlockingPriority:
    case NormalPriority:
    case LowPriority:
    case IdlePriority:
      break;
    default:
      priorityLevel = NormalPriority;
  }

  var previousPriorityLevel = currentPriorityLevel;
  currentPriorityLevel = priorityLevel;

  try {
    return eventHandler();
  } finally {
    currentPriorityLevel = previousPriorityLevel;
  }
}

function unstable_next(eventHandler) {
  var priorityLevel;
  switch (currentPriorityLevel) {
    case ImmediatePriority:
    case UserBlockingPriority:
    case NormalPriority:
      // Shift down to normal priority
      priorityLevel = NormalPriority;
      break;
    default:
      // Anything lower than normal priority should remain at the current level.
      priorityLevel = currentPriorityLevel;
      break;
  }

  var previousPriorityLevel = currentPriorityLevel;
  currentPriorityLevel = priorityLevel;

  try {
    return eventHandler();
  } finally {
    currentPriorityLevel = previousPriorityLevel;
  }
}

function unstable_wrapCallback(callback) {
  var parentPriorityLevel = currentPriorityLevel;
  return function () {
    // This is a fork of runWithPriority, inlined for performance.
    var previousPriorityLevel = currentPriorityLevel;
    currentPriorityLevel = parentPriorityLevel;

    try {
      return callback.apply(this, arguments);
    } finally {
      currentPriorityLevel = previousPriorityLevel;
    }
  };
}

function unstable_scheduleCallback(priorityLevel, callback, options) {
  // 获取当前时间
  var currentTime = getCurrentTime();

  var startTime;
  if (typeof options === 'object' && options !== null) {
    // 从 options 中提取延迟时间
    var delay = options.delay;
    if (typeof delay === 'number' && delay > 0) {
      // 如果延迟时间是正数，则设置任务的开始时间为当前时间加上延迟时间
      startTime = currentTime + delay;
    } else {
      // 否则，任务的开始时间为当前时间
      startTime = currentTime;
    }
  } else {
    // 如果 options 不是对象或为 null，任务的开始时间为当前时间
    startTime = currentTime;
  }

  var timeout;
  // 根据优先级选择任务超时时间
  switch (priorityLevel) {
    case ImmediatePriority:
      timeout = IMMEDIATE_PRIORITY_TIMEOUT;
      break;
    case UserBlockingPriority:
      timeout = USER_BLOCKING_PRIORITY_TIMEOUT;
      break;
    case IdlePriority:
      timeout = IDLE_PRIORITY_TIMEOUT;
      break;
    case LowPriority:
      timeout = LOW_PRIORITY_TIMEOUT;
      break;
    case NormalPriority:
    default:
      timeout = NORMAL_PRIORITY_TIMEOUT;
      break;
  }

  // 计算任务的过期时间
  var expirationTime = startTime + timeout;

  // 创建新的任务对象
  var newTask = {
    id: taskIdCounter++, // 任务的唯一标识符
    callback, // 任务执行的回调函数
    priorityLevel, // 任务的优先级
    startTime, // 任务的开始时间
    expirationTime, // 任务的过期时间
    sortIndex: -1, // 用于排序的索引
  };

  if (enableProfiling) {
    newTask.isQueued = false; // 如果启用了性能分析器，将任务标记为未排队
  }

  if (startTime > currentTime) {
    // 如果任务是延迟任务
    newTask.sortIndex = startTime; // 设置排序索引为开始时间
    push(timerQueue, newTask); // 将任务推入定时队列

    if (peek(taskQueue) === null && newTask === peek(timerQueue)) {
      // 如果任务队列为空，且这是定时队列中最早的任务
      if (isHostTimeoutScheduled) {
        // 如果已经安排了超时，取消现有的超时
        cancelHostTimeout();
      } else {
        isHostTimeoutScheduled = true;
      }
      // 安排超时
      requestHostTimeout(handleTimeout, startTime - currentTime);
    }
  } else {
    // 如果任务不是延迟任务
    newTask.sortIndex = expirationTime; // 设置排序索引为过期时间
    push(taskQueue, newTask); // 将任务推入任务队列

    if (enableProfiling) {
      markTaskStart(newTask, currentTime); // 如果启用了性能分析器，标记任务开始时间
      newTask.isQueued = true; // 标记任务为已排队
    }

    // 如果需要，安排主机回调
    if (!isHostCallbackScheduled && !isPerformingWork) {
      isHostCallbackScheduled = true;
      requestHostCallback(flushWork);
    }
  }

  // 返回新创建的任务
  return newTask;
}

function unstable_pauseExecution() {
  isSchedulerPaused = true;
}

function unstable_continueExecution() {
  isSchedulerPaused = false;
  if (!isHostCallbackScheduled && !isPerformingWork) {
    isHostCallbackScheduled = true;
    requestHostCallback(flushWork);
  }
}

function unstable_getFirstCallbackNode() {
  return peek(taskQueue);
}

function unstable_cancelCallback(task) {
  if (enableProfiling) {
    if (task.isQueued) {
      const currentTime = getCurrentTime();
      markTaskCanceled(task, currentTime);
      task.isQueued = false;
    }
  }

  // Null out the callback to indicate the task has been canceled. (Can't
  // remove from the queue because you can't remove arbitrary nodes from an
  // array based heap, only the first one.)
  task.callback = null;
}

function unstable_getCurrentPriorityLevel() {
  return currentPriorityLevel;
}

let isMessageLoopRunning = false;
let scheduledHostCallback = null;
let taskTimeoutID = -1;

// Scheduler periodically yields in case there is other work on the main
// thread, like user events. By default, it yields multiple times per frame.
// It does not attempt to align with frame boundaries, since most tasks don't
// need to be frame aligned; for those that do, use requestAnimationFrame.
let frameInterval = frameYieldMs; // 处理帧间隔的时间
const continuousInputInterval = continuousYieldMs; // 处理连续输入的时间
const maxInterval = maxYieldMs; // 处理最大时间间隔
let startTime = -1; // 记录开始时间的变量

let needsPaint = false; // 是否需要绘制标志

function shouldYieldToHost() {
  // 计算自上次调用以来经过的时间
  const timeElapsed = getCurrentTime() - startTime;

  if (timeElapsed < frameInterval) {
    // 主线程被阻塞的时间非常短，少于一帧的时间。还不需要让出控制权。
    return false;
  }

  // 主线程被阻塞了一段较长的时间，我们可能需要让出控制权，以便浏览器可以执行高优先级任务。
  // 高优先级任务主要包括绘制和用户输入。如果有待处理的绘制或输入，我们应该让出控制权。
  // 如果没有这些任务，我们可以在保持响应性的同时减少让出控制权的频率。
  // 我们最终会让出控制权，因为可能有未被处理的绘制任务或其他主线程任务（如网络事件）。
  if (enableIsInputPending) {
    if (needsPaint) {
      // 有待处理的绘制任务（通过 `requestPaint` 信号）。立即让出控制权。
      return true;
    }
    if (timeElapsed < continuousInputInterval) {
      // 主线程被阻塞的时间不长。仅在有待处理的离散输入（例如点击）时才让出控制权。
      // 对于待处理的连续输入（例如鼠标悬停），可以不立即让出控制权。
      if (isInputPending !== null) {
        return isInputPending();
      }
    } else if (timeElapsed < maxInterval) {
      // 主线程被阻塞的时间较长。如果有待处理的离散输入或连续输入，则立即让出控制权。
      if (isInputPending !== null) {
        return isInputPending(continuousOptions);
      }
    } else {
      // 主线程被阻塞了很长时间。即使没有待处理的输入，也可能存在其他计划中的工作（如网络事件）。
      // 立即让出控制权。
      return true;
    }
  }

  // `isInputPending` 函数不可用。立即让出控制权。
  return true;
}

function requestPaint() {
  if (
    enableIsInputPending &&
    navigator !== undefined &&
    navigator.scheduling !== undefined &&
    navigator.scheduling.isInputPending !== undefined
  ) {
    needsPaint = true;
  }

  // Since we yield every frame regardless, `requestPaint` has no effect.
}

function forceFrameRate(fps) {
  if (fps < 0 || fps > 125) {
    // Using console['error'] to evade Babel and ESLint
    console['error'](
      'forceFrameRate takes a positive int between 0 and 125, ' +
      'forcing frame rates higher than 125 fps is not supported',
    );
    return;
  }
  if (fps > 0) {
    frameInterval = Math.floor(1000 / fps);
  } else {
    // reset the framerate
    frameInterval = frameYieldMs;
  }
}

// 执行调度的任务直到时间截止
const performWorkUntilDeadline = () => {
  // console.log("performWorkUntilDeadline");
  // 如果存在已调度的任务回调，则开始执行
  if (scheduledHostCallback !== null) {
    // 获取当前时间
    const currentTime = getCurrentTime();
    // 记录任务开始执行的时间
    startTime = currentTime;
    // 假设当前有足够的时间来执行任务
    const hasTimeRemaining = true;

    // 定义一个标志，判断是否还有更多工作需要执行
    let hasMoreWork = true;

    // 尝试执行调度的任务回调
    try {
      // 执行回调函数并判断是否还有剩余任务需要执行
      hasMoreWork = scheduledHostCallback(hasTimeRemaining, currentTime);
    } finally {
      // 如果还有剩余工作需要执行
      if (hasMoreWork) {
        // 调度下一次任务执行
        schedulePerformWorkUntilDeadline();
      } else {
        // 如果没有剩余任务需要执行，停止消息循环并清空调度回调
        isMessageLoopRunning = false;
        scheduledHostCallback = null;
      }
    }
  } else {
    // 如果没有调度的任务回调，停止消息循环
    isMessageLoopRunning = false;
  }

  // 重置 needsPaint 标志，表示浏览器不需要立即执行绘制操作
  needsPaint = false;
};

let schedulePerformWorkUntilDeadline;
if (typeof localSetImmediate === 'function') {
  // Node.js and old IE.
  // There's a few reasons for why we prefer setImmediate.
  //
  // Unlike MessageChannel, it doesn't prevent a Node.js process from exiting.
  // (Even though this is a DOM fork of the Scheduler, you could get here
  // with a mix of Node.js 15+, which has a MessageChannel, and jsdom.)
  // https://github.com/facebook/react/issues/20756
  //
  // But also, it runs earlier which is the semantic we want.
  // If other browsers ever implement it, it's better to use it.
  // Although both of these would be inferior to native scheduling.
  schedulePerformWorkUntilDeadline = () => {
    localSetImmediate(performWorkUntilDeadline);
  };
} else if (typeof MessageChannel !== 'undefined') {
  // DOM and Worker environments.
  // We prefer MessageChannel because of the 4ms setTimeout clamping.
  const channel = new MessageChannel();
  const port = channel.port2;
  channel.port1.onmessage = performWorkUntilDeadline;
  schedulePerformWorkUntilDeadline = () => {
    console.log("port.postMessage...");
    port.postMessage(null);
  };
} else {
  // We should only fallback here in non-browser environments.
  schedulePerformWorkUntilDeadline = () => {
    localSetTimeout(performWorkUntilDeadline, 0);
  };
}

function requestHostCallback(callback) {
  // console.log("requestHostCallback", callback);

  // 把传入的回调函数存储到全局变量 `scheduledHostCallback` 中
  scheduledHostCallback = callback;

  // 如果消息循环还没有运行
  if (!isMessageLoopRunning) {
    // 设置 `isMessageLoopRunning` 为 `true`，表示消息循环正在运行
    isMessageLoopRunning = true;

    // 调度任务的执行，使用之前定义的 `schedulePerformWorkUntilDeadline`
    // 该函数会根据不同的环境选择最优的方式来执行任务
    schedulePerformWorkUntilDeadline();
  }
}

function requestHostTimeout(callback, ms) {
  taskTimeoutID = localSetTimeout(() => {
    callback(getCurrentTime());
  }, ms);
}

function cancelHostTimeout() {
  localClearTimeout(taskTimeoutID);
  taskTimeoutID = -1;
}

const unstable_requestPaint = requestPaint;

export {
  ImmediatePriority as unstable_ImmediatePriority,
  UserBlockingPriority as unstable_UserBlockingPriority,
  NormalPriority as unstable_NormalPriority,
  IdlePriority as unstable_IdlePriority,
  LowPriority as unstable_LowPriority,
  unstable_runWithPriority,
  unstable_next,
  unstable_scheduleCallback,
  unstable_cancelCallback,
  unstable_wrapCallback,
  unstable_getCurrentPriorityLevel,
  shouldYieldToHost as unstable_shouldYield,
  unstable_requestPaint,
  unstable_continueExecution,
  unstable_pauseExecution,
  unstable_getFirstCallbackNode,
  getCurrentTime as unstable_now,
  forceFrameRate as unstable_forceFrameRate,
};

export const unstable_Profiling = enableProfiling
  ? {
    startLoggingProfilingEvents,
    stopLoggingProfilingEvents,
  }
  : null;
