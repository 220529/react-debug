import * as React from 'react';

class ChildComponent extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      childData: "Child Initial Data",
    };
    console.log("Child: constructor");
  }

  static getDerivedStateFromProps(nextProps, prevState) {
    console.log("Child: getDerivedStateFromProps");
    return null; // 不修改 state
  }

  componentDidMount() {
    console.log("Child: componentDidMount");
  }

  shouldComponentUpdate(nextProps, nextState) {
    console.log("Child: shouldComponentUpdate");
    return true;
  }

  componentDidUpdate(prevProps, prevState) {
    console.log("Child: componentDidUpdate");
  }

  componentWillUnmount() {
    console.log("Child: componentWillUnmount");
  }

  render() {
    console.log("Child: render");
    return (
      <div>
        <p>子组件数据：{this.props.parentData}</p>
        <p>子组件内部数据：{this.state.childData}</p>
      </div>
    );
  }
}

class ParentComponent extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      parentData: "Parent Initial Data",
    };
    console.log("Parent: constructor");
  }

  static getDerivedStateFromProps(nextProps, prevState) {
    console.log("Parent: getDerivedStateFromProps");
    return null; // 不修改 state
  }

  componentDidMount() {
    console.log("Parent: componentDidMount");
  }

  shouldComponentUpdate(nextProps, nextState) {
    console.log("Parent: shouldComponentUpdate");
    return true;
  }

  componentDidUpdate(prevProps, prevState) {
    console.log("Parent: componentDidUpdate");
  }

  componentWillUnmount() {
    console.log("Parent: componentWillUnmount");
  }

  updateData = () => {
    this.setState({ parentData: "Parent Updated Data" });
  };

  render() {
    console.log("Parent: render");
    return (
      <div>
        <p>父组件数据：{this.state.parentData}</p>
        <button onClick={this.updateData}>更新父组件数据</button>
        <ChildComponent parentData={this.state.parentData} />
      </div>
    );
  }
}

export default ParentComponent;
