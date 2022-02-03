package main

import (
	"bytes"
	"crypto/tls"
	"encoding/json"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	WEBRTC_SERVER            = "https://sometestname.tk"
	PUBLISHER_NAMES_INTERVAL = 1 * time.Second
)

var (
	host     = "0.0.0.0"
	port     = "8000"
	upgrader = websocket.Upgrader{}
)

type webrtcRequest struct {
	Offer interface{} `json:"offer"`
}

type webrtcResponse struct {
	ID     string      `json:"id"`
	Answer interface{} `json:"answer"`
}

type server struct {
	mu          sync.RWMutex
	publishers  map[string]*client
	subscribers map[string]*client
}

func newServer() *server {
	return &server{
		publishers:  make(map[string]*client),
		subscribers: make(map[string]*client),
	}
}

func (s *server) run() {
	if p, ok := os.LookupEnv("PORT"); ok {
		port = p
	}

	go s.sendPublisherNamesToSubscribers()

	addr := host + ":" + port
	http.HandleFunc("/ws", s.websocket)
	http.Handle("/", http.FileServer(http.Dir("./www")))
	log.Println("Listening on " + addr)
	log.Fatal(http.ListenAndServe(addr, nil))
}

func (s *server) websocket(w http.ResponseWriter, r *http.Request) {
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	kind := r.URL.Query()["kind"][0]
	name := r.URL.Query()["name"][0]
	newClient(kind, name, ws, s)
}

func (s *server) addClient(client *client) {
	s.mu.Lock()
	log.Print("adding client: " + client.id)
	switch client.kind {
	case "publisher":
		s.publishers[client.id] = client
	case "subscriber":
		s.subscribers[client.id] = client
	}
	s.mu.Unlock()
}

func (s *server) removeClient(kind string, id string) {
	s.mu.Lock()
	log.Println("removing client: " + id)
	switch kind {
	case "publisher":
		delete(s.publishers, id)
	case "subscriber":
		delete(s.subscribers, id)
	}
	s.mu.Unlock()
}

func (s *server) getClient(kind string, id string) *client {
	s.mu.RLock()
	defer s.mu.RUnlock()
	log.Println("getting client: " + id)
	var client *client
	switch kind {
	case "publisher":
		client = s.publishers[id]
	case "subscriber":
		client = s.subscribers[id]
	}
	return client
}

func (s *server) sendPublisherNamesToSubscribers() {
	for range time.NewTicker(PUBLISHER_NAMES_INTERVAL).C {
		s.mu.RLock()
		jsonClients, _ := json.Marshal(map[string]map[string]*client{"publishers": s.publishers})
		for _, subscriber := range s.subscribers {
			subscriber.sendToClient(jsonClients)
		}
		s.mu.RUnlock()
	}
}

func (s *server) sendToWebrtcServer(kind string, message []byte) ([]byte, error) {
	http.DefaultTransport.(*http.Transport).TLSClientConfig = &tls.Config{InsecureSkipVerify: true}
	response, err := http.Post(WEBRTC_SERVER+"/"+kind, "application/json", bytes.NewBuffer(message))
	if err != nil {
		return nil, err
	}

	defer response.Body.Close()
	body, err := ioutil.ReadAll(response.Body)
	if err != nil {
		return nil, err
	}

	return body, nil
}

func main() {
	newServer().run()
}
