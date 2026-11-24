const Input = {
  keys: {},
  init() {
    addEventListener('keydown', (e) => {
      Input.keys[e.code] = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
    });
    addEventListener('keyup', (e) => {
      Input.keys[e.code] = false;
    });
    addEventListener('blur', () => {
      Input.keys = {};
    });
  },
};
