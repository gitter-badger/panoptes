const React = require('react');
const PureRenderMixin = require('mixins/PureRenderMixin');
const classNames = require('classnames');
const Icon = require('ui/Icon');

var Modal = React.createClass({
  mixins: [PureRenderMixin],

  propTypes: {
    visible: React.PropTypes.bool,
    closable: React.PropTypes.bool,
    title: React.PropTypes.string, //Used in title bar
    faIcon: React.PropTypes.string,
    onClose: React.PropTypes.func
  },

  getDefaultProps() {
    return {
      onClose: function () {
      },
      closable: true,
      visible: true
    };
  },

  handleClose(e) {
    e.preventDefault();
    e.stopPropagation();
    this.props.onClose();
  },

  handleOverlayClick(e) {
    if (e.target === this.refs.overlay.getDOMNode() && this.props.closable) {
      e.preventDefault();
      e.stopPropagation();
      if (this.props.onClose)
        this.props.onClose();
    }
  },

  render: function () {
    let { visible, closable, onClose, faIcon, title, children, ...other } = this.props;
    let classes = {
      modal: true,
      visible: visible
    };
    return (
      <div className={classNames(classes)}
           ref='overlay'
           onClick={this.handleOverlayClick}>
        <div className="popup"
          {...other}>
          <div className="popup-header">
            {faIcon ? <Icon name={faIcon}/> : null}
            <div className="title">{title}</div>
            <Icon className="pointer close" name="close" onClick={this.handleClose}/>
          </div>
          <div className="popup-body">
            {children}
          </div>
        </div>
      </div>)
  }
});

module.exports = Modal;
