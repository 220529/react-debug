import { useId } from "react";

export default function Form() {
  const id = useId();
  console.log("useId: ", id);
  return (
    <>
      <label htmlFor={id}>Name:</label>
      <input id={id} type="text" />
    </>
  );
}
