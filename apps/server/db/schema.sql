-- Rooms table
CREATE TABLE IF NOT EXISTS rooms (
  id SERIAL PRIMARY KEY,
  code VARCHAR(10) UNIQUE NOT NULL,
  host_id VARCHAR(64) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  is_locked BOOLEAN DEFAULT FALSE
);

-- Players table
CREATE TABLE IF NOT EXISTS players (
  id SERIAL PRIMARY KEY,
  room_id INT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  stack INT NOT NULL,
  seat INT,
  token VARCHAR(128) NOT NULL,
  connected BOOLEAN DEFAULT TRUE,
  UNIQUE(room_id, name)
);

-- Hands table
CREATE TABLE IF NOT EXISTS hands (
  id SERIAL PRIMARY KEY,
  room_id INT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  hand_number INT NOT NULL,
  started_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP
);

-- Actions table
CREATE TABLE IF NOT EXISTS actions (
  id SERIAL PRIMARY KEY,
  hand_id INT NOT NULL REFERENCES hands(id) ON DELETE CASCADE,
  player_id INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  action_type VARCHAR(20) NOT NULL,
  amount INT,
  created_at TIMESTAMP DEFAULT NOW()
);
