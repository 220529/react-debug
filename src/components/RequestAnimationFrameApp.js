import * as React from 'react';

let previousTimeStamp = 0;
const now = () => performance.now();
class App extends React.Component {
  componentDidMount() {

    const test = document.querySelector("#test");
    let cancelReq;

    document.querySelector('#start').addEventListener('click', () => {
      animation()
    });

    document.querySelector('#stop').addEventListener('click', () => {
      window.cancelAnimationFrame(cancelReq);
    });

    let count = 0;
    // function animation() {
    //   if (count > 200) return;

    //   test.style.marginLeft = `${count}px`;
    //   count++;
    //   cancelReq = window.requestAnimationFrame(animation);
    // }


    // function animation(timestamp) {

    //   if (previousTimeStamp) {
    //     const elapsed = timestamp - previousTimeStamp;
    //     console.log(elapsed);
    //   }
    //   previousTimeStamp = timestamp

    //   window.requestAnimationFrame(animation);
    // }

    // function animation(timestamp) {
    //   if (count > 200) return;

    //   const elapsed = timestamp - previousTimeStamp;
    //   // console.log("elapsed", timestamp, elapsed);

    //   if (elapsed > 30) {
    //     test.style.marginLeft = `${count}px`;
    //     count++;
    //     previousTimeStamp = timestamp;
    //     console.log(elapsed)
    //   }

    //   requestAnimationFrame(animation);
    // }

    // function animation() {
    //   if (count > 200) return;

    //   test.style.marginLeft = `${count}px`;
    //   count++;

    //   setTimeout(animation, 0);
    // }

    function animation() {
      if (count > 1000) return;

      test.style.marginLeft = `${count}px`;
      count++;

      const elapsed = now() - previousTimeStamp;
      console.log(elapsed);
      previousTimeStamp = now()

      requestAnimationFrame(animation, 0);
    }

    // const test = document.querySelector("#test");
    // test.style.transform = 'translate(0, 0)';

    // document.querySelector('button').addEventListener('click', () => {

    //   test.style.transform = 'translate(400px, 0)';

    //   requestAnimationFrame(() => {
    //     test.style.transition = 'transform 3s linear';
    //     test.style.transform = 'translate(200px, 0)';
    //   });

    //   requestAnimationFrame(() => {
    //     requestAnimationFrame(() => {
    //       test.style.transition = 'transform 3s linear';
    //       test.style.transform = 'translate(200px, 0)';
    //     });
    //   })


    // });


  }
  render() {
    return (
      <div>
        <button id="start" style={{ marginBottom: '10px' }}>开始</button>
        <button id="stop" style={{ marginBottom: '10px' }}>停止</button>
        <div id="test" style={{ width: '100px', height: '100px', backgroundColor: '#333' }} />
      </div>
    )
  }
}

export default App
