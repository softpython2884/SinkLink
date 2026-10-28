import { App } from './app.js';

const root = document.querySelector('.app');

try {
  window.sinklink = new App(root);
} catch (error) {
  console.error(error);
  root.classList.add('is-unsupported');
  root.querySelector('.unsupported__detail').textContent = error.message;
}
