# React 19 渲染流程图

## 一、整体架构

```mermaid
flowchart TB
    subgraph React["React 核心"]
        API["React API<br/>useState/useEffect/..."]
    end
    
    subgraph Reconciler["Reconciler 协调器"]
        Fiber["Fiber 架构"]
        Diff["Diff 算法"]
        Hooks["Hooks 系统"]
    end
    
    subgraph Scheduler["Scheduler 调度器"]
        Priority["优先级管理"]
        TimeSlice["时间切片"]
        TaskQueue["任务队列"]
    end
    
    subgraph Renderer["Renderer 渲染器"]
        ReactDOM["ReactDOM"]
        DOM["DOM 操作"]
    end
    
    API --> Reconciler
    Reconciler <--> Scheduler
    Reconciler --> Renderer
    Renderer --> DOM
```

## 二、完整渲染流程

```mermaid
flowchart TB
    subgraph Trigger["触发更新"]
        A1["ReactDOM.createRoot().render()"]
        A2["setState / useState"]
        A3["forceUpdate"]
    end
    
    subgraph Schedule["调度阶段"]
        B1["scheduleUpdateOnFiber"]
        B2["markRootUpdated<br/>标记 root 有更新"]
        B3["ensureRootIsScheduled"]
        B4["scheduleCallback<br/>调度任务"]
    end
    
    subgraph Render["Render 阶段（可中断）"]
        C1["performConcurrentWorkOnRoot"]
        C2["renderRootSync / renderRootConcurrent"]
        C3["workLoopSync / workLoopConcurrent"]
        C4["performUnitOfWork"]
        
        subgraph BeginWork["递阶段 beginWork"]
            D1["根据 tag 处理不同组件"]
            D2["调用函数组件 / 类组件"]
            D3["reconcileChildren<br/>Diff 算法"]
            D4["返回子 Fiber"]
        end
        
        subgraph CompleteWork["归阶段 completeWork"]
            E1["创建/更新 DOM 节点"]
            E2["收集 flags 副作用"]
            E3["bubbleProperties"]
        end
    end
    
    subgraph Commit["Commit 阶段（不可中断）"]
        F1["commitRoot"]
        
        subgraph BeforeMutation["Before Mutation"]
            G1["getSnapshotBeforeUpdate"]
            G2["调度 useEffect"]
        end
        
        subgraph Mutation["Mutation"]
            H1["DOM 插入/更新/删除"]
            H2["useLayoutEffect 销毁"]
        end
        
        subgraph Layout["Layout"]
            I1["useLayoutEffect 创建"]
            I2["componentDidMount/Update"]
            I3["绑定 ref"]
        end
    end
    
    subgraph Passive["Passive Effects（异步）"]
        J1["flushPassiveEffects"]
        J2["useEffect 销毁"]
        J3["useEffect 创建"]
    end
    
    A1 & A2 & A3 --> B1
    B1 --> B2 --> B3 --> B4
    B4 --> C1 --> C2 --> C3 --> C4
    C4 --> D1 --> D2 --> D3 --> D4
    D4 -->|有子节点| C4
    D4 -->|无子节点| E1
    E1 --> E2 --> E3
    E3 -->|有兄弟| C4
    E3 -->|回到根| F1
    F1 --> G1 --> G2 --> H1 --> H2 --> I1 --> I2 --> I3
    I3 --> J1 --> J2 --> J3
```

## 三、Fiber 树遍历顺序

```mermaid
flowchart TB
    subgraph FiberTree["Fiber 树结构"]
        App["App<br/>①beginWork"]
        Div["Div<br/>②beginWork"]
        Text["Text<br/>③beginWork<br/>④completeWork"]
        Span["Span<br/>⑥beginWork<br/>⑦completeWork"]
        
        App -->|child| Div
        Div -->|child| Text
        Div -->|sibling| Span
        Text -->|return| Div
        Span -->|return| App
        Div -->|return| App
    end
    
    subgraph Order["遍历顺序"]
        O1["1. beginWork(App)"]
        O2["2. beginWork(Div)"]
        O3["3. beginWork(Text)"]
        O4["4. completeWork(Text)"]
        O5["5. completeWork(Div)"]
        O6["6. beginWork(Span)"]
        O7["7. completeWork(Span)"]
        O8["8. completeWork(App)"]
        
        O1 --> O2 --> O3 --> O4 --> O5 --> O6 --> O7 --> O8
    end
```

