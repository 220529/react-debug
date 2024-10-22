import RefApp from "@/components/ref";
import Counter from "@/components/counter";
import UseEffectApp from "@/components/InfiniteLoop/useEffect";
import UseIdApp from "@/components/useId";
import EventApp from "@/components/event";
import AsyncApp from "@/components/setState/async";
import PromiseApp from "@/components/setState/promise";
import EmptyComponent from "@/components/EmptyComponent";

import AutomaticApp from "@/components/batching/Automatic";
import ConcurrentApp from "@/components/batching/Concurrent";

// import TodoList from "@/components/todoList";
// import TodoListNoKey from "@/components/todoList/NoKey";
// import TodoListWithKey from "@/components/todoList/WithKey";

import TodoListNoKey from "@/components/render-list/NoKey";

function App() {
  return (
    <div id="app">
      <RefApp />
      {/* <RefApp /> */}
      {/* <Counter /> */}
      {/* <UseEffectApp /> */}
      {/* <UseIdApp /> */}
      {/* <EmptyComponent /> */}
      {/* <EventApp /> */}
      {/* <PromiseApp /> */}
      {/* <AsyncApp /> */}

      {/* <AutomaticApp /> */}
      {/* <ConcurrentApp /> */}

      {/* <TodoList /> */}
      <TodoListNoKey />
      {/* <TodoListWithKey /> */}
    </div>
  );
}

export default App;
