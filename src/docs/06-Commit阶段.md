# Commit 阶段

## 概述

Commit 阶段是 React 渲染的第二阶段，负责将 Fiber 树的变更同步到 DOM。这个阶段不可中断。

## 三个子阶段

```javascript
function commitRootImpl(root, ...) {
  // 1. Before Mutation 阶段
  commitBeforeMutationEffects(root, finishedWork);
  
  // 2. Mutation 阶段
  commitMutationEffects(root, finishedWork, lanes);
  
  // 切换 Fiber 树
  root.current = finishedWork;
  
  // 3. Layout 阶段
  commitLayoutEffects(finishedWork, root, lanes);
}
```

## 1. Before Mutation 阶段

DOM 变更前，读取 DOM 状态。

```javascript
function commitBeforeMutationEffects(root, firstChild) {
  // 遍历 Fiber 树
  while (nextEffect !== null) {
    const fiber = nextEffect;
    
    // 处理 Snapshot 标记
    if ((fiber.flags & Snapshot) !== NoFlags) {
      // 类组件：调用 getSnapshotBeforeUpdate
      if (fiber.tag === ClassComponent) {
        const snapshot = instance.getSnapshotBeforeUpdate(prevProps, prevState);
        instance.__reactInternalSnapshotBeforeUpdate = snapshot;
      }
    }
    
    nextEffect = fiber.nextEffect;
  }
}
```

主要工作：
- 调用 `getSnapshotBeforeUpdate` 生命周期
- 调度 `useEffect`（异步）

## 2. Mutation 阶段

执行 DOM 操作。

```javascript
function commitMutationEffects(root, finishedWork, lanes) {
  // 递归处理
  commitMutationEffectsOnFiber(finishedWork, root, lanes);
}

function commitMutationEffectsOnFiber(finishedWork, root, lanes) {
  const flags = finishedWork.flags;
  
  // 处理 Ref 卸载
  if (flags & Ref) {
    commitAttachRef(finishedWork);
  }
  
  // 处理 DOM 操作
  switch (finishedWork.tag) {
    case HostComponent: {
      if (flags & Update) {
        // 更新 DOM 属性
        commitUpdate(instance, type, oldProps, newProps, finishedWork);
      }
      break;
    }
    case HostText: {
      if (flags & Update) {
        // 更新文本内容
        commitTextUpdate(textInstance, oldText, newText);
      }
      break;
    }
  }
  
  // 处理 Placement（插入）
  if (flags & Placement) {
    commitPlacement(finishedWork);
  }
  
  // 处理 ChildDeletion（删除子节点）
  if (flags & ChildDeletion) {
    commitDeletions(deletions, finishedWork);
  }
}
```

### commitPlacement（插入 DOM）

```javascript
function commitPlacement(finishedWork) {
  // 找到最近的 Host 父节点
  const parentFiber = getHostParentFiber(finishedWork);
  const parentDOM = parentFiber.stateNode;
  
  // 找到插入位置（兄弟节点）
  const before = getHostSibling(finishedWork);
  
  // 插入 DOM
  if (before) {
    parentDOM.insertBefore(finishedWork.stateNode, before);
  } else {
    parentDOM.appendChild(finishedWork.stateNode);
  }
}
```

### commitDeletions（删除）

```javascript
function commitDeletions(deletions, fiber) {
  for (let i = 0; i < deletions.length; i++) {
    const childToDelete = deletions[i];
    
    // 递归卸载
    commitUnmount(childToDelete);
    
    // 从 DOM 中移除
    removeChild(parentDOM, childToDelete.stateNode);
  }
}

function commitUnmount(fiber) {
  switch (fiber.tag) {
    case FunctionComponent: {
      // 执行 useEffect 的清理函数
      commitHookEffectListUnmount(HookPassive, fiber);
      // 执行 useLayoutEffect 的清理函数
      commitHookEffectListUnmount(HookLayout, fiber);
      break;
    }
    case ClassComponent: {
      // 调用 componentWillUnmount
      instance.componentWillUnmount();
      break;
    }
  }
}
```

