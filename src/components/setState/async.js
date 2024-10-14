import React, { Component } from "react";

export default class TestSetState extends Component {
  state = {
    count: 0,
  };

  // React 合成事件：异步
  handleReactEvent = () => {
    this.setState({ count: this.state.count + 1 });
    console.log("React Event Count:", this.state.count); // 异步，输出旧值
  };

  // setTimeout：同步
  handleTimeout = () => {
    setTimeout(() => {
      this.setState({ count: this.state.count + 1 });
      this.setState({ count: this.state.count + 1 });
      console.log("setTimeout Count:", this.state.count); // 同步，输出新值
    }, 0);
  };

  // Promise.then：同步
  handlePromise = () => {
    Promise.resolve().then(() => {
      this.setState({ count: this.state.count + 1 });
      console.log("Promise Count:", this.state.count); // 同步，输出新值
    });
  };

  // 原生事件：同步
  componentDidMount() {
    document.getElementById("nativeButton").addEventListener("click", () => {
      this.setState({ count: this.state.count + 1 });
      console.log("Native Event Count:", this.state.count); // 同步，输出新值
    });
  }

  // Async/Await：同步
  handleAsyncAwait = async () => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    this.setState({ count: this.state.count + 1 });
    console.log("Async/Await Count:", this.state.count); // 同步，输出新值
  };

  render() {
    return (
      <div>
        <p>Count: {this.state.count}</p>

        {/* React 合成事件 */}
        <button onClick={this.handleReactEvent}>React Event</button>

        {/* setTimeout 测试 */}
        <button onClick={this.handleTimeout}>setTimeout</button>

        {/* Promise.then 测试 */}
        <button onClick={this.handlePromise}>Promise</button>

        {/* Async/Await 测试 */}
        <button onClick={this.handleAsyncAwait}>Async/Await</button>

        {/* 原生事件 */}
        <button id="nativeButton">Native Event (addEventListener)</button>
      </div>
    );
  }
}
