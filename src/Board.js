import React from 'react';
import Dragula from 'dragula';
import 'dragula/dist/dragula.css';
import Swimlane from './Swimlane';
import './Board.css';

export default class Board extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      clients: this.groupClientsByStatus(this.getClients()),
    };
    this.swimlanes = {
      backlog: React.createRef(),
      inProgress: React.createRef(),
      complete: React.createRef(),
    };
    this.drake = null;
  }

  componentDidMount() {
    // Dragula works on real DOM nodes, so it can only be wired up once the
    // swimlanes have rendered and the refs point at their drag columns.
    this.drake = Dragula([
      this.swimlanes.backlog.current,
      this.swimlanes.inProgress.current,
      this.swimlanes.complete.current,
    ], {
      // A card dropped outside every swimlane snaps back to where it came from.
      revertOnSpill: true,
    });
    this.drake.on('drop', (el, target, source, sibling) => {
      this.handleDrop(el, target, source, sibling);
    });
    this.drake.on('cancel', (el, container, source) => {
      this.handleCancel(el, source);
    });
  }

  componentWillUnmount() {
    if (this.drake) {
      this.drake.destroy();
      this.drake = null;
    }
  }

  getClients() {
    return [
      ['1','Stark, White and Abbott','Cloned Optimal Architecture', 'backlog'],
      ['2','Wiza LLC','Exclusive Bandwidth-Monitored Implementation', 'backlog'],
      ['3','Nolan LLC','Vision-Oriented 4Thgeneration Graphicaluserinterface', 'backlog'],
      ['4','Thompson PLC','Streamlined Regional Knowledgeuser', 'backlog'],
      ['5','Walker-Williamson','Team-Oriented 6Thgeneration Matrix', 'backlog'],
      ['6','Boehm and Sons','Automated Systematic Paradigm', 'backlog'],
      ['7','Runolfsson, Hegmann and Block','Integrated Transitional Strategy', 'backlog'],
      ['8','Schumm-Labadie','Operative Heuristic Challenge', 'backlog'],
      ['9','Kohler Group','Re-Contextualized Multi-Tasking Attitude', 'backlog'],
      ['10','Romaguera Inc','Managed Foreground Toolset', 'backlog'],
      ['11','Reilly-King','Future-Proofed Interactive Toolset', 'backlog'],
      ['12','Emard, Champlin and Runolfsdottir','Devolved Needs-Based Capability', 'backlog'],
      ['13','Fritsch, Cronin and Wolff','Open-Source 3Rdgeneration Website', 'backlog'],
      ['14','Borer LLC','Profit-Focused Incremental Orchestration', 'backlog'],
      ['15','Emmerich-Ankunding','User-Centric Stable Extranet', 'backlog'],
      ['16','Willms-Abbott','Progressive Bandwidth-Monitored Access', 'backlog'],
      ['17','Brekke PLC','Intuitive User-Facing Customerloyalty', 'backlog'],
      ['18','Bins, Toy and Klocko','Integrated Assymetric Software', 'backlog'],
      ['19','Hodkiewicz-Hayes','Programmable Systematic Securedline', 'backlog'],
      ['20','Murphy, Lang and Ferry','Organized Explicit Access', 'backlog'],
    ].map(companyDetails => ({
      id: companyDetails[0],
      name: companyDetails[1],
      description: companyDetails[2],
      status: companyDetails[3],
    }));
  }

  /**
   * Splits a flat, ordered list of clients into the three swimlanes.
   * The relative order of the clients is preserved within each lane.
   */
  groupClientsByStatus(clients) {
    return {
      backlog: clients.filter(client => !client.status || client.status === 'backlog'),
      inProgress: clients.filter(client => client.status === 'in-progress'),
      complete: clients.filter(client => client.status === 'complete'),
    };
  }

  /**
   * Maps a swimlane's drag column (the DOM node Dragula reports as the drop
   * target) back to the status a card in that lane should have.
   */
  getStatusForSwimlane(swimlaneEl) {
    if (swimlaneEl === this.swimlanes.inProgress.current) {
      return 'in-progress';
    }
    if (swimlaneEl === this.swimlanes.complete.current) {
      return 'complete';
    }
    return 'backlog';
  }

  /**
   * Called by Dragula after a card has been dropped.
   *
   * Dragula has already moved the card's DOM node, but React knows nothing
   * about that and would get out of sync with the DOM on its next render. So
   * we undo Dragula's DOM change, then update React state to reflect the move;
   * React re-renders the card in its new lane with its new status (and colour).
   */
  handleDrop(el, target, source, sibling) {
    // This only works because Dragula emits 'drop' synchronously, before its
    // own cleanup, so drake.dragging is still true here; called any later,
    // cancel() is a silent no-op. `true` is passed on purpose: a bare cancel()
    // falls back to the revertOnSpill option, and when that is false it
    // re-emits 'drop', which would recurse straight back into this handler.
    // Side effect to know about: Dragula's cleanup then runs a second time and
    // emits one extra 'dragend' whose element is null.
    this.drake.cancel(true);

    const movedId = el.dataset.id;
    const siblingId = sibling ? sibling.dataset.id : null;
    const newStatus = this.getStatusForSwimlane(target);

    const { backlog, inProgress, complete } = this.state.clients;
    const allClients = [...backlog, ...inProgress, ...complete];
    const movedClient = allClients.find(client => client.id === movedId);
    if (!movedClient) {
      return;
    }

    // Take the card out of its old spot and give it the status of its new lane.
    const remainingClients = allClients.filter(client => client.id !== movedId);
    const updatedClient = { ...movedClient, status: newStatus };

    // `sibling` is the card that now sits directly below the dropped card, or
    // null when it was dropped at the bottom of a lane. Inserting just before
    // that card keeps the ordering the user chose.
    let insertAt = remainingClients.length;
    if (siblingId !== null) {
      const siblingIndex = remainingClients.findIndex(client => client.id === siblingId);
      if (siblingIndex !== -1) {
        insertAt = siblingIndex;
      }
    }
    remainingClients.splice(insertAt, 0, updatedClient);

    this.setState({
      clients: this.groupClientsByStatus(remainingClients),
    });
  }

  /**
   * Called by Dragula when a drag ends without a drop: the card was released
   * outside every lane, or back on the spot it started from.
   *
   * Dragula decides "back where it started" from its own sibling bookkeeping,
   * not from where the card's DOM node actually is. The two can disagree in one
   * rare case: a card that was last in its lane is appended to another lane,
   * and the mouse is then released over the original lane with no mousemove in
   * between (for instance after scrolling with the pointer held still). Dragula
   * then emits 'cancel' but leaves the node in the other lane, which would put
   * the DOM out of step with React state and break the next re-render. Asking
   * Dragula to cancel again with an explicit revert puts the node back.
   */
  handleCancel(el, source) {
    if (el.parentNode !== source) {
      this.drake.cancel(true);
    }
  }

  renderSwimlane(name, clients, ref) {
    return (
      <Swimlane name={name} clients={clients} dragulaRef={ref}/>
    );
  }

  render() {
    return (
      <div className="Board">
        <div className="container-fluid">
          <div className="row">
            <div className="col-md-4">
              {this.renderSwimlane('Backlog', this.state.clients.backlog, this.swimlanes.backlog)}
            </div>
            <div className="col-md-4">
              {this.renderSwimlane('In Progress', this.state.clients.inProgress, this.swimlanes.inProgress)}
            </div>
            <div className="col-md-4">
              {this.renderSwimlane('Complete', this.state.clients.complete, this.swimlanes.complete)}
            </div>
          </div>
        </div>
      </div>
    );
  }
}
