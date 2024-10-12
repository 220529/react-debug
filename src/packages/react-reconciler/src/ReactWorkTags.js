/**
 * WorkTag 类型，用于标识 Fiber 节点的类型。
 * 每个类型都有唯一的数字表示。
 */
export type WorkTag =
  | 0    // FunctionComponent 函数组件
  | 1    // ClassComponent 类组件
  | 2    // IndeterminateComponent 尚未确定是函数还是类组件
  | 3    // HostRoot 宿主树的根节点，可能嵌套在其他节点中
  | 4    // HostPortal 子树的入口点，可能渲染到不同的 DOM 树
  | 5    // HostComponent 普通 DOM 元素
  | 6    // HostText 文本节点
  | 7    // Fragment 无状态的分片，可以组合多个子节点
  | 8    // Mode 模式节点，用于标记严格模式或并发模式
  | 9    // ContextConsumer Context 消费者
  | 10   // ContextProvider Context 提供者
  | 11   // ForwardRef 用于处理 `ref` 转发的组件
  | 12   // Profiler 性能分析组件
  | 13   // SuspenseComponent 用于处理异步渲染的 Suspense 组件
  | 14   // MemoComponent 通过记忆化优化的组件
  | 15   // SimpleMemoComponent 简单的记忆化组件
  | 16   // LazyComponent 懒加载组件
  | 17   // IncompleteClassComponent 未完成的类组件，用于错误边界
  | 18   // DehydratedFragment 已渲染的片段，通常用于 SSR 的水合
  | 19   // SuspenseListComponent 用于显示一组 Suspense 组件
  | 21   // ScopeComponent Scope 组件，React 内部实验性 API
  | 22   // OffscreenComponent 离屏渲染的组件
  | 23   // LegacyHiddenComponent 旧版隐藏组件
  | 24   // CacheComponent 用于缓存管理的组件
  | 25   // TracingMarkerComponent 用于跟踪性能标记的组件

// FunctionComponent 表示一个函数组件
export const FunctionComponent = 0;

// ClassComponent 表示一个类组件
export const ClassComponent = 1;

// IndeterminateComponent 表示在还不知道是函数还是类组件之前的组件类型
export const IndeterminateComponent = 2;

// HostRoot 表示整个应用的根节点，可能嵌套在另一个树中
export const HostRoot = 3;

// HostPortal 表示一个子树，可能是不同渲染器的入口点
export const HostPortal = 4;

// HostComponent 表示一个普通的 DOM 元素
export const HostComponent = 5;

// HostText 表示一个文本节点
export const HostText = 6;

// Fragment 表示一个无状态的分片，可以将多个子组件组合在一起
export const Fragment = 7;

// Mode 用于标识不同的运行模式，如严格模式或并发模式
export const Mode = 8;

// ContextConsumer 表示 React Context 的消费者
export const ContextConsumer = 9;

// ContextProvider 表示 React Context 的提供者
export const ContextProvider = 10;

// ForwardRef 表示使用 `React.forwardRef` 创建的组件
export const ForwardRef = 11;

// Profiler 用于收集性能数据的组件
export const Profiler = 12;

// SuspenseComponent 表示 React 的 Suspense 组件，允许异步加载
export const SuspenseComponent = 13;

// MemoComponent 表示使用 `React.memo` 包装的组件
export const MemoComponent = 14;

// SimpleMemoComponent 是 MemoComponent 的一种简单版本
export const SimpleMemoComponent = 15;

// LazyComponent 表示使用 `React.lazy` 懒加载的组件
export const LazyComponent = 16;

// IncompleteClassComponent 表示未完全加载的类组件
export const IncompleteClassComponent = 17;

// DehydratedFragment 表示服务器渲染的静态内容，可能会在客户端被恢复
export const DehydratedFragment = 18;

// SuspenseListComponent 是用于处理多个 Suspense 组件的列表
export const SuspenseListComponent = 19;

// ScopeComponent 是实验性 API 的一部分，用于为元素创建新的访问范围
export const ScopeComponent = 21;

// OffscreenComponent 用于实现将组件内容隐藏在屏幕外的效果
export const OffscreenComponent = 22;

// LegacyHiddenComponent 是 React 的遗留组件，用于隐藏 DOM 内容
export const LegacyHiddenComponent = 23;

// CacheComponent 用于实现缓存机制
export const CacheComponent = 24;

// TracingMarkerComponent 是与性能跟踪相关的组件
export const TracingMarkerComponent = 25;
