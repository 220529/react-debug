import * as React from "react";

class App extends React.Component {
  constructor() {
    super();
    this.state = {
      val: 0,
    };
  }

  clickHandler = () => {
    console.log("--- start ---");

    Promise.resolve().then(() => console.log("promise then") /* callback */);

    // “异步”
    this.setState(
      { val: this.state.val + 1 },
      () => {
        console.log("state...", this.state);
      } // callback
    );

    console.log("--- end ---");
  };

  componentDidMount() {
    setTimeout(() => {
      console.log("--- start ---");
      Promise.resolve().then(() => console.log("promise then"));
      this.setState({ val: this.state.val + 1 });
      console.log("state...", this.state);
      console.log("--- end ---");
    });
  }

  render() {
    return (
      <p id="p1" onClick={this.clickHandler}>
        setState demo: {this.state.val}
      </p>
    );
  }
}

export default App;
