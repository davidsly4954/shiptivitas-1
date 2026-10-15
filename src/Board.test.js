import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import Board from './Board';

describe('Board kanban', () => {
  let container;
  let board;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    const ref = React.createRef();
    act(() => {
      ReactDOM.render(<Board ref={ref} />, container);
    });
    board = ref.current;
  });

  afterEach(() => {
    act(() => {
      ReactDOM.unmountComponentAtNode(container);
    });
    container.remove();
    delete document.elementFromPoint;
  });

  const lanes = () => Array.from(container.querySelectorAll('.Swimlane-column'));
  const cardsIn = lane => Array.from(lane.querySelectorAll('.Card'));
  const idsIn = lane => cardsIn(lane).map(card => card.dataset.id);
  const leftovers = () => document.querySelectorAll('.gu-mirror, .gu-transit');

  // Fires Dragula's 'drop' event directly, as if `card` had been dropped into
  // `targetColumn` directly above `sibling` (null = bottom of the lane).
  // This bypasses Dragula's own mouse handling, so Dragula never moves the DOM
  // node and the revert in handleDrop is a no-op: these tests cover only the
  // state arithmetic. `realDrag` below covers the DOM side.
  const drop = (card, targetColumn, sibling = null) => {
    act(() => {
      board.drake.emit('drop', card, targetColumn, card.parentElement, sibling);
    });
  };

  // Drives Dragula with real mouse events. jsdom has no layout, so
  // document.elementFromPoint (which Dragula uses to find what is under the
  // pointer) is stubbed: `over` is what the pointer is over while it moves and
  // `releaseOver` what it is over when the button is released. Every element
  // has a zero-size rect in jsdom, so a card the pointer is "over" counts as
  // being below the pointer and the dragged card is placed above it.
  const mouse = (type, target, x, y) => {
    target.dispatchEvent(new MouseEvent(type, {
      bubbles: true, cancelable: true, button: 0, buttons: 1, clientX: x, clientY: y,
    }));
  };
  const realDrag = (card, over, releaseOver = over) => {
    act(() => {
      document.elementFromPoint = () => over;
      mouse('mousedown', card, 10, 10);
      mouse('mousemove', document.documentElement, 300, 0);
      document.elementFromPoint = () => releaseOver;
      mouse('mouseup', document.documentElement, 300, 0);
    });
  };

  it('renders three swimlanes with the Swimlane-column class', () => {
    expect(lanes()).toHaveLength(3);
    const titles = Array.from(container.querySelectorAll('.Swimlane-title')).map(el => el.textContent);
    expect(titles).toEqual(['Backlog', 'In Progress', 'Complete']);
  });

  it('starts with every client in the backlog, coloured grey', () => {
    const [backlog, inProgress, complete] = lanes();
    expect(cardsIn(backlog)).toHaveLength(20);
    expect(cardsIn(inProgress)).toHaveLength(0);
    expect(cardsIn(complete)).toHaveLength(0);
    cardsIn(backlog).forEach(card => {
      expect(card.dataset.status).toBe('backlog');
      expect(card.classList.contains('Card-grey')).toBe(true);
    });
  });

  it('moves a card into the lane it was dropped in and recolours it', () => {
    const card = cardsIn(lanes()[0])[0];
    expect(card.dataset.id).toBe('1');

    drop(card, board.swimlanes.inProgress.current);

    expect(idsIn(lanes()[0])).not.toContain('1');
    const inProgressCard = lanes()[1].querySelector('.Card[data-id="1"]');
    expect(inProgressCard).not.toBeNull();
    expect(inProgressCard.dataset.status).toBe('in-progress');
    expect(inProgressCard.classList.contains('Card-blue')).toBe(true);
    expect(inProgressCard.classList.contains('Card-grey')).toBe(false);

    drop(inProgressCard, board.swimlanes.complete.current);

    expect(idsIn(lanes()[1])).not.toContain('1');
    const completeCard = lanes()[2].querySelector('.Card[data-id="1"]');
    expect(completeCard).not.toBeNull();
    expect(completeCard.dataset.status).toBe('complete');
    expect(completeCard.classList.contains('Card-green')).toBe(true);
  });

  it('places a dropped card directly above the sibling Dragula reports', () => {
    const [first, , third] = cardsIn(lanes()[0]);

    // Drag card 3 up and drop it on top of card 1 (so card 1 becomes its sibling).
    drop(third, board.swimlanes.backlog.current, first);

    expect(idsIn(lanes()[0]).slice(0, 4)).toEqual(['3', '1', '2', '4']);
  });

  it('places a dropped card at the bottom of the lane when there is no sibling', () => {
    const first = cardsIn(lanes()[0])[0];

    drop(first, board.swimlanes.backlog.current, null);

    const ids = idsIn(lanes()[0]);
    expect(ids).toHaveLength(20);
    expect(ids[ids.length - 1]).toBe('1');
    expect(ids[0]).toBe('2');
  });

  it('orders cards within a lane by where they were dropped across lanes', () => {
    const backlogCards = cardsIn(lanes()[0]);
    const complete = board.swimlanes.complete.current;

    drop(backlogCards[4], complete);          // card 5 -> complete (bottom)
    drop(cardsIn(lanes()[0])[1], complete);   // card 2 -> complete (bottom)
    const cardFive = lanes()[2].querySelector('.Card[data-id="5"]');
    drop(cardsIn(lanes()[0])[0], complete, cardFive); // card 1 -> complete, above card 5

    expect(idsIn(lanes()[2])).toEqual(['1', '5', '2']);
    expect(idsIn(lanes()[0])).toHaveLength(17);
    expect(idsIn(lanes()[0])).not.toContain('1');
    expect(idsIn(lanes()[0])).not.toContain('2');
    expect(idsIn(lanes()[0])).not.toContain('5');
  });

  it('never loses or duplicates a client while cards move around', () => {
    drop(cardsIn(lanes()[0])[0], board.swimlanes.inProgress.current);
    drop(cardsIn(lanes()[0])[0], board.swimlanes.complete.current);
    drop(cardsIn(lanes()[1])[0], board.swimlanes.complete.current);
    drop(cardsIn(lanes()[2])[0], board.swimlanes.backlog.current);

    const allIds = lanes().flatMap(idsIn);
    expect(allIds).toHaveLength(20);
    expect(new Set(allIds).size).toBe(20);
  });

  it('keeps React and the DOM in sync after a real Dragula drag into another lane', () => {
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      realDrag(cardsIn(lanes()[0])[0], board.swimlanes.inProgress.current);

      expect(board.drake.dragging).toBe(false);
      expect(container.querySelectorAll('.Card[data-id="1"]')).toHaveLength(1);
      const moved = lanes()[1].querySelector('.Card[data-id="1"]');
      expect(moved).not.toBeNull();
      expect(moved.classList.contains('Card-blue')).toBe(true);
      expect(idsIn(lanes()[0])).toHaveLength(19);
      expect(leftovers()).toHaveLength(0);
      expect(errors).not.toHaveBeenCalled();
    } finally {
      errors.mockRestore();
    }
  });

  it('reorders a card above the card it is dropped on in a real Dragula drag', () => {
    const [first, , third] = cardsIn(lanes()[0]);

    realDrag(third, first);

    expect(idsIn(lanes()[0]).slice(0, 4)).toEqual(['3', '1', '2', '4']);
    expect(leftovers()).toHaveLength(0);
  });

  it('puts a card back when Dragula cancels a drag without reverting its own DOM move', () => {
    const backlog = board.swimlanes.backlog.current;
    const inProgress = board.swimlanes.inProgress.current;
    const last = cardsIn(lanes()[0])[19];
    expect(last.dataset.id).toBe('20');

    // While the pointer moves, Dragula appends the last backlog card to the
    // empty In Progress lane; the button is then released over Backlog with no
    // mousemove there first. Dragula's bookkeeping now says the card is back
    // where it started, so it emits 'cancel' and does not move the node back.
    realDrag(last, inProgress, backlog);

    expect(board.drake.dragging).toBe(false);
    expect(last.parentNode).toBe(backlog);
    expect(cardsIn(inProgress)).toHaveLength(0);
    expect(idsIn(lanes()[0])).toHaveLength(20);
    expect(idsIn(lanes()[0])[19]).toBe('20');
    expect(leftovers()).toHaveLength(0);

    // The board still works normally afterwards.
    realDrag(last, inProgress);
    expect(lanes()[1].querySelector('.Card[data-id="20"]')).not.toBeNull();
    expect(idsIn(lanes()[0])).toHaveLength(19);
  });

  it('tears Dragula down when the board unmounts', () => {
    const destroy = jest.spyOn(board.drake, 'destroy');
    act(() => {
      ReactDOM.unmountComponentAtNode(container);
    });
    expect(destroy).toHaveBeenCalledTimes(1);
  });
});
