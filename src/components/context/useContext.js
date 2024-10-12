class Store {
  constructor() {
    this.subscriptions = []
  }

  publish(value) {
    this.subscriptions.forEach(f => f(value))
  }

  subscribe(f) {
    this.subscriptions.push(f)
  }
}

function createContext(defaultValue) {
  const store = new Store();

  // Provider
  class Provider extends React.PureComponent {
    componentDidUpdate() {
      store.publish(this.props.value);
    }

    componentDidMount() {
      store.publish(this.props.value);
    }

    render() {
      return this.props.children;
    }
  }

  // Consumer
  class Consumer extends React.PureComponent {
    constructor(props) {
      super(props);
      this.state = {
        value: defaultValue
      };

      store.subscribe(value => {
        this.setState({
          value
        });
      });
    }

    render() {
      return this.props.children(this.state.value);
    }
  }

  return {
    Provider,
    Consumer
  };
}
