model
  schema 1.1

type agent
  relations
    define can_delegate: [agent]
    define can_message: [agent]

type tool
  relations
    define can_execute: [agent]

type integration
  relations
    define can_read: [agent]
    define can_write: [agent]

type memory
  relations
    define can_write: [agent]

