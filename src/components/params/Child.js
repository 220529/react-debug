import { useState } from 'react';

const ChildComponent = ({ name, setName }) => {
    const [greeting, setGreeting] = useState('Hello');

    const handleGreetingChange = () => {
        setGreeting('Hola');
    };

    const handleNameChange = () => {
        setName('John Doe');
    };

    return (
        <div>
            <span>Child Component</span>
            <p>{greeting}, {name}!</p>
            <button onClick={handleGreetingChange}>Change Greeting</button>
            <button onClick={handleNameChange}>Change Name in Parent</button>
        </div>
    );
};

export default ChildComponent;
