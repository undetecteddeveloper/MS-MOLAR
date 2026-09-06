// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { isBackgroundTarget } from "./tap";

// jsdom không áp class Tailwind, nên nền tô mô phỏng bằng style inline — đúng
// thứ isBackgroundTarget đọc qua getComputedStyle.
function mount(html: string): HTMLElement {
  document.body.innerHTML = `<div id="root" style="background-color:#fff">${html}</div>`;
  return document.getElementById("root") as HTMLElement;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("isBackgroundTarget — chỉ khoảng trắng mới là nền", () => {
  it("khối trong suốt, không chữ trực tiếp → nền", () => {
    const root = mount('<main><section id="gap"><p>chữ</p></section></main>');
    expect(isBackgroundTarget(root.querySelector("#gap"), root)).toBe(true);
    expect(isBackgroundTarget(root.querySelector("main"), root)).toBe(true);
  });

  it("chữ → không", () => {
    const root = mount("<section><h1 id=h>Luyện đề</h1><p id=p>dẫn</p><span id=s>x</span></section>");
    for (const id of ["h", "p", "s"]) {
      expect(isBackgroundTarget(root.querySelector(`#${id}`), root)).toBe(false);
    }
  });

  it("khối có nền tô, hoặc nằm TRONG khối có nền tô → không", () => {
    const root = mount(
      '<ul><li id="card" style="background-color:#eef7f1"><span id="inner"><b>Next.js</b></span></li></ul>',
    );
    expect(isBackgroundTarget(root.querySelector("#card"), root)).toBe(false);
    expect(isBackgroundTarget(root.querySelector("#inner"), root)).toBe(false);
  });

  it("nút, liên kết, ô nhập, hình → không", () => {
    const root = mount(
      '<a id=a href="/x"><span id=as></span></a><button id=b></button><input id=i><svg id=svg><path id=path/></svg><img id=img alt="">',
    );
    for (const id of ["a", "as", "b", "i", "svg", "path", "img"]) {
      expect(isBackgroundTarget(root.querySelector(`#${id}`), root)).toBe(false);
    }
  });

  it("nền trắng của chính root không tính là vật che", () => {
    const root = mount('<div id="wrap"></div>');
    expect(isBackgroundTarget(root.querySelector("#wrap"), root)).toBe(true);
  });

  it("không phải Element → không", () => {
    const root = mount("");
    expect(isBackgroundTarget(null, root)).toBe(false);
    expect(isBackgroundTarget(document, root)).toBe(false);
  });
});
