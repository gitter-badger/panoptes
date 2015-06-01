const Fluxxor = require('fluxxor');
const Immutable = require('immutable');

const Constants = require('../constants/Constants');
const LAYOUT = Constants.LAYOUT;

var LayoutStore = Fluxxor.createStore({

  initialize() {
    this.state = Immutable.fromJS({
      components: {
        'T1': {
          component: 'ui/HelloWorld',
          title: 'WTF TAB',
          faIcon: 'bookmark',
          props: {
            msg: 'WTF'
          }
        },
        'T2': {
          component: 'ui/HelloWorld',
          title: 'OMG TAB',
          faIcon: 'bookmark',
          props: {
            msg: 'OMG'
          }
        },
        'P1': {
          component: 'ui/HelloWorld',
          title: 'WTF POP',
          faIcon: 'bookmark',
          props: {
            msg: 'WTF'
          }
        },
        'P2': {
          component: 'ui/HelloWorld',
          title: 'OMG POP',
          faIcon: 'bookmark',
          initPosition: {
            x: 500,
            y: 100
          },
          initSize: {
            width: 300,
            height: 200
          },
          props: {
            msg: 'OMG'
          }
        }
      },
      tabs: {
        selectedTab: 'T1',
        components: ['T1', 'T2']
      },
      popups: {
        components: ['P1', 'P2']

      },
      modal: {
        component: 'ui/HelloWorld',
        props: {
          msg: 'MODAL IN YOUR FACE!'
        }
      }
    });

    this.bindActions(
      LAYOUT.MODAL_CLOSE, this.modalClose,
      LAYOUT.NOTIFY, this.notify,
      LAYOUT.POPUP_MOVE, this.popupMove,
      LAYOUT.POPUP_RESIZE, this.popupResize,
      LAYOUT.TAB_SWITCH, this.tabSwitch
    );
  },

  modalClose() {
    this.state = this.state.set('modal', Immutable.Map());
    this.emit('change');
  },

  notify(payload) {
    this.lastNotification = payload;
    this.emit('notify');
  },

  popupMove(payload) {
    let {compId, pos} = payload;
    this.state = this.state.mergeIn(['components', compId, 'initPosition'], pos);
    this.emit('change');
  },

  popupResize(payload) {
    let {compId, size} = payload;
    this.state = this.state.mergeIn(['components', compId, 'initSize'], size);
    this.emit('change');
  },

  tabSwitch(payload) {
    this.state = this.state.setIn(['tabs', 'selectedTab'], payload.compId);
    this.emit('change');
  },

  getState() {
    return this.state;
  },

  getLastNotification() {
    return this.lastNotification;
  }


});

module.exports = LayoutStore;