## 四、useState 更新流程

```mermaid
flowchart TB
    subgraph Mount["首次渲染 Mount"]
        M1["调用 useState(initialState)"]
        M2["mountState"]
        M3["mountWorkInProgressHook<br/>创建 Hook 节点"]
        M4["初始化 memoizedState"]
        M5["创建 UpdateQueue"]
        M6["绑定 dispatch = dispatchSetState"]
        M7["返回 [state, dispatch]"]
        
        M1 --> M2 --> M3 --> M4 --> M5 --> M6 --> M7
    end
    
    subgraph Update["触发更新"]
        U1["调用 setState(newValue)"]
        U2["dispatchSetState"]
        U3["requestUpdateLane<br/>获取优先级"]
        U4["创建 Update 对象"]
        U5["Eager State 优化<br/>提前计算新状态"]
        U6{{"状态相同?"}}
        U7["Bailout 跳过更新"]
        U8["enqueueConcurrentHookUpdate<br/>入队更新"]
        U9["scheduleUpdateOnFiber<br/>调度更新"]
        
        U1 --> U2 --> U3 --> U4 --> U5 --> U6
        U6 -->|是| U7
        U6 -->|否| U8 --> U9
    end
    
    subgraph Rerender["重新渲染"]
        R1["renderWithHooks"]
        R2["updateState"]
        R3["updateReducer"]
        R4["updateWorkInProgressHook<br/>获取对应 Hook"]
        R5["处理 UpdateQueue"]
        R6["计算新 state"]
        R7["返回 [newState, dispatch]"]
        
        R1 --> R2 --> R3 --> R4 --> R5 --> R6 --> R7
    end
    
    U9 -.-> R1
```

## 五、useEffect 执行流程

```mermaid
flowchart TB
    subgraph Mount["Mount 阶段"]
        M1["mountEffect"]
        M2["mountEffectImpl"]
        M3["创建 Effect 对象<br/>{tag, create, destroy, deps}"]
        M4["添加到 Fiber.updateQueue"]
        M5["标记 Fiber.flags |= Passive"]
    end
    
    subgraph Commit["Commit 阶段"]
        C1["commitRoot"]
        C2["检测 PassiveMask"]
        C3["scheduleCallback(flushPassiveEffects)"]
        C4["异步调度"]
    end
    
    subgraph Flush["Flush Passive Effects"]
        F1["flushPassiveEffects"]
        F2["commitPassiveUnmountEffects<br/>执行所有销毁函数"]
        F3["commitPassiveMountEffects<br/>执行所有创建函数"]
    end
    
    subgraph Update["Update 阶段"]
        U1["updateEffect"]
        U2["areHookInputsEqual<br/>比较 deps"]
        U3{{"deps 相同?"}}
        U4["复用 Effect，不执行"]
        U5["创建新 Effect<br/>标记 HookHasEffect"]
    end
    
    M1 --> M2 --> M3 --> M4 --> M5
    M5 --> C1 --> C2 --> C3 --> C4
    C4 -.->|下一个宏任务| F1
    F1 --> F2 --> F3
    
    U1 --> U2 --> U3
    U3 -->|是| U4
    U3 -->|否| U5
```

## 六、Diff 算法流程

