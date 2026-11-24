// Pipe Panic! — keyboard and mouse input state.
export class Input {
  constructor() {
    this.down = new Set();
    this.pressed = new Set();
    this.clicked = false;
    this._onKeyDown = (e) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
        e.preventDefault();
      }
      if (!e.repeat) {
        this.down.add(e.code);
        this.pressed.add(e.code);
      }
    };
    this._onKeyUp = (e) => {
      this.down.delete(e.code);
    };
    this._onClick = () => {
      this.clicked = true;
    };
    this._onBlur = () => {
      this.down.clear();
    };
    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("keyup", this._onKeyUp);
    window.addEventListener("mousedown", this._onClick);
    window.addEventListener("blur", this._onBlur);
  }

  isDown(...codes) {
    return codes.some((c) => this.down.has(c));
  }

  wasPressed(code) {
    return this.pressed.has(code);
  }

  wasClicked() {
    return this.clicked;
  }

  // Call once per frame, after the game has read the edge-triggered state.
  endFrame() {
    this.pressed.clear();
    this.clicked = false;
  }
}
