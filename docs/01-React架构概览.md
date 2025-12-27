# React 19 源码架构概览

## 项目结构

本项目是 React 19.0.0 源码调试环境，核心源码位于 `src/packages/` 目录。

## 核心包

```
src/packages/
├── react/                    # React 核心 API（useState, useEffect 等）
├── react-dom/                # DOM 渲染器
├── react-reconciler/         # 协调器（Fiber 架构核心）
├── scheduler/                # 调度器（任务优先级调度）
└── shared/                   # 共享工具和类型
```

## 三大核心模块

### 1. Scheduler（调度器）
负责任务的优先级调度，决定何时执行什么任务。

核心文件：
- `scheduler/src/SchedulerMinHeap.js` - 最小堆实现
- `scheduler/src/SchedulerPriorities.js` - 优先级定义

### 2. Reconciler（协调器）
负责 Fiber 树的构建和 diff 算法，是 React 的核心。

核心文件：
- `ReactFiber.js` - Fiber 节点定义
- `ReactFiberBeginWork.js` - 递阶段（向下遍历）
- `ReactFiberCompleteWork.js` - 归阶段（向上回溯）
- `ReactFiberWorkLoop.js` - 工作循环
- `ReactFiberHooks.js` - Hooks 实现

### 3. Renderer（渲染器）
负责将 Fiber 树渲染到具体平台（DOM、Native 等）。

核心文件：
- `react-dom/src/client/ReactDOMRoot.js` - createRoot 入口
- `react-dom-bindings/` - DOM 操作绑定

## Fiber 数据结构

```javascript
function FiberNode(tag, pendingProps, key, mode) {
  // 节点类型
  this.tag = tag;           // WorkTag: FunctionComponent=0, ClassComponent=1, HostRoot=3...
  this.key = key;
  this.type = null;         // 组件函数或类
  this.stateNode = null;    // DOM 节点或类实例

  // Fiber 树结构（链表）
  this.return = null;       // 父节点
  this.child = null;        // 第一个子节点
  this.sibling = null;      // 兄弟节点

  // 状态
  this.pendingProps = pendingProps;
  this.memoizedProps = null;
  this.memoizedState = null;  // Hooks 链表头
  this.updateQueue = null;

  // 副作用
  this.flags = NoFlags;
  this.subtreeFlags = NoFlags;

  // 优先级
  this.lanes = NoLanes;
  this.childLanes = NoLanes;

  // 双缓冲
  this.alternate = null;    // 指向另一棵树的对应节点
}
```

## 双缓冲机制

React 维护两棵 Fiber 树：
- `current` - 当前屏幕显示的树
- `workInProgress` - 正在构建的新树

更新完成后，通过 `root.current = workInProgress` 切换。

## 渲染流程

```
触发更新 → Scheduler 调度 → Reconciler 协调 → Renderer 渲染
    ↓           ↓              ↓              ↓
setState   优先级排序      Fiber diff      DOM 操作
```

### 两个阶段

1. **Render 阶段**（可中断）
   - `beginWork`: 向下递归，创建/复用 Fiber
   - `completeWork`: 向上回溯，创建 DOM 节点

2. **Commit 阶段**（不可中断）
   - `beforeMutation`: DOM 操作前
   - `mutation`: 执行 DOM 操作
   - `layout`: DOM 操作后（useLayoutEffect）

## 调试入口

```javascript
// src/index.js
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
```

在 `createRoot` 和 `render` 处打断点，即可开始调试。