```mermaid
flowchart TB
    subgraph Entry["入口"]
        A["reconcileChildFibers"]
        B{{"newChild 类型"}}
    end
    
    subgraph Single["单节点 Diff"]
        S1["reconcileSingleElement"]
        S2["遍历旧子节点"]
        S3{{"key 相同?"}}
        S4{{"type 相同?"}}
        S5["复用 Fiber<br/>删除其他兄弟"]
        S6["删除当前节点<br/>继续遍历"]
        S7["删除所有旧节点<br/>创建新 Fiber"]
    end
    
    subgraph Multi["多节点 Diff"]
        M1["reconcileChildrenArray"]
        
        subgraph Round1["第一轮：处理更新"]
            R1_1["从左到右遍历"]
            R1_2["updateSlot 比较"]
            R1_3{{"key 相同?"}}
            R1_4["更新节点"]
            R1_5["跳出循环"]
        end
        
        subgraph Round2["第二轮：处理增删"]
            R2_1{{"新节点遍历完?"}}
            R2_2["删除剩余旧节点"]
            R2_3{{"旧节点遍历完?"}}
            R2_4["新增剩余新节点"]
        end
        
        subgraph Round3["第三轮：处理移动"]
            R3_1["mapRemainingChildren<br/>旧节点放入 Map"]
            R3_2["遍历剩余新节点"]
            R3_3["updateFromMap<br/>从 Map 查找复用"]
            R3_4["placeChild<br/>判断是否移动"]
            R3_5["删除 Map 中剩余节点"]
        end
    end
    
    A --> B
    B -->|单个元素| S1
    B -->|数组| M1
    
    S1 --> S2 --> S3
    S3 -->|是| S4
    S3 -->|否| S6 --> S2
    S4 -->|是| S5
    S4 -->|否| S7
    
    M1 --> R1_1 --> R1_2 --> R1_3
    R1_3 -->|是| R1_4 --> R1_1
    R1_3 -->|否| R1_5
    
    R1_5 --> R2_1
    R2_1 -->|是| R2_2
    R2_1 -->|否| R2_3
    R2_3 -->|是| R2_4
    R2_3 -->|否| R3_1
    
    R3_1 --> R3_2 --> R3_3 --> R3_4 --> R3_2
    R3_4 --> R3_5
```

## 七、Scheduler 调度流程

```mermaid
flowchart TB
    subgraph Schedule["调度任务"]
        A1["scheduleCallback(priority, callback)"]
        A2["计算 expirationTime<br/>startTime + timeout"]
        A3["创建 Task 对象"]
        A4{{"startTime > currentTime?"}}
        A5["push(timerQueue)<br/>延迟队列"]
        A6["push(taskQueue)<br/>就绪队列"]
        A7["requestHostCallback"]
    end
    
    subgraph Execute["执行任务"]
        B1["schedulePerformWorkUntilDeadline"]
        B2["MessageChannel.postMessage"]
        B3["performWorkUntilDeadline"]
        B4["flushWork"]
        B5["workLoop"]
        B6["peek(taskQueue)<br/>获取最高优先级任务"]
        B7{{"任务过期 或 时间片未用完?"}}
        B8["执行 task.callback"]
        B9{{"返回 continuation?"}}
        B10["保留任务继续执行"]
        B11["pop(taskQueue)<br/>移除任务"]
        B12{{"还有任务?"}}
        B13["继续调度"]
        B14["结束"]
    end
    
    subgraph Yield["让出控制权"]
        C1["shouldYieldToHost"]
        C2["检查 timeElapsed >= frameInterval"]
        C3["返回 true，中断循环"]
    end
    
    A1 --> A2 --> A3 --> A4
    A4 -->|是| A5
    A4 -->|否| A6 --> A7
    
    A7 --> B1 --> B2 --> B3 --> B4 --> B5 --> B6 --> B7
    B7 -->|是| B8 --> B9
    B7 -->|否| C1 --> C2 --> C3
    B9 -->|是| B10 --> B12
    B9 -->|否| B11 --> B6
    B12 -->|是| B13 --> B1
    B12 -->|否| B14
    C3 --> B12
```

## 八、Lane 优先级处理

```mermaid
flowchart TB
    subgraph Request["请求优先级"]
        A1["requestUpdateLane"]
        A2{{"Legacy 模式?"}}
        A3["返回 SyncLane"]
        A4{{"渲染阶段更新?"}}
        A5["返回当前渲染 Lane"]
        A6{{"有 Transition?"}}
        A7["requestTransitionLane<br/>分配 TransitionLane"]
        A8["根据事件类型<br/>返回对应 Lane"]
    end
    
    subgraph Select["选择 Lanes"]
        B1["getNextLanes"]
        B2["获取 pendingLanes"]
        B3["过滤 suspendedLanes"]
        B4["getHighestPriorityLanes<br/>获取最高优先级"]
        B5["返回要处理的 Lanes"]
    end
    
    subgraph Process["处理更新"]
        C1["performConcurrentWorkOnRoot"]
        C2["根据 Lanes 决定<br/>同步/并发渲染"]
        C3["renderRootSync"]
        C4["renderRootConcurrent"]
    end
    
    A1 --> A2
    A2 -->|是| A3
    A2 -->|否| A4
    A4 -->|是| A5
    A4 -->|否| A6
    A6 -->|是| A7
    A6 -->|否| A8
    
    B1 --> B2 --> B3 --> B4 --> B5
    
    B5 --> C1 --> C2
    C2 -->|SyncLane| C3
    C2 -->|其他| C4
```

