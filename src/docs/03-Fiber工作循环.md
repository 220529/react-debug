# Fiber 工作循环

## 整体流程

```
scheduleUpdateOnFiber → ensureRootIsScheduled → performWorkOnRoot
                                                      ↓
                                              renderRootSync/Concurrent
                                                      ↓
                                                 workLoopSync/Concurrent
                                                      ↓
                                              performUnitOfWork (循环)
                                                      ↓
                                          beginWork → completeWork
                                                      ↓
                                              commitRoot (提交)
```

## 核心函数

### performUnitOfWork

工作循环的核心，处理单个 Fiber 节点：

```javascript
function performUnitOfWork(unitOfWork: Fiber): void {
  const current = unitOfWork.alternate;
  
  // 递阶段：处理当前节点，返回子节点
  let next = beginWork(current, unitOfWork, entangledRenderLanes);
  
  unitOfWork.memoizedProps = unitOfWork.pendingProps;
  
  if (next === null) {
    // 没有子节点，进入归阶段
    completeUnitOfWork(unitOfWork);
  } else {
    // 有子节点，继续向下
    workInProgress = next;
  }
}
```

### workLoopSync / workLoopConcurrent

```javascript
// 同步模式：不可中断
function workLoopSync() {
  while (workInProgress !== null) {
    performUnitOfWork(workInProgress);
  }
}

// 并发模式：可中断
function workLoopConcurrent() {
  while (workInProgress !== null && !shouldYield()) {
    performUnitOfWork(workInProgress);
  }
}
```

## beginWork（递阶段）

向下遍历，为每个节点创建/更新 Fiber：

```javascript
function beginWork(current, workInProgress, renderLanes) {
  // 1. 检查是否可以复用（bailout）
  if (current !== null) {
    const oldProps = current.memoizedProps;
    const newProps = workInProgress.pendingProps;
    
    if (oldProps === newProps && !hasScheduledUpdateOrContext) {
      // 可以跳过，复用子节点
      return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);
    }
  }
  
  // 2. 根据组件类型处理
  switch (workInProgress.tag) {
    case FunctionComponent:
      return updateFunctionComponent(current, workInProgress, ...);
    case ClassComponent:
      return updateClassComponent(current, workInProgress, ...);
    case HostComponent:  // div, span 等
      return updateHostComponent(current, workInProgress, ...);
    case HostRoot:
      return updateHostRoot(current, workInProgress, ...);
    // ... 其他类型
  }
}
```

### updateFunctionComponent

```javascript
function updateFunctionComponent(current, workInProgress, Component, ...) {
  // 调用函数组件，执行 Hooks
  let nextChildren = renderWithHooks(
    current,
    workInProgress,
    Component,
    nextProps,
    context,
    renderLanes,
  );
  
  // 检查是否可以 bailout
  if (current !== null && !didReceiveUpdate) {
    bailoutHooks(current, workInProgress, renderLanes);
    return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);
  }
  
  // 协调子节点（Diff 算法）
  reconcileChildren(current, workInProgress, nextChildren, renderLanes);
  return workInProgress.child;
}
```

## completeWork（归阶段）

向上回溯，创建 DOM 节点，收集副作用：

```javascript
function completeWork(current, workInProgress, renderLanes) {
  switch (workInProgress.tag) {
    case FunctionComponent:
    case ClassComponent:
      // 冒泡属性（收集子树的 flags）
      bubbleProperties(workInProgress);
      return null;
      
    case HostComponent: {
      const type = workInProgress.type;  // 'div', 'span' 等
      
      if (current !== null && workInProgress.stateNode != null) {
        // 更新：对比 props，标记更新
        updateHostComponent(current, workInProgress, type, newProps);
      } else {
        // 首次渲染：创建 DOM 节点
        const instance = createInstance(type, newProps, ...);
        appendAllChildren(instance, workInProgress, ...);
        workInProgress.stateNode = instance;
      }
      
      bubbleProperties(workInProgress);
      return null;
    }
    
    case HostRoot:
      // 根节点处理
      bubbleProperties(workInProgress);
      return null;
  }
}
```

### bubbleProperties

收集子树的副作用标记：

```javascript
function bubbleProperties(completedWork) {
  let subtreeFlags = NoFlags;
  let child = completedWork.child;
  
  while (child !== null) {
    subtreeFlags |= child.subtreeFlags;
    subtreeFlags |= child.flags;
    child = child.sibling;
  }
  
  completedWork.subtreeFlags |= subtreeFlags;
}
```

## 遍历顺序示例

```
      App
     /   \
   Div   Span
   /
 Text

遍历顺序：
1. beginWork(App)    → 返回 Div
2. beginWork(Div)    → 返回 Text
3. beginWork(Text)   → 返回 null
4. completeWork(Text)
5. completeWork(Div) → sibling: Span
6. beginWork(Span)   → 返回 null
7. completeWork(Span)
8. completeWork(App)
```

## Flags（副作用标记）

```javascript
// ReactFiberFlags.js
export const NoFlags = 0b0000000000000000000000000000;
export const Placement = 0b0000000000000000000000000010;    // 插入
export const Update = 0b0000000000000000000000000100;       // 更新
export const ChildDeletion = 0b0000000000000000000000010000; // 删除子节点
export const Passive = 0b0000000000000000100000000000;      // useEffect
export const LayoutMask = Update | Callback | Ref;          // useLayoutEffect
```

## 调试入口

```javascript
// 在以下位置打断点：
// 1. performUnitOfWork - 观察工作循环
// 2. beginWork - 观察递阶段
// 3. completeWork - 观察归阶段
// 4. updateFunctionComponent - 观察函数组件处理
```
