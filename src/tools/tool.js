// Base class for the editing tools. A tool owns its side panel and, optionally,
// draws handles over the photo and reacts to pointer input on it.
//
//   mount(el)            build the panel
//   sync(edit)           reflect the current edit in the panel
//   renderOptions()      options passed to the renderer (e.g. show the full frame)
//   overlay(view)        SVG markup drawn over the photo
//   pointerDown(p, e)    return true to take the drag, false to let the view pan
//   pointerMove / pointerUp / hover
export class Tool {
  constructor(app, { id, label, icon, hint = '' }) {
    this.app = app;
    this.id = id;
    this.label = label;
    this.icon = icon;
    this.hint = hint;
  }

  mount() {}

  unmount() {}

  sync() {}

  renderOptions() {
    return {};
  }

  overlay() {
    return '';
  }

  pointerDown() {
    return false;
  }

  keyDown() {
    return false;
  }
}