## 九、Commit 三阶段详细流程

```mermaid
flowchart TB
    subgraph Before["Before Mutation 阶段"]
        BM1["commitBeforeMutationEffects"]
        BM2["遍历 Fiber 树"]
        BM3{{"flags & Snapshot?"}}
        BM4["ClassComponent:<br/>getSnapshotBeforeUpdate"]
        BM5{{"flags & Passive?"}}
        BM6["调度 flushPassiveEffects"]
    end
    
    subgraph Mutation["Mutation 阶段"]
        MU1["commitMutationEffects"]
        MU2["递归处理子树"]
        MU3{{"flags & ChildDeletion?"}}
        MU4["commitDeletions<br/>删除子节点"]
        MU5{{"flags & Placement?"}}
        MU6["commitPlacement<br/>插入 DOM"]
        MU7{{"flags & Update?"}}
        MU8["commitUpdate<br/>更新 DOM 属性"]
        MU9["root.current = finishedWork<br/>切换 Fiber 树"]
    end
    
    subgraph Layout["Layout 阶段"]
        LA1["commitLayoutEffects"]
        LA2["递归处理子树"]
        LA3{{"FunctionComponent?"}}
        LA4["commitHookEffectListMount<br/>useLayoutEffect 创建"]
        LA5{{"ClassComponent?"}}
        LA6["componentDidMount/Update"]
        LA7{{"flags & Ref?"}}
        LA8["commitAttachRef<br/>绑定 ref"]
    end
    
    BM1 --> BM2 --> BM3
    BM3 -->|是| BM4
    BM3 -->|否| BM5
    BM4 --> BM5
    BM5 -->|是| BM6
    BM5 -->|否| MU1
    BM6 --> MU1
    
    MU1 --> MU2 --> MU3
    MU3 -->|是| MU4 --> MU5
    MU3 -->|否| MU5
    MU5 -->|是| MU6 --> MU7
    MU5 -->|否| MU7
    MU7 -->|是| MU8 --> MU9
    MU7 -->|否| MU9
    
    MU9 --> LA1 --> LA2 --> LA3
    LA3 -->|是| LA4 --> LA7
    LA3 -->|否| LA5
    LA5 -->|是| LA6 --> LA7
    LA5 -->|否| LA7
    LA7 -->|是| LA8
```

## 十、双缓冲机制

```mermaid
flowchart LR
    subgraph Current["Current 树（屏幕显示）"]
        CA["App Fiber"]
        CB["Div Fiber"]
        CC["Text Fiber"]
        CA -->|child| CB -->|child| CC
    end
    
    subgraph WIP["WorkInProgress 树（内存构建）"]
        WA["App Fiber'"]
        WB["Div Fiber'"]
        WC["Text Fiber'"]
        WA -->|child| WB -->|child| WC
    end
    
    CA <-.->|alternate| WA
    CB <-.->|alternate| WB
    CC <-.->|alternate| WC
    
    subgraph Root["FiberRoot"]
        R["root.current"]
    end
    
    R -->|渲染前| CA
    R -.->|渲染后| WA
```

---

## 调试建议

1. **入口断点**：`ReactDOM.createRoot` → `createRoot` → `createFiberRoot`
2. **更新断点**：`dispatchSetState` → `scheduleUpdateOnFiber`
3. **渲染断点**：`performUnitOfWork` → `beginWork` → `completeWork`
4. **提交断点**：`commitRoot` → `commitMutationEffects` → `commitLayoutEffects`

在 Counter 组件点击按钮时，可以完整观察从 `dispatchSetState` 到 DOM 更新的全流程。
