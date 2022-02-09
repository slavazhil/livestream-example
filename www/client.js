const WEBRTC_CONFIG = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

class Client {
    constructor(kind, name) {
        this.kind = kind; // "publisher" || "subscriber"
        this.name = name; // for publishers only
    }

    async init() {
        await this.newWebsocket();
        this.newPeerconnection();
        this.newDatachannel();
    }

    async publish(video) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        video.srcObject = stream;
        this.pc.addTrack(stream.getVideoTracks()[0]);
        this.pc.addTrack(stream.getAudioTracks()[0]);
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
        this.pc.onnegotiationneeded = (event) => { console.log(this.kind, "peerconnection onnegotiationneeded"); }
        this.pc.onsignalingstatechange = (event) => { console.log(this.kind, "peerconnection onsignalingstatechange:", this.pc.signalingState); }
        this.pc.onicegatheringstatechange = (event) => { console.log(this.kind, "peerconnection onicegatheringstatechange:", this.pc.iceGatheringState); }
        this.pc.oniceconnectionstatechange = (event) => { console.log(this.kind, "peerconnection oniceconnectionstatechange:", this.pc.iceConnectionState); }
        this.pc.onicecandidate = (ice) => {
            if (ice.candidate === null) {
                console.log(this.kind, "peerconnection sending offer");
                this.ws.send(JSON.stringify({ offer: this.pc.localDescription }))
            }
        };
    }

    newDatachannel() {
        this.dc = this.pc.createDataChannel(this.kind);
        this.dc.onopen = (event) => { console.log(this.kind, "datachannel open"); }
        this.dc.onclose = (event) => { console.log(this.kind, "datachannel closed"); }
        this.dc.onerror = (event) => { console.log(this.kind, "datachannel error"); }
        this.dc.onmessage = (event) => { console.log(this.kind, "datachannel message"); }
    }

    async newWebsocket() {
        return new Promise((resolve, reject) => {
            const protocol = location.protocol === "https:" ? "wss:" : "ws:";
            this.ws = new WebSocket(`${protocol}//${location.host}/ws?kind=${this.kind}&name=${this.name}`);
            this.ws.onopen = (event) => { console.log(this.kind, "websocket open"); resolve(); }
            this.ws.onclose = (event) => { console.log(this.kind, "websocket closed"); }
            this.ws.onerror = (event) => { console.log(this.kind, "websocket error"); reject(); }
            this.ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.answer) {
                    console.log(this.kind, "peerconnection got answer");
                    this.pc.setRemoteDescription(data.answer);
                } else if (data.publishers) {
                    listPublishers(data.publishers);
                }
            };
        })
    }
}
