
export class WebRTCEventHandler {
  private onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
  private onIceCandidate?: (candidate: RTCIceCandidate) => void;
  private onDataChannel?: (channel: RTCDataChannel) => void;

  setupConnectionEvents(
    connection: RTCPeerConnection,
    callbacks: {
      onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
      onIceCandidate?: (candidate: RTCIceCandidate) => void;
      onDataChannel?: (channel: RTCDataChannel) => void;
    }
  ): void {
    this.onConnectionStateChange = callbacks.onConnectionStateChange;
    this.onIceCandidate = callbacks.onIceCandidate;
    this.onDataChannel = callbacks.onDataChannel;

    connection.onicecandidate = (event) => {
      if (event.candidate && this.onIceCandidate) {
        this.onIceCandidate(event.candidate);
      }
    };

    connection.onconnectionstatechange = () => {
      console.log('Connection state changed:', connection.connectionState);
      if (this.onConnectionStateChange) {
        this.onConnectionStateChange(connection.connectionState);
      }
    };

    connection.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', connection.iceConnectionState);
      if (connection.iceConnectionState === 'disconnected' || connection.iceConnectionState === 'failed') {
        if (this.onConnectionStateChange) {
          this.onConnectionStateChange('failed');
        }
      }
    };

    connection.ondatachannel = (event) => {
      if (this.onDataChannel) {
        this.onDataChannel(event.channel);
      }
    };
  }
}
