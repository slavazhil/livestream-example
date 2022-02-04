const WEBRTC_CONFIG = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

class Client {
    constructor(kind, name) {
        this.kind = kind; // publisher or subscriber
        this.name = name; //publishers only
        this.newWebsocket();
        this.newPeerconnection();
        this.newDatachannel();
    }

    async publish(video) {
        const media = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        video.srcObject = media;
        this.pc.addTrack(media.getVideoTracks()[0]);
        this.pc.addTrack(media.getAudioTracks()[0]);
        this.pc.setLocalDescription(await this.pc.createOffer());
    }

    async subscribe(video) {
        this.pc.addTransceiver("video");
        this.pc.addTransceiver("audio");
        this.pc.ontrack = (event) => { video.srcObject = event.streams[0]; }
        this.pc.setLocalDescription(await this.pc.createOffer());
    }

    async getStats() {
        return await this.pc.getStats();
    }

    watch(publisherID) {
        this.dc.send(publisherID);
    }

    newPeerconnection() {
        this.pc = new RTCPeerConnection(WEBRTC_CONFIG);
        this.pc.onnegotiationneeded = (event) => { console.log(this.kind, "peerconnection onnegotiationneeded:", event); }
        this.pc.oniceconnectionstatechange = (event) => { console.log(this.kind, "peerconnection oniceconnectionstatechange:", this.pc.iceConnectionState); }
        this.pc.onicegatheringstatechange = (event) => { console.log(this.kind, "peerconnection onicegatheringstatechange:", this.pc.iceGatheringState); }
        this.pc.onicecandidate = (ice) => {
            if (ice.candidate === null) {
                console.log(this.kind, "peerconnection sending ice");
                this.ws.send(JSON.stringify({ offer: this.pc.localDescription }))
            }
        };
    }

    newDatachannel() {
        this.dc = this.pc.createDataChannel(this.kind);
        this.dc.onopen = (event) => { console.log(this.kind, "datachannel open", event); }
        this.dc.onclose = (event) => { console.log(this.kind, "datachannel closed", event); }
        this.dc.onerror = (error) => { console.log(this.kind, "datachannel error", error); }
        this.dc.onmessage = (event) => { console.log(this.kind, "datachannel message", event); }
    }

    newWebsocket() {
        // this.ws = new WebSocket(`ws://${location.host}/ws?kind=${this.kind}&name=${this.name}`);
        this.ws = new WebSocket(`wss://${location.host}/ws?kind=${this.kind}&name=${this.name}`);
        this.ws.onopen = (event) => { console.log(this.kind, "websocket open:", event); }
        this.ws.onclose = (event) => { console.log(this.kind, "websocket closed:", event); }
        this.ws.onerror = (error) => { console.log(this.kind, "websocket error:", error); }
        this.ws.onmessage = (event) => {
            // console.log(this.kind, "websocket message", event);
            const data = JSON.parse(event.data);
            if (data.answer) { this.pc.setRemoteDescription(data.answer); }
            else if (data.publishers) { listPublishers(data.publishers); }
        };
    }
}
