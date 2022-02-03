package main

import (
	"encoding/json"
	"sync"

	"github.com/gorilla/websocket"
)

type client struct {
	mu     sync.RWMutex
	kind   string
	Name   string `json:"name"`
	id     string
	ws     *websocket.Conn
	server *server
}

func newClient(kind string, name string, ws *websocket.Conn, server *server) *client {
	c := &client{
		kind:   kind,
		Name:   name,
		ws:     ws,
		server: server,
	}
	go c.listenForMessages()
	return c
}

func (c *client) listenForMessages() {
	for {
		messageType, message, err := c.ws.ReadMessage()
		if err != nil {
			c.ws.Close()
			c.server.removeClient(c.kind, c.id)
			return
		}

		if messageType != websocket.TextMessage {
			continue
		}

		response, err := c.server.sendToWebrtcServer(c.kind, message)
		if err != nil {
			c.sendToClient([]byte(err.Error()))
			continue
		}

		c.sendToClient(response)

		if c.id == "" {
			webrtcResponse := &webrtcResponse{}
			json.Unmarshal(response, webrtcResponse)
			c.id = webrtcResponse.ID
			c.server.addClient(c)
		}
	}
}

func (c *client) sendToClient(message []byte) {
	if err := c.ws.WriteMessage(websocket.TextMessage, message); err != nil {
		c.ws.Close()
		c.server.removeClient(c.kind, c.id)
	}
}
