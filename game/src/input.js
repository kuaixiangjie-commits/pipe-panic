// Keyboard input: held keys for movement, edge-triggered presses for menus.
export class Input {
  constructor() {
    this.down = new Set();
    this.pressed = new Set();
    this.onKeyDown = (e) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
        e.preventDefault();
      }
      if (!e.repeat) this.pressed.add(e.code);
      this.down.add(e.code);
    };
    this.onKeyUp = (e) => {
      this.down.delete(e.code);
    };
    this.onBlur = () => {
      this.down.clear();
    };
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
  }

  isDown(code) {
    return this.down.has(code);
  }

  // True once per physical press; the frame loop clears the queue each frame.
  consume(code) {
    if (this.pressed.has(code)) {
      this.pressed.delete(code);
      return true;
    }
    return false;
  }

  endFrame() {
    this.pressed.clear();
  }

  // Normalised WASD / arrow-key direction.
  dir() {
    let x = 0;
    let y = 0;
    if (this.down.has("KeyA") || this.down.has("ArrowLeft")) x -= 1;
    if (this.down.has("KeyD") || this.down.has("ArrowRight")) x += 1;
    if (this.down.has("KeyW") || this.down.has("ArrowUp")) y -= 1;
    if (this.down.has("KeyS") || this.down.has("ArrowDown")) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.hypot(x, y);
      x *= inv;
      y *= inv;
    }
    return { x, y };
  }
}