## 3. Layout 阶段

DOM 变更后，可以安全读取 DOM。

```javascript
function commitLayoutEffects(finishedWork, root, lanes) {
  commitLayoutEffectOnFiber(root, finishedWork.alternate, finishedWork, lanes);
}

function commitLayoutEffectOnFiber(root, current, finishedWork, lanes) {
  const flags = finishedWork.flags;
  
  switch (finishedWork.tag) {
    case FunctionComponent: {
      // 执行 useLayoutEffect
      commitHookEffectListMount(HookLayout, finishedWork);
      break;
    }
    case ClassComponent: {
      if (current === null) {
        // 首次渲染：componentDidMount
        instance.componentDidMount();
      } else {
        // 更新：componentDidUpdate
        instance.componentDidUpdate(prevProps, prevState, snapshot);
      }
      
      // 处理 setState 回调
      commitUpdateQueue(finishedWork, updateQueue, instance);
      break;
    }
    case HostRoot: {
      // 处理 ReactDOM.render 回调
      commitUpdateQueue(finishedWork, updateQueue, null);
      break;
    }
  }
  
  // 绑定 Ref
  if (flags & Ref) {
    commitAttachRef(finishedWork);
  }
}
```

## useEffect 的调度

useEffect 是异步执行的，在 commit 阶段只是调度：

```javascript
// commitRootImpl 中
if ((finishedWork.subtreeFlags & PassiveMask) !== NoFlags) {
  // 调度 useEffect
  scheduleCallback(NormalSchedulerPriority, () => {
    flushPassiveEffects();
    return null;
  });
}
```

### flushPassiveEffects

```javascript
function flushPassiveEffects() {
  if (rootWithPendingPassiveEffects !== null) {
    // 1. 执行所有 useEffect 的销毁函数
    commitPassiveUnmountEffects(root.current);
    
    // 2. 执行所有 useEffect 的创建函数
    commitPassiveMountEffects(root, root.current);
  }
}
```

## Effect 执行顺序

```
组件树：
  App
   └── Parent
        └── Child

Mount 时：
1. Child useLayoutEffect 创建
2. Parent useLayoutEffect 创建
3. App useLayoutEffect 创建
4. Child useEffect 创建（异步）
5. Parent useEffect 创建（异步）
6. App useEffect 创建（异步）

Unmount 时：
1. App useLayoutEffect 销毁
2. Parent useLayoutEffect 销毁
3. Child useLayoutEffect 销毁
4. App useEffect 销毁（异步）
5. Parent useEffect 销毁（异步）
6. Child useEffect 销毁（异步）
```

## Flags 标记

```javascript
// ReactFiberFlags.js
export const Placement = 0b0000000000000010;      // 插入
export const Update = 0b0000000000000100;         // 更新
export const ChildDeletion = 0b0000000000010000;  // 删除子节点
export const Snapshot = 0b0000000100000000;       // getSnapshotBeforeUpdate
export const Passive = 0b0000100000000000;        // useEffect
export const Ref = 0b0001000000000000;            // ref

// 阶段掩码
export const BeforeMutationMask = Snapshot;
export const MutationMask = Placement | Update | ChildDeletion | Ref;
export const LayoutMask = Update | Callback | Ref;
export const PassiveMask = Passive | ChildDeletion;
```

## 调试技巧

```javascript
// 在以下位置打断点：
// 1. commitBeforeMutationEffects - Before Mutation 阶段
// 2. commitMutationEffects - Mutation 阶段
// 3. commitLayoutEffects - Layout 阶段
// 4. flushPassiveEffects - useEffect 执行
// 5. commitPlacement - DOM 插入
// 6. commitUpdate - DOM 更新
```
