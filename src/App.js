import Counter from "@/components/counter";
import UseEffectApp from "@/components/InfiniteLoop/useEffect";
import UseIdApp from "@/components/useId";
import AutomaticApp from "@/components/batching/Automatic";

function App() {
  return (
    <div id="app">
      {/* <Counter /> */}
      {/* <UseEffectApp /> */}
      {/* <UseIdApp /> */}
      <AutomaticApp />
    </div>
  );
}

export default App;
