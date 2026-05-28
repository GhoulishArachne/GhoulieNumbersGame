# TODO

- [ ] Create backend server (Node + Express) with SQLite persistence
- [ ] Implement endpoints: getState, addTickets, removeTicket, runDraw, updateExtraPool, clearAll
- [ ] Implement draw/prize logic on the server to ensure consistent results across users
- [ ] Refactor `script.js` to call backend APIs instead of using in-memory/local state
- [ ] Add sync mechanism (simple polling after mutations + SSE optional)
- [ ] Test manually by opening in two browser windows and verifying shared state
- [ ] Update `index.html` if needed for API base / SSE

