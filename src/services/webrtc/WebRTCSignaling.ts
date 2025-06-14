
import { WebRTCServerOffer } from './types';
import { SignalingMessage } from './SignalingService';

export class WebRTCSignaling {
  private onSignalingMessage?: (message: SignalingMessage, fromPeerId: string) => void;

  setSignalingHandler(handler: (message: SignalingMessage, fromPeerId: string) => void): void {
    this.onSignalingMessage = handler;
  }

  handleSignalingMessage(message: SignalingMessage, fromPeerId: string): void {
    if (this.onSignalingMessage) {
      this.onSignalingMessage(message, fromPeerId);
    }
  }

  async handleNewOffer(
    newOffer: WebRTCServerOffer, 
    fromPeerId: string,
    connection: RTCPeerConnection,
    onAnswerCreated: (peerId: string, answer: RTCSessionDescriptionInit) => void
  ): Promise<void> {
    try {
      console.log('Applying new offer from admin');
      
      await connection.setRemoteDescription(newOffer.offer);
      
      const answer = await connection.createAnswer();
      await connection.setLocalDescription(answer);
      
      onAnswerCreated(fromPeerId, answer);
      
      console.log('Sent new answer to admin');
    } catch (error) {
      console.error('Failed to handle new offer:', error);
    }
  }

  async handleNewAnswer(
    answer: RTCSessionDescriptionInit,
    connection: RTCPeerConnection,
    onReconnectionSuccess: () => void
  ): Promise<void> {
    try {
      await connection.setRemoteDescription(answer);
      onReconnectionSuccess();
      console.log('Applied new answer from client and marked reconnection success');
    } catch (error) {
      console.error('Failed to handle new answer:', error);
    }
  }

  async handleIceCandidate(
    candidate: RTCIceCandidate,
    connection: RTCPeerConnection
  ): Promise<void> {
    try {
      await connection.addIceCandidate(candidate);
      console.log('Added new ICE candidate from peer');
    } catch (error) {
      console.warn('Failed to add ICE candidate:', error);
    }
  }
}
