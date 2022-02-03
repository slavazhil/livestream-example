let publisher;
let subscriber;

document.getElementById("stream").addEventListener("click", async () => {
    const name = document.getElementById("publisher-name").value;
    if (!name) {
        document.getElementById("publisher-message").innerText = "ENTER A NAME";
        return;
    }
    document.getElementById("publisher-name").disabled = true;
    document.getElementById("stream").disabled = true;
    publisher = new Client("publisher", name);
    await publisher.publish(document.getElementById("publisher-video"));
    showStats(publisher, document.getElementById("publisher-message"));
});

document.getElementById("watch").addEventListener("click", async () => {
    document.getElementById("watch").disabled = true;
    subscriber = new Client("subscriber");
    await subscriber.subscribe(document.getElementById("subscriber-video"));
    showStats(subscriber, document.getElementById("subscriber-message"));
});

function listPublishers(publishers) {
    let list = "";

    for (const id in publishers) {
        list += `<tr onclick="subscriber.watch('${id}')"><td>${publishers[id].name}</td></tr>`;
    }

    document.getElementById("list").innerHTML = list;
}

function showStats(client, textElement) {
    let lastTime = 0;
    let lastBytes = 0;

    setInterval(async () => {
        const stats = await client.getStats();
        stats.forEach(report => {
            if (client.kind === "publisher" && report.type === "outbound-rtp" && report.kind === "video") {
                const bitRate = Math.round((report.bytesSent - lastBytes) * 8 / (report.timestamp - lastTime));
                textElement.innerHTML = `outbound ${report.kind} bitrate: ${bitRate} kbits/sec`;
                lastTime = report.timestamp;
                lastBytes = report.bytesSent;
            } else if (client.kind === "subscriber" && report.type === "inbound-rtp" && report.kind === "video") {
                const bitRate = Math.round((report.bytesReceived - lastBytes) * 8 / (report.timestamp - lastTime));
                textElement.innerHTML = `inbound ${report.kind} bitrate: ${bitRate} kbits/sec`;
                lastTime = report.timestamp;
                lastBytes = report.bytesReceived;
            }
        });
    }, 1000);
}