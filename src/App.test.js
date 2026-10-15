import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import App from './App';

it('renders without crashing', () => {
  const div = document.createElement('div');
  ReactDOM.render(<App />, div);
  ReactDOM.unmountComponentAtNode(div);
});

it('shows the kanban board on the Shipping Requests tab and survives switching tabs', () => {
  const container = document.body.appendChild(document.createElement('div'));
  act(() => {
    ReactDOM.render(<App />, container);
  });
  const clickTab = id => act(() => {
    container.querySelector(id).dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  const swimlanes = () => container.querySelectorAll('.Swimlane-column');

  expect(swimlanes()).toHaveLength(0);

  clickTab('#shipping-requests-tab');
  expect(swimlanes()).toHaveLength(3);
  expect(swimlanes()[0].querySelectorAll('.Card.Card-grey')).toHaveLength(20);

  clickTab('#home-tab');
  expect(swimlanes()).toHaveLength(0);

  clickTab('#shipping-requests-tab');
  expect(swimlanes()).toHaveLength(3);

  act(() => {
    ReactDOM.unmountComponentAtNode(container);
  });
  container.remove();
});
