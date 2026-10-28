// 키보드(방향키/WASD)와 화면 드래그(가상 조이스틱)를 같은 방향 벡터로 합친다.
// 한글 자판에서도 동작하도록 e.key 대신 e.code를 쓴다.

const DIRS = {
  ArrowLeft: [-1, 0], KeyA: [-1, 0],
  ArrowRight: [1, 0], KeyD: [1, 0],
  ArrowUp: [0, -1], KeyW: [0, -1],
  ArrowDown: [0, 1], KeyS: [0, 1],
};

export function createInput(canvas, stickEl) {
  const held = new Set();
  const stick = { id: null, ox: 0, oy: 0, dx: 0, dy: 0 };
  const knob = stickEl.querySelector('.knob');

  addEventListener('keydown', (e) => {
    if (DIRS[e.code]) {
      held.add(e.code);
      e.preventDefault();
    }
  });
  addEventListener('keyup', (e) => held.delete(e.code));
  addEventListener('blur', () => held.clear());

  function drawStick() {
    const len = Math.hypot(stick.dx, stick.dy);
    const k = len > 40 ? 40 / len : 1;
    knob.style.transform = `translate(${stick.dx * k}px, ${stick.dy * k}px)`;
  }

  canvas.addEventListener('pointerdown', (e) => {
    stick.id = e.pointerId;
    stick.ox = e.clientX;
    stick.oy = e.clientY;
    stick.dx = stick.dy = 0;
    canvas.setPointerCapture(e.pointerId);
    stickEl.style.left = `${e.clientX}px`;
    stickEl.style.top = `${e.clientY}px`;
    stickEl.hidden = false;
    drawStick();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== stick.id) return;
    stick.dx = e.clientX - stick.ox;
    stick.dy = e.clientY - stick.oy;
    drawStick();
  });
  const end = (e) => {
    if (e.pointerId !== stick.id) return;
    stick.id = null;
    stickEl.hidden = true;
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  return {
    vector() {
      if (stick.id !== null) {
        const len = Math.hypot(stick.dx, stick.dy);
        if (len < 8) return { x: 0, y: 0 };
        const k = Math.min(1, len / 40) / len;
        return { x: stick.dx * k, y: stick.dy * k };
      }
      let x = 0, y = 0;
      for (const code of held) {
        x += DIRS[code][0];
        y += DIRS[code][1];
      }
      const len = Math.hypot(x, y);
      return len ? { x: x / len, y: y / len } : { x: 0, y: 0 };
    },
    release() {
      held.clear();
      stick.id = null;
      stickEl.hidden = true;
    },
  };
}
