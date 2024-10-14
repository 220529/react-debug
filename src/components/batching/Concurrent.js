import React, {
  useState,
  useEffect,
  useTransition,
  useDeferredValue,
} from "react";

const App = () => {
  const [list, setList] = useState([]);
  const [isPending, startTransition] = useTransition();

  //   const [text, setText] = useState("");

  //   const handleChange = (e) => {
  //     setText(e.target.value);
  //   };

  useEffect(() => {
    // 使用了并发特性，开启并发更新
    // startTransition(() => {
    //   setList(new Array(10000).fill(null));
    // });
    setList(new Array(10000).fill(null));
  }, []);
  //   const deferredList = useDeferredValue(list);
  return (
    <>
      {/* <input type="text" value={text} onChange={handleChange} /> */}
      {list.map((_, i) => (
        <div key={i}>{i}</div>
      ))}
    </>
  );
};

export default App;
