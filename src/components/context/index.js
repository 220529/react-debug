import * as React from 'react';
import { useState, useEffect } from "react"
import createContext from "./createContext"

const { Provider, useContext } = createContext({});
const ProviderApp = ({ children }) => {
  useEffect(() => {
    console.log("Provider.useEffect");
  }, [])
  const [color, setColor] = useState("red")
  return (
    <Provider state={{ color }} action={{ setColor }}>
      {children}
    </Provider>
  )
}


export default React.memo(ProviderApp)

export { useContext };