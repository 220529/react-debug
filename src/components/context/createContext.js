import * as React from 'react';
import { useEffect } from "react";

const createContext = (config) => {
  const { initialState } = config;

  const StateContext = React.createContext(initialState);

  const Provider = props => {
    useEffect(() => {
      console.log("createContext.useEffect");
    }, []);
    return (
      <StateContext.Provider value={{
        state: props.state,
        action: props.action,
      }}>
        {props.children}
      </StateContext.Provider>
    );
  };

  const useContext = () => {
    return { stateContext: React.useContext(StateContext) };
  };

  return {
    Provider,
    useContext,
  };
};

export default createContext