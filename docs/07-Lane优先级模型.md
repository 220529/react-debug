# Lane 优先级模型

## 概述

Lane 是 React 的优先级模型，使用 31 位二进制数表示不同优先级。每个位代表一个"车道"，可以批量处理同一车道的更新。

## Lane 定义

```javascript
// ReactFiberLane.js
export const TotalLanes = 31;

export const NoLanes: Lanes = /*                        */ 0b0000000000000000000000000000000;
export const NoLane: Lane = /*                          */ 0b0000000000000000000000000000000;

// 同步优先级（最高）
export const SyncHydrationLane: Lane = /*               */ 0b0000000000000000000000000000001;
export const SyncLane: Lane = /*                        */ 0b0000000000000000000000000000010;

// 连续输入（如拖拽）
export const InputContinuousHydrationLane: Lane = /*    */ 0b0000000000000000000000000000100;
export const InputContinuousLane: Lane = /*             */ 0b0000000000000000000000000001000;

// 默认优先级
export const DefaultHydrationLane: Lane = /*            */ 0b0000000000000000000000000010000;
export const DefaultLane: Lane = /*                     */ 0b0000000000000000000000000100000;

// Transition（15 条车道）
const TransitionLanes: Lanes = /*                       */ 0b0000000001111111111111110000000;
const TransitionLane1: Lane = /*                        */ 0b0000000000000000000000010000000;
// ... TransitionLane2 ~ TransitionLane15

// Retry（4 条车道）
const RetryLanes: Lanes = /*                            */ 0b0000011110000000000000000000000;

// 选择性 Hydration
export const SelectiveHydrationLane: Lane = /*          */ 0b0000100000000000000000000000000;

// 空闲优先级
export const IdleHydrationLane: Lane = /*               */ 0b0001000000000000000000000000000;
export const IdleLane: Lane = /*                        */ 0b0010000000000000000000000000000;

// Offscreen（最低）
export const OffscreenLane: Lane = /*                   */ 0b0100000000000000000000000000000;
export const DeferredLane: Lane = /*                    */ 0b1000000000000000000000000000000;
```

## 优先级从高到低

```
SyncLane           → 同步更新（如 flushSync）
InputContinuousLane → 连续输入（如拖拽、滚动）
DefaultLane        → 默认更新（如 setState）
TransitionLanes    → 过渡更新（如 startTransition）
RetryLanes         → Suspense 重试
IdleLane           → 空闲更新
OffscreenLane      → 离屏渲染
```

## 位运算操作

```javascript
// 合并 Lanes
export function mergeLanes(a: Lanes, b: Lanes): Lanes {
  return a | b;
}

// 移除 Lanes
export function removeLanes(set: Lanes, subset: Lanes): Lanes {
  return set & ~subset;
}

// 检查是否包含
export function includesSomeLane(a: Lanes, b: Lanes): boolean {
  return (a & b) !== NoLanes;
}

// 检查是否是子集
export function isSubsetOfLanes(set: Lanes, subset: Lanes): boolean {
  return (set & subset) === subset;
}

// 获取最高优先级的 Lane
export function getHighestPriorityLane(lanes: Lanes): Lane {
  return lanes & -lanes;  // 获取最低位的 1
}
```

## 与 Scheduler 优先级的映射

```javascript
// ReactEventPriorities.js
export const DiscreteEventPriority: EventPriority = SyncLane;
export const ContinuousEventPriority: EventPriority = InputContinuousLane;
export const DefaultEventPriority: EventPriority = DefaultLane;
export const IdleEventPriority: EventPriority = IdleLane;

// Lane → Scheduler Priority
export function lanesToEventPriority(lanes: Lanes): EventPriority {
  const lane = getHighestPriorityLane(lanes);
  if (lane >= SyncLane && lane <= SyncLane) {
    return DiscreteEventPriority;
  }
  if (lane >= InputContinuousLane && lane <= InputContinuousLane) {
    return ContinuousEventPriority;
  }
  if (lane >= DefaultLane && lane <= TransitionLanes) {
    return DefaultEventPriority;
  }
  return IdleEventPriority;
}
```

## requestUpdateLane（获取更新优先级）

```javascript
export function requestUpdateLane(fiber: Fiber): Lane {
  const mode = fiber.mode;
  
  // Legacy 模式：同步
  if ((mode & ConcurrentMode) === NoMode) {
    return SyncLane;
  }
  
  // 渲染阶段更新
  if ((executionContext & RenderContext) !== NoContext) {
    return pickArbitraryLane(workInProgressRootRenderLanes);
  }
  
  // Transition
  const transition = requestCurrentTransition();
  if (transition !== null) {
    return requestTransitionLane(transition);
  }
  
  // 根据事件类型返回优先级
  return eventPriorityToLane(resolveUpdatePriority());
}
```

## Transition Lane 分配

```javascript
let nextTransitionLane: Lane = TransitionLane1;

export function requestTransitionLane(): Lane {
  // 循环分配 Transition Lane
  const lane = nextTransitionLane;
  nextTransitionLane <<= 1;
  if ((nextTransitionLane & TransitionLanes) === NoLanes) {
    nextTransitionLane = TransitionLane1;
  }
  return lane;
}
```

## getNextLanes（选择下一批要处理的 Lanes）

```javascript
export function getNextLanes(root: FiberRoot, wipLanes: Lanes): Lanes {
  const pendingLanes = root.pendingLanes;
  if (pendingLanes === NoLanes) {
    return NoLanes;
  }
  
  let nextLanes = NoLanes;
  
  // 检查非空闲工作
  const nonIdlePendingLanes = pendingLanes & NonIdleLanes;
  if (nonIdlePendingLanes !== NoLanes) {
    // 优先处理非空闲工作
    const nonIdleUnblockedLanes = nonIdlePendingLanes & ~suspendedLanes;
    if (nonIdleUnblockedLanes !== NoLanes) {
      nextLanes = getHighestPriorityLanes(nonIdleUnblockedLanes);
    }
  } else {
    // 只有空闲工作
    const unblockedLanes = pendingLanes & ~suspendedLanes;
    if (unblockedLanes !== NoLanes) {
      nextLanes = getHighestPriorityLanes(unblockedLanes);
    }
  }
  
  return nextLanes;
}
```

## 实际应用

### 1. 普通 setState

```javascript
const [count, setCount] = useState(0);
setCount(1);  // DefaultLane
```

### 2. startTransition

```javascript
import { startTransition } from 'react';

startTransition(() => {
  setCount(1);  // TransitionLane
});
```

### 3. flushSync

```javascript
import { flushSync } from 'react-dom';

flushSync(() => {
  setCount(1);  // SyncLane
});
```

### 4. useDeferredValue

```javascript
const deferredValue = useDeferredValue(value);  // DeferredLane
```

## 调试技巧

```javascript
// 在以下位置打断点：
// 1. requestUpdateLane - 观察优先级分配
// 2. getNextLanes - 观察优先级选择
// 3. scheduleUpdateOnFiber - 观察更新调度
// 4. markRootUpdated - 观察 Lane 标记
```
