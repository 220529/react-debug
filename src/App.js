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

function App() {
  return (
    <div id="app">
      {/* <RefApp /> */}
      <Counter />
      {/* <UseEffectApp /> */}
      {/* <UseIdApp /> */}
      {/* <EmptyComponent /> */}
      {/* <EventApp /> */}
      {/* <PromiseApp /> */}
      {/* <AsyncApp /> */}

      {/* <AutomaticApp /> */}
      {/* <ConcurrentApp /> */}
    </div>
  );
}

export default App;
