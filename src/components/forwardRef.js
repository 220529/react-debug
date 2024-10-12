import { forwardRef } from "react"

// 使用 forwardRef
const InputComponent = forwardRef(({ value }, ref) => (
  <input ref={ref} className="FancyButton" value={value} />
));

// 根据 forwardRef 的源码，最终返回的对象格式为：
// const InputComponent = {
//   $$typeof: REACT_FORWARD_REF_TYPE,
//   render,
// }

// // 使用组件
// const result = <InputComponent />

// Bable 将其转译为：
// const result = React.createElement(InputComponent, null);

// 最终返回的对象为：
// const result = {
//   $$typeof: REACT_ELEMENT_TYPE,
//   type: {
//     $$typeof: REACT_FORWARD_REF_TYPE,
//     render,
//   }
// }

export default () => {
  const result = <InputComponent />
  console.log("result", result);
  return null
}
