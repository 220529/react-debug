# React Hooks 原理

## Hook 数据结构

```javascript
// 单个 Hook 节点
type Hook = {
  memoizedState: any,    // 存储的状态值
  baseState: any,        // 基础状态（用于更新计算）
  baseQueue: Update | null,  // 基础更新队列
  queue: UpdateQueue | null, // 更新队列
  next: Hook | null,     // 指向下一个 Hook（链表）
};

// 更新队列
type UpdateQueue<S, A> = {
  pending: Update<S, A> | null,  // 待处理的更新（环形链表）
  lanes: Lanes,
  dispatch: (A => mixed) | null, // setState 函数
  lastRenderedReducer: ((S, A) => S) | null,
  lastRenderedState: S | null,
};

// 单个更新
type Update<S, A> = {
  lane: Lane,            // 优先级
  action: A,             // 更新动作（新值或函数）
  hasEagerState: boolean,// 是否有预计算的状态
  eagerState: S | null,  // 预计算的状态
  next: Update<S, A>,    // 下一个更新
};
```

## Hook 链表存储

Hooks 以链表形式存储在 Fiber 节点的 `memoizedState` 上：

```
Fiber.memoizedState → Hook1 → Hook2 → Hook3 → null
                       ↓        ↓        ↓
                    useState  useEffect useMemo
```

## 核心机制

### 1. Mount 阶段（首次渲染）

```javascript
function mountWorkInProgressHook(): Hook {
  const hook: Hook = {
    memoizedState: null,
    baseState: null,
    baseQueue: null,
    queue: null,
    next: null,
  };

  if (workInProgressHook === null) {
    // 第一个 Hook，挂载到 Fiber
    currentlyRenderingFiber.memoizedState = workInProgressHook = hook;
  } else {
    // 追加到链表末尾
    workInProgressHook = workInProgressHook.next = hook;
  }
  return workInProgressHook;
}
```

### 2. Update 阶段（更新渲染）

```javascript
function updateWorkInProgressHook(): Hook {
  // 从 current Fiber 获取对应的 Hook
  let nextCurrentHook = currentHook === null
    ? currentlyRenderingFiber.alternate.memoizedState
    : currentHook.next;

  // 复用或克隆 Hook
  currentHook = nextCurrentHook;
  // ... 返回 workInProgressHook
}
```

## useState 实现

### mountState（首次渲染）

```javascript
function mountState<S>(initialState: (() => S) | S) {
  const hook = mountWorkInProgressHook();
  
  // 支持函数式初始化
  if (typeof initialState === 'function') {
    initialState = initialState();
  }
  
  hook.memoizedState = hook.baseState = initialState;
  
  // 创建更新队列
  const queue = {
    pending: null,
    lanes: NoLanes,
    dispatch: null,
    lastRenderedReducer: basicStateReducer,
    lastRenderedState: initialState,
  };
  hook.queue = queue;
  
  // 绑定 dispatch 函数
  const dispatch = dispatchSetState.bind(null, currentlyRenderingFiber, queue);
  queue.dispatch = dispatch;
  
  return [hook.memoizedState, dispatch];
}
```

### updateState（更新渲染）

```javascript
function updateState<S>(initialState) {
  // useState 本质是预设 reducer 的 useReducer
  return updateReducer(basicStateReducer, initialState);
}

// 基础 reducer：支持值或函数
function basicStateReducer<S>(state: S, action: BasicStateAction<S>): S {
  return typeof action === 'function' ? action(state) : action;
}
```

## dispatchSetState（触发更新）

```javascript
function dispatchSetState<S, A>(fiber, queue, action) {
  // 1. 获取更新优先级
  const lane = requestUpdateLane(fiber);
  
  // 2. 创建更新对象
  const update = {
    lane,
    action,
    hasEagerState: false,
    eagerState: null,
    next: null,
  };
  
  // 3. 性能优化：Eager State
  if (fiber.lanes === NoLanes) {
    const currentState = queue.lastRenderedState;
    const eagerState = queue.lastRenderedReducer(currentState, action);
    update.hasEagerState = true;
    update.eagerState = eagerState;
    
    // 如果状态相同，跳过更新
    if (Object.is(eagerState, currentState)) {
      return; // Bailout!
    }
  }
  
  // 4. 入队并调度更新
  enqueueConcurrentHookUpdate(fiber, queue, update, lane);
  scheduleUpdateOnFiber(root, fiber, lane);
}
```

## 为什么 Hooks 不能条件调用？

Hooks 依赖调用顺序来匹配 Hook 链表：

```javascript
// ❌ 错误：条件调用
if (condition) {
  const [a, setA] = useState(0);  // Hook 1
}
const [b, setB] = useState(0);    // Hook 2 或 Hook 1？

// ✅ 正确：固定顺序
const [a, setA] = useState(0);    // 始终是 Hook 1
const [b, setB] = useState(0);    // 始终是 Hook 2
```

Mount 和 Update 时，React 按顺序遍历链表，如果顺序不一致会导致状态错乱。

## Dispatcher 切换

React 通过切换 Dispatcher 来区分 mount/update：

```javascript
// renderWithHooks 中
ReactSharedInternals.H = 
  current === null || current.memoizedState === null
    ? HooksDispatcherOnMount   // 首次渲染
    : HooksDispatcherOnUpdate; // 更新渲染

// 渲染完成后
ReactSharedInternals.H = ContextOnlyDispatcher; // 禁止在组件外调用
```

## 调试技巧

在 Counter 组件中打断点：

```javascript
// src/components/counter/index.js
const [count, setCount] = useState(0);  // 断点这里

// 然后在源码中打断点：
// - mountState (首次渲染)
// - dispatchSetState (点击按钮)
// - updateReducer (更新渲染)
```
