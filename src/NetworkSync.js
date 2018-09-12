import React, { Fragment, Component } from "react";
import {
  ConnectionMenu,
  Wrapper,
  TokenInput,
  Row,
  Button,
  StatusText,
  Status
} from "./styles";
import createSlaveManager from "./SlaveManager";
import createMasterManager from "./MasterManager";
import SignalEffect from "./SignalEffect";
import QRCode from "qrcode.react";

const makeChannelName = token => `Spectacle:${token.toUpperCase()}`;

const initialState = () => ({
  showConnectionMenu: false,
  isInputDisabled: false,
  isSlave: false,
  isConnected: false,
  showsClicks: false,
  tokenInput: "",
  status: "",
  connectionStatus: "🔗",
  showShare: false
});

class NetworkSync extends Component {
  static defaultProps = {
    signalUri: "https://spectacle-signalling.now.sh"
  };

  state = initialState();

  componentDidMount = () => {
    const tokenInput = new URLSearchParams(window.location.search).get(
      "sessionToken"
    );
    if (tokenInput && !this.state.isConnected) {
      this.setState({ tokenInput }, this.joinSession);
    }
  };

  onClickClose = () => {
    this.setState({ showConnectionMenu: false, showShare: false });
  };

  onClickOpen = () => {
    this.setState({ showConnectionMenu: true });
  };

  onTokenChange = evt => {
    this.setState({ tokenInput: evt.target.value });
  };

  onSignalRef = ref => {
    this.signalRef = ref;
  };

  onTriggerSignal = evt => {
    if (this.masterManager) {
      this.masterManager.sendEvent("signal", evt);
    }
  };

  toggleClickTransmission = () => {
    const { showClicks } = this.state;
    this.setState({ showClicks: !showClicks });
  };

  joinSession = () => {
    const { tokenInput } = this.state;

    if (this.endSession) {
      this.endSession();
    }

    if (tokenInput.length !== 6) {
      return this.setState({
        status: "Invalid token 😢"
      });
    }

    if (this.props.onSlaveConnect) {
      this.props.onSlaveConnect();
    }

    this.setState({
      status: "Connecting... 🌍",
      isSlave: true,
      isInputDisabled: true
    });

    createSlaveManager({
      signalUri: this.props.signalUri,
      token: makeChannelName(tokenInput),
      setStatus: connectionStatus => this.setState({ connectionStatus })
    })
      .then(slaveManager => {
        this.setState({
          isConnected: true,
          status: "Connected 🎉"
        });

        const unsubscribe = slaveManager.subscribe((key, data) => {
          if (
            key === "signal" &&
            this.signalRef &&
            data.relativeX &&
            data.relativeY
          ) {
            this.signalRef.startRipple(data.relativeX, data.relativeY);
          }
        });

        this.endSession = () => {
          unsubscribe();
          slaveManager.destroy();
          this.endSession = undefined;

          if (this.props.onSlaveDisconnect) {
            this.props.onSlaveDisconnect();
          }
        };
      })
      .catch(err => {
        this.setState({
          isConnected: false,
          isInputDisabled: false,
          status: err.message
        });
      });
  };

  createSession = () => {
    const tokenInput = Math.random()
      .toString(26)
      .slice(-6)
      .toUpperCase();

    if (this.endSession) {
      this.endSession();
    }

    this.setState({
      status: "Connecting... 🌍",
      tokenInput,
      isSlave: false,
      isInputDisabled: true
    });

    createMasterManager({
      signalUri: this.props.signalUri,
      token: makeChannelName(tokenInput),
      setStatus: connectionStatus => this.setState({ connectionStatus })
    })
      .then(masterManager => {
        this.setState({
          isConnected: true,
          status: "Share the token with your viewers 📺"
        });

        this.masterManager = masterManager;

        this.endSession = () => {
          masterManager.destroy();
          this.endSession = undefined;
          this.masterManager = undefined;
        };
      })
      .catch(err => {
        this.setState({
          isConnected: false,
          isInputDisabled: false,
          status: err.message
        });
      });
  };

  disconnect = () => {
    if (this.endSession) {
      this.endSession();
    }

    this.setState({
      ...initialState(),
      showConnectionMenu: true
    });
  };

  share = () => {
    this.setState({ showShare: true });
  };

  componentWillUnmount() {
    if (this.endSession) {
      this.endSession();
    }
  }

  renderConnectionMenu() {
    const { isConnected, isSlave, showClicks } = this.state;
    const shareableLink = `${window.location.origin}/?sessionToken=${
      this.state.tokenInput
    }`;

    return (
      <ConnectionMenu onClick={this.onClickClose}>
        <Wrapper
          onClick={evt => {
            evt.stopPropagation();
          }}
        >
          <TokenInput
            type="text"
            placeholder="enter session token here"
            onChange={this.onTokenChange}
            value={this.state.tokenInput}
            disabled={this.state.isInputDisabled}
          />

          <Row>
            {!isConnected && (
              <Button onClick={this.joinSession}>Join Session</Button>
            )}
            {!isConnected && (
              <Button onClick={this.createSession}>Create Session</Button>
            )}

            {isConnected && (
              <Button onClick={this.disconnect}>Disconnect</Button>
            )}

            {isConnected &&
              !isSlave && (
                <Button onClick={this.toggleClickTransmission}>
                  {showClicks ? "Hide Clicks" : "Show Clicks"}
                </Button>
              )}

            {isConnected && <Button onClick={this.share}>Share</Button>}
          </Row>

          <StatusText capped>{this.state.status}</StatusText>

          {this.state.showShare && (
            <Fragment>
              <StatusText>{shareableLink}</StatusText>
              <QRCode value={shareableLink} />
            </Fragment>
          )}
        </Wrapper>
      </ConnectionMenu>
    );
  }

  renderStatus() {
    return this.state.connectionStatus ? (
      <Status onClick={this.onClickOpen}>
        {`${this.state.connectionStatus}${
          this.state.isConnected
            ? ` | Session token: ${this.state.tokenInput}`
            : ""
        }`}
      </Status>
    ) : null;
  }

  renderSignals() {
    const { isConnected, isSlave, showClicks, showConnectionMenu } = this.state;
    if (!isConnected) {
      return null;
    }

    return (
      <SignalEffect
        produceSignals={!isSlave && showClicks && !showConnectionMenu}
        onTrigger={this.onTriggerSignal}
        ref={this.onSignalRef}
      />
    );
  }

  render() {
    return (
      <div>
        {this.props.children}
        {this.renderSignals()}
        {this.state.showConnectionMenu && this.renderConnectionMenu()}
        {this.renderStatus()}
      </div>
    );
  }
}

export default NetworkSync;
